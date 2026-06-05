import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { getDb } from "../src/db";
import {
  applyBaselineEstimatesToAll,
  backfillCompanyData,
  syncSecFilings,
} from "../src/lib/ipo/service";
import { inngest } from "../src/inngest/client";

const analyzeCount = Number(process.env.SEED_ANALYZE_COUNT ?? 10);

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  if (!process.env.SEC_USER_AGENT) {
    console.error('SEC_USER_AGENT is required. Format: "AppName you@email.com"');
    process.exit(1);
  }

  const daysBack = Number(process.env.SEED_DAYS_BACK ?? 60);
  console.log(`Starting SEC filing sync (last ${daysBack} days)...`);
  const result = await syncSecFilings(daysBack);
  console.log("Sync complete:", result);

  console.log("Applying baseline IPO date estimates...");
  const baselineCount = await applyBaselineEstimatesToAll();
  console.log(`Baseline dates set for ${baselineCount} companies`);

  const hasInngest = Boolean(process.env.INNGEST_EVENT_KEY);

  if (hasInngest) {
    const db = getDb();
    const companies = await db.query.ipoCompanies.findMany({ limit: analyzeCount });
    console.log(`Queueing agent analysis for ${companies.length} companies via Inngest...`);
    for (const company of companies) {
      try {
        await inngest.send({
          name: "ipo/analyze.manual",
          data: { companyId: company.id },
        });
        console.log(`Queued analysis for ${company.name}`);
      } catch (error) {
        console.warn(`Failed to queue ${company.name}:`, error);
      }
    }
  } else {
    console.log(`Running agent enrichment for up to ${analyzeCount} companies...`);
    const enrichSummary = await backfillCompanyData({
      limit: analyzeCount,
      onlyMissing: true,
    });
    console.log("Enrichment summary:", enrichSummary);
    console.log("(Run 'npm run backfill' to enrich more companies)");
  }

  console.log("Seed complete.");
  console.log("Next step: npm run dev  →  http://localhost:3000");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
