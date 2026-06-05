import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  real,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const ipoStatusEnum = pgEnum("ipo_status", [
  "upcoming",
  "priced",
  "listed",
  "withdrawn",
]);

export const agentRunStatusEnum = pgEnum("agent_run_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const riskLevelEnum = pgEnum("risk_level", ["low", "medium", "high"]);

export const ipoCompanies = pgTable(
  "ipo_companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cik: text("cik").notNull(),
    name: text("name").notNull(),
    ticker: text("ticker"),
    sector: text("sector"),
    exchange: text("exchange"),
    status: ipoStatusEnum("status").notNull().default("upcoming"),
    listingDate: timestamp("listing_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ipo_companies_cik_idx").on(table.cik),
    index("ipo_companies_status_idx").on(table.status),
    index("ipo_companies_ticker_idx").on(table.ticker),
    index("ipo_companies_listing_date_idx").on(table.listingDate),
  ],
);

export const ipoFilings = pgTable(
  "ipo_filings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => ipoCompanies.id, { onDelete: "cascade" }),
    formType: text("form_type").notNull(),
    accessionNumber: text("accession_number").notNull(),
    filedAt: timestamp("filed_at", { withTimezone: true }).notNull(),
    primaryDocument: text("primary_document"),
    documentUrl: text("document_url"),
    description: text("description"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ipo_filings_accession_idx").on(table.accessionNumber),
    index("ipo_filings_company_id_idx").on(table.companyId),
    index("ipo_filings_form_type_idx").on(table.formType),
    index("ipo_filings_filed_at_idx").on(table.filedAt),
  ],
);

export const ipoDateEstimates = pgTable(
  "ipo_date_estimates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => ipoCompanies.id, { onDelete: "cascade" }),
    targetDate: timestamp("target_date", { withTimezone: true }),
    confidence: real("confidence").notNull().default(0),
    reasoning: text("reasoning"),
    sourceFilingIds: jsonb("source_filing_ids").$type<string[]>().default([]),
    signals: jsonb("signals").$type<
      Array<{ type: string; date?: string; source: string; excerpt?: string }>
    >(),
    agentVersion: text("agent_version").notNull().default("1.0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ipo_date_estimates_company_id_idx").on(table.companyId),
    index("ipo_date_estimates_target_date_idx").on(table.targetDate),
  ],
);

export const ipoPricing = pgTable(
  "ipo_pricing",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => ipoCompanies.id, { onDelete: "cascade" }),
    offerPrice: real("offer_price"),
    offerPriceSource: text("offer_price_source"),
    openingPrice: real("opening_price"),
    openingDate: timestamp("opening_date", { withTimezone: true }),
    currentPrice: real("current_price"),
    currentPriceAt: timestamp("current_price_at", { withTimezone: true }),
    returnVsOffer: real("return_vs_offer"),
    returnVsOpen: real("return_vs_open"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("ipo_pricing_company_id_idx").on(table.companyId)],
);

export const ipoRiskAssessments = pgTable(
  "ipo_risk_assessments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => ipoCompanies.id, { onDelete: "cascade" }),
    sourceAccession: text("source_accession").notNull(),
    overallRisk: riskLevelEnum("overall_risk").notNull().default("medium"),
    summary: text("summary"),
    topRisks: jsonb("top_risks").$type<
      Array<{
        title: string;
        category: string;
        severity: "low" | "medium" | "high";
        description: string;
        citation?: string;
      }>
    >(),
    rawExcerpt: text("raw_excerpt"),
    modelUsed: text("model_used"),
    agentVersion: text("agent_version").notNull().default("1.0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ipo_risk_assessments_company_id_idx").on(table.companyId),
    index("ipo_risk_assessments_created_at_idx").on(table.createdAt),
  ],
);

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobType: text("job_type").notNull(),
    companyId: uuid("company_id").references(() => ipoCompanies.id, {
      onDelete: "set null",
    }),
    status: agentRunStatusEnum("status").notNull().default("pending"),
    logs: jsonb("logs").$type<string[]>().default([]),
    error: text("error"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("agent_runs_job_type_idx").on(table.jobType),
    index("agent_runs_status_idx").on(table.status),
    index("agent_runs_created_at_idx").on(table.createdAt),
  ],
);

export const priceSnapshots = pgTable(
  "price_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => ipoCompanies.id, { onDelete: "cascade" }),
    date: timestamp("date", { withTimezone: true }).notNull(),
    close: real("close").notNull(),
    open: real("open"),
    high: real("high"),
    low: real("low"),
    volume: integer("volume"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("price_snapshots_company_date_idx").on(
      table.companyId,
      table.date,
    ),
    index("price_snapshots_date_idx").on(table.date),
  ],
);

export const ipoCompaniesRelations = relations(ipoCompanies, ({ many, one }) => ({
  filings: many(ipoFilings),
  dateEstimates: many(ipoDateEstimates),
  pricing: one(ipoPricing),
  riskAssessments: many(ipoRiskAssessments),
  priceSnapshots: many(priceSnapshots),
}));

export const ipoFilingsRelations = relations(ipoFilings, ({ one }) => ({
  company: one(ipoCompanies, {
    fields: [ipoFilings.companyId],
    references: [ipoCompanies.id],
  }),
}));

export const agentRunsRelations = relations(agentRuns, ({ one }) => ({
  company: one(ipoCompanies, {
    fields: [agentRuns.companyId],
    references: [ipoCompanies.id],
  }),
}));

export type IpoCompany = typeof ipoCompanies.$inferSelect;
export type IpoFiling = typeof ipoFilings.$inferSelect;
export type IpoDateEstimate = typeof ipoDateEstimates.$inferSelect;
export type IpoPricing = typeof ipoPricing.$inferSelect;
export type IpoRiskAssessment = typeof ipoRiskAssessments.$inferSelect;
