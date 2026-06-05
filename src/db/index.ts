import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DbInstance =
  | ReturnType<typeof drizzleNeon<typeof schema>>
  | ReturnType<typeof drizzlePostgres<typeof schema>>;

let _db: DbInstance | null = null;
let _postgresClient: ReturnType<typeof postgres> | null = null;

function useNeonDriver(url: string): boolean {
  return url.includes("neon.tech");
}

export function getDb(): DbInstance {
  if (_db) return _db;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Configure a PostgreSQL connection string.",
    );
  }

  if (useNeonDriver(url)) {
    const sql = neon(url);
    _db = drizzleNeon(sql, { schema });
    return _db;
  }

  // Supabase, local Postgres, and other standard PostgreSQL URLs
  _postgresClient = postgres(url, { ssl: url.includes("supabase.com") ? "require" : undefined });
  _db = drizzlePostgres(_postgresClient, { schema });
  return _db;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export * from "./schema";
