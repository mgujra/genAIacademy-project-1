import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { sql } from "drizzle-orm";
import { getDb } from "../src/db";
import { ipoCompanies } from "../src/db/schema";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set in .env.local or .env");
    process.exit(1);
  }

  console.log("Testing database connection...");
  console.log("URL host:", process.env.DATABASE_URL.replace(/:[^:@]+@/, ":****@"));

  try {
    const db = getDb();
    const count = await db.select({ count: sql<number>`count(*)` }).from(ipoCompanies);
    console.log("✅ Connected successfully");
    console.log(`   IPO companies in database: ${count[0]?.count ?? 0}`);
  } catch (error) {
    console.error("❌ Connection failed:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
