import { config } from "dotenv";

// Load .env.local first (Next.js convention), then .env (CLI fallback)
config({ path: ".env.local" });
config({ path: ".env" });

import { getDb } from "../src/db";
import {
  runDateCuratorForCompany,
  runRiskAnalyzerForCompany,
  syncSecFilings,
} from "../src/lib/ipo/service";
import { inngest } from "../src/inngest/client";

const analyzeCount = Number(process.env.SEED_ANALYZE_COUNT ?? 3);

async function runInlineAnalysis(companyId: string, companyName: string) {
  console.log(`Running inline agent analysis for ${companyName}...`);
  try {
    await runDateCuratorForCompany(companyId);
    console.log(`  ✓ Date curation complete for ${companyName}`);
  } catch (error) {
    console.warn(`  ✗ Date curation failed for ${companyName}:`, error);
  }

  try {
    await runRiskAnalyzerForCompany(companyId);
    console.log(`  ✓ Risk analysis complete for ${companyName}`);
  } catch (error) {
    console.warn(`  ✗ Risk analysis failed for ${companyName}:`, error);
  }
}

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

  const db = getDb();
  const companies = await db.query.ipoCompanies.findMany({
    limit: analyzeCount,
  });

  if (companies.length === 0) {
    console.log("No companies to analyze. Seed complete.");
    return;
  }

  const hasInngest = Boolean(process.env.INNGEST_EVENT_KEY);

  if (hasInngest) {
    console.log(
      `Queueing agent analysis for ${companies.length} companies via Inngest...`,
    );
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
    console.log(
      `INNGEST_EVENT_KEY not set — running inline agent analysis for ${companies.length} companies...`,
    );
    console.log(
      "(Set INNGEST_EVENT_KEY to queue via Inngest, or use 'Re-run Agent' on IPO detail pages)",
    );
    for (const company of companies) {
      await runInlineAnalysis(company.id, company.name);
    }
  }

  console.log("Seed complete.");
  console.log("Next step: npm run dev  →  http://localhost:3000");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
