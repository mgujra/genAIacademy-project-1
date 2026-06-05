import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load env for CLI commands (db:push, db:studio)
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Only introspect the public schema — avoids Supabase internal CHECK constraint bugs
  schemaFilter: ["public"],
  dbCredentials: {
    // Use direct connection (port 5432) for migrations if set; otherwise DATABASE_URL
    url: process.env.DATABASE_URL_MIGRATIONS ?? process.env.DATABASE_URL!,
  },
});
