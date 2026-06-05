import { config } from "dotenv";

// Load .env.local first (Next.js convention), then .env (CLI fallback)
config({ path: ".env.local" });
config({ path: ".env" });
import { getDb } from "../src/db";
import { syncSecFilings } from "../src/lib/ipo/service";
import { inngest } from "../src/inngest/client";

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
  const companies = await db.query.ipoCompanies.findMany({ limit: 10 });

  console.log(`Triggering agent analysis for ${companies.length} companies...`);

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

  console.log("Seed complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
