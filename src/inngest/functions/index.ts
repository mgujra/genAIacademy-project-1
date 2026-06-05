import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { ipoCompanies } from "@/db/schema";
import {
  runDateCuratorForCompany,
  runRiskAnalyzerForCompany,
  syncAllRecentPricing,
  syncPricingForCompany,
  syncSecFilings,
} from "@/lib/ipo/service";
import { inngest } from "../client";

export const secFilingSync = inngest.createFunction(
  { id: "sec-filing-sync", triggers: [{ cron: "0 */6 * * *" }] },
  async ({ step }) => {
    if (!isDatabaseConfigured()) {
      return { skipped: true, reason: "DATABASE_URL not configured" };
    }

    const result = await step.run("sync-sec-filings", async () => {
      return syncSecFilings(90);
    });

    await step.run("trigger-date-curation", async () => {
      const db = getDb();
      const companies = await db.query.ipoCompanies.findMany({
        where: eq(ipoCompanies.status, "upcoming"),
        limit: 50,
      });

      const events = companies.map((company) => ({
        name: "ipo/date.curate" as const,
        data: { companyId: company.id },
      }));

      if (events.length > 0) {
        await inngest.send(events);
      }

      return { triggered: events.length };
    });

    return result;
  },
);

export const ipoDateCurator = inngest.createFunction(
  { id: "ipo-date-curator", triggers: [{ event: "ipo/date.curate" }] },
  async ({ event, step }) => {
    if (!isDatabaseConfigured()) {
      return { skipped: true };
    }

    const result = await step.run("curate-date", async () => {
      return runDateCuratorForCompany(event.data.companyId);
    });

    await step.run("trigger-risk-analysis", async () => {
      await inngest.send({
        name: "ipo/risk.analyze",
        data: { companyId: event.data.companyId },
      });
    });

    return result;
  },
);

export const prospectusRiskAnalyzer = inngest.createFunction(
  {
    id: "prospectus-risk-analyzer",
    triggers: [{ event: "ipo/risk.analyze" }],
  },
  async ({ event, step }) => {
    if (!isDatabaseConfigured()) {
      return { skipped: true };
    }

    return step.run("analyze-risks", async () => {
      return runRiskAnalyzerForCompany(event.data.companyId);
    });
  },
);

export const ipoPriceSync = inngest.createFunction(
  { id: "ipo-price-sync", triggers: [{ cron: "0 * * * *" }] },
  async ({ step }) => {
    if (!isDatabaseConfigured()) {
      return { skipped: true, reason: "DATABASE_URL not configured" };
    }

    return step.run("sync-prices", async () => {
      return syncAllRecentPricing();
    });
  },
);

export const manualAnalyze = inngest.createFunction(
  { id: "manual-analyze", triggers: [{ event: "ipo/analyze.manual" }] },
  async ({ event, step }) => {
    const { companyId } = event.data;

    const dateResult = await step.run("curate-date", async () => {
      return runDateCuratorForCompany(companyId);
    });

    const riskResult = await step.run("analyze-risks", async () => {
      try {
        return await runRiskAnalyzerForCompany(companyId);
      } catch {
        return null;
      }
    });

    const priceResult = await step.run("sync-pricing", async () => {
      try {
        return await syncPricingForCompany(companyId);
      } catch {
        return null;
      }
    });

    return { dateResult, riskResult, priceResult };
  },
);

export const inngestFunctions = [
  secFilingSync,
  ipoDateCurator,
  prospectusRiskAnalyzer,
  ipoPriceSync,
  manualAnalyze,
];
