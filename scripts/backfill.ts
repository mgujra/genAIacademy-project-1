import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import {
  applyBaselineEstimatesToAll,
  backfillCompanyData,
} from "../src/lib/ipo/service";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  if (!process.env.SEC_USER_AGENT) {
    console.error('SEC_USER_AGENT is required. Format: "AppName you@email.com"');
    process.exit(1);
  }

  const limit = Number(process.env.BACKFILL_LIMIT ?? 25);

  console.log("Step 1: Applying baseline IPO date estimates from filing metadata...");
  const baselineCount = await applyBaselineEstimatesToAll();
  console.log(`  ✓ Baseline dates created/updated for ${baselineCount} companies`);

  console.log(`\nStep 2: Running full agent enrichment for up to ${limit} companies...`);
  console.log("  (This fetches SEC prospectus documents — may take several minutes)\n");

  const summary = await backfillCompanyData({ limit, onlyMissing: true });

  console.log("\nEnrichment complete:");
  console.log(`  Processed: ${summary.processed}`);
  console.log(`  Dates curated: ${summary.dates}`);
  console.log(`  Risks analyzed: ${summary.risks}`);
  console.log(`  Offer prices extracted: ${summary.offers}`);
  console.log(`  Market prices synced: ${summary.prices}`);

  if (summary.errors.length > 0) {
    console.log(`\n  Errors (${summary.errors.length} companies):`);
    for (const err of summary.errors.slice(0, 10)) {
      console.log(`    ${err.company}: ${err.errors.join(", ")}`);
    }
    if (summary.errors.length > 10) {
      console.log(`    ... and ${summary.errors.length - 10} more`);
    }
  }

  if (summary.processed >= limit) {
    console.log(`\nRun again to enrich more: BACKFILL_LIMIT=${limit} npm run backfill`);
  }

  console.log("\nNext: npm run dev  →  http://localhost:3000/ipos");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
