-- IPO Tracker initial schema
-- Run this in Supabase SQL Editor if `npm run db:push` fails
-- Dashboard → SQL Editor → New query → paste and Run

CREATE TYPE "public"."ipo_status" AS ENUM('upcoming', 'priced', 'listed', 'withdrawn');
CREATE TYPE "public"."agent_run_status" AS ENUM('pending', 'running', 'completed', 'failed');
CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high');

CREATE TABLE IF NOT EXISTS "ipo_companies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cik" text NOT NULL,
  "name" text NOT NULL,
  "ticker" text,
  "sector" text,
  "exchange" text,
  "status" "ipo_status" DEFAULT 'upcoming' NOT NULL,
  "listing_date" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ipo_companies_cik_idx" ON "ipo_companies" ("cik");
CREATE INDEX IF NOT EXISTS "ipo_companies_status_idx" ON "ipo_companies" ("status");
CREATE INDEX IF NOT EXISTS "ipo_companies_ticker_idx" ON "ipo_companies" ("ticker");
CREATE INDEX IF NOT EXISTS "ipo_companies_listing_date_idx" ON "ipo_companies" ("listing_date");

CREATE TABLE IF NOT EXISTS "ipo_filings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "ipo_companies"("id") ON DELETE CASCADE,
  "form_type" text NOT NULL,
  "accession_number" text NOT NULL,
  "filed_at" timestamp with time zone NOT NULL,
  "primary_document" text,
  "document_url" text,
  "description" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ipo_filings_accession_idx" ON "ipo_filings" ("accession_number");
CREATE INDEX IF NOT EXISTS "ipo_filings_company_id_idx" ON "ipo_filings" ("company_id");
CREATE INDEX IF NOT EXISTS "ipo_filings_form_type_idx" ON "ipo_filings" ("form_type");
CREATE INDEX IF NOT EXISTS "ipo_filings_filed_at_idx" ON "ipo_filings" ("filed_at");

CREATE TABLE IF NOT EXISTS "ipo_date_estimates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "ipo_companies"("id") ON DELETE CASCADE,
  "target_date" timestamp with time zone,
  "confidence" real DEFAULT 0 NOT NULL,
  "reasoning" text,
  "source_filing_ids" jsonb DEFAULT '[]'::jsonb,
  "signals" jsonb,
  "agent_version" text DEFAULT '1.0' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ipo_date_estimates_company_id_idx" ON "ipo_date_estimates" ("company_id");
CREATE INDEX IF NOT EXISTS "ipo_date_estimates_target_date_idx" ON "ipo_date_estimates" ("target_date");

CREATE TABLE IF NOT EXISTS "ipo_pricing" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "ipo_companies"("id") ON DELETE CASCADE,
  "offer_price" real,
  "offer_price_source" text,
  "opening_price" real,
  "opening_date" timestamp with time zone,
  "current_price" real,
  "current_price_at" timestamp with time zone,
  "return_vs_offer" real,
  "return_vs_open" real,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ipo_pricing_company_id_idx" ON "ipo_pricing" ("company_id");

CREATE TABLE IF NOT EXISTS "ipo_risk_assessments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "ipo_companies"("id") ON DELETE CASCADE,
  "source_accession" text NOT NULL,
  "overall_risk" "risk_level" DEFAULT 'medium' NOT NULL,
  "summary" text,
  "top_risks" jsonb,
  "raw_excerpt" text,
  "model_used" text,
  "agent_version" text DEFAULT '1.0' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ipo_risk_assessments_company_id_idx" ON "ipo_risk_assessments" ("company_id");
CREATE INDEX IF NOT EXISTS "ipo_risk_assessments_created_at_idx" ON "ipo_risk_assessments" ("created_at");

CREATE TABLE IF NOT EXISTS "agent_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_type" text NOT NULL,
  "company_id" uuid REFERENCES "ipo_companies"("id") ON DELETE SET NULL,
  "status" "agent_run_status" DEFAULT 'pending' NOT NULL,
  "logs" jsonb DEFAULT '[]'::jsonb,
  "error" text,
  "metadata" jsonb,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "agent_runs_job_type_idx" ON "agent_runs" ("job_type");
CREATE INDEX IF NOT EXISTS "agent_runs_status_idx" ON "agent_runs" ("status");
CREATE INDEX IF NOT EXISTS "agent_runs_created_at_idx" ON "agent_runs" ("created_at");

CREATE TABLE IF NOT EXISTS "price_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "ipo_companies"("id") ON DELETE CASCADE,
  "date" timestamp with time zone NOT NULL,
  "close" real NOT NULL,
  "open" real,
  "high" real,
  "low" real,
  "volume" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "price_snapshots_company_date_idx" ON "price_snapshots" ("company_id", "date");
CREATE INDEX IF NOT EXISTS "price_snapshots_date_idx" ON "price_snapshots" ("date");
