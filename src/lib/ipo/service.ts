import { desc, eq, gte, and, sql, inArray } from "drizzle-orm";
import { subMonths } from "date-fns";
import { getDb } from "@/db";
import {
  agentRuns,
  ipoCompanies,
  ipoDateEstimates,
  ipoFilings,
  ipoPricing,
  ipoRiskAssessments,
  priceSnapshots,
} from "@/db/schema";
import {
  fetchFilingByAccession,
  fetchFilingDocument,
  getAllIpoFilingsInRange,
  getCompanySubmissions,
  getFilingDocumentUrl,
} from "@/lib/sec/client";
import { extractOfferPrice, inferCompanyStatus } from "@/lib/sec/parsers";
import { curateIpoDate } from "@/lib/agent/date-curator";
import { analyzeProspectusRisks } from "@/lib/agent/risk-analyzer";
import { getMarketProvider } from "@/lib/market/provider";
import { padCik, filingUrl } from "@/lib/utils";

export interface IpoListFilters {
  status?: string;
  riskLevel?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function syncSecFilings(daysBack = 90) {
  const db = getDb();
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);

  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const run = await db
    .insert(agentRuns)
    .values({
      jobType: "sec-filing-sync",
      status: "running",
      startedAt: new Date(),
      logs: [`Syncing filings from ${startStr} to ${endStr}`],
    })
    .returning();

  try {
    const filings = await getAllIpoFilingsInRange(startStr, endStr);
    const ciks = [...new Set(filings.map((f) => f.cik))];
    let companiesUpserted = 0;
    let filingsUpserted = 0;

    for (const cik of ciks) {
      try {
        const submissions = await getCompanySubmissions(cik);
        const status = inferCompanyStatus(
          submissions.filings.map((f) => f.formType),
          submissions.tickers.length > 0,
        );

        const [company] = await db
          .insert(ipoCompanies)
          .values({
            cik: padCik(cik),
            name: submissions.name,
            ticker: submissions.tickers[0] ?? null,
            exchange: submissions.exchanges[0] ?? null,
            sector: submissions.sic ?? null,
            status,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: ipoCompanies.cik,
            set: {
              name: submissions.name,
              ticker: submissions.tickers[0] ?? null,
              exchange: submissions.exchanges[0] ?? null,
              sector: submissions.sic ?? null,
              status,
              updatedAt: new Date(),
            },
          })
          .returning();

        companiesUpserted++;

        for (const filing of submissions.filings) {
          const docUrl = filing.primaryDocument
            ? getFilingDocumentUrl(cik, filing.accessionNumber, filing.primaryDocument)
            : filingUrl(cik, filing.accessionNumber);

          await db
            .insert(ipoFilings)
            .values({
              companyId: company.id,
              formType: filing.formType,
              accessionNumber: filing.accessionNumber,
              filedAt: new Date(filing.filedAt),
              primaryDocument: filing.primaryDocument ?? null,
              documentUrl: docUrl,
              description: filing.description ?? null,
            })
            .onConflictDoNothing();

          filingsUpserted++;
        }
      } catch (error) {
        console.error(`Failed to sync CIK ${cik}:`, error);
      }
    }

    await db
      .update(agentRuns)
      .set({
        status: "completed",
        completedAt: new Date(),
        metadata: { companiesUpserted, filingsUpserted, ciksProcessed: ciks.length },
        logs: [
          `Synced ${filingsUpserted} filings across ${companiesUpserted} companies`,
        ],
      })
      .where(eq(agentRuns.id, run[0].id));

    return { companiesUpserted, filingsUpserted };
  } catch (error) {
    await db
      .update(agentRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(agentRuns.id, run[0].id));
    throw error;
  }
}

export async function runDateCuratorForCompany(companyId: string) {
  const db = getDb();
  const company = await db.query.ipoCompanies.findFirst({
    where: eq(ipoCompanies.id, companyId),
    with: { filings: true },
  });

  if (!company) throw new Error("Company not found");

  const run = await db
    .insert(agentRuns)
    .values({
      jobType: "ipo-date-curator",
      companyId,
      status: "running",
      startedAt: new Date(),
    })
    .returning();

  try {
    const relevantFilings = company.filings.filter((f) =>
      ["S-1", "S-1/A", "F-1", "F-1/A", "EFFECT", "424B4"].includes(f.formType),
    );

    const filingContexts = await Promise.all(
      relevantFilings.slice(0, 5).map(async (f) => {
        let documentText: string | undefined;
        if (f.primaryDocument) {
          try {
            documentText = await fetchFilingDocument(
              company.cik,
              f.accessionNumber,
              f.primaryDocument,
            );
          } catch {
            documentText = undefined;
          }
        }
        return {
          formType: f.formType,
          accessionNumber: f.accessionNumber,
          filedAt: f.filedAt.toISOString(),
          documentText,
        };
      }),
    );

    const { result, signals } = await curateIpoDate(company.name, filingContexts);

    await db.insert(ipoDateEstimates).values({
      companyId,
      targetDate: result.targetDate ? new Date(result.targetDate) : null,
      confidence: result.confidence,
      reasoning: result.reasoning,
      sourceFilingIds: result.citedSources.map((s) => s.accessionNumber),
      signals,
    });

    await db
      .update(agentRuns)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(agentRuns.id, run[0].id));

    return result;
  } catch (error) {
    await db
      .update(agentRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(agentRuns.id, run[0].id));
    throw error;
  }
}

export async function runRiskAnalyzerForCompany(companyId: string) {
  const db = getDb();
  const company = await db.query.ipoCompanies.findFirst({
    where: eq(ipoCompanies.id, companyId),
    with: { filings: true },
  });

  if (!company) throw new Error("Company not found");

  const prospectus = company.filings.find(
    (f) =>
      f.formType === "424B4" ||
      f.formType === "S-1/A" ||
      f.formType === "S-1" ||
      f.formType === "F-1",
  );

  if (!prospectus) {
    throw new Error("No prospectus filing found");
  }

  const run = await db
    .insert(agentRuns)
    .values({
      jobType: "prospectus-risk-analyzer",
      companyId,
      status: "running",
      startedAt: new Date(),
    })
    .returning();

  try {
    const html = prospectus.primaryDocument
      ? await fetchFilingDocument(
          company.cik,
          prospectus.accessionNumber,
          prospectus.primaryDocument,
        )
      : await fetchFilingByAccession(company.cik, prospectus.accessionNumber);

    if (!html) throw new Error("Could not fetch prospectus document");

    const { result, rawExcerpt } = await analyzeProspectusRisks(
      company.name,
      html,
      prospectus.accessionNumber,
    );

    await db.insert(ipoRiskAssessments).values({
      companyId,
      sourceAccession: prospectus.accessionNumber,
      overallRisk: result.overallRisk,
      summary: result.summary,
      topRisks: result.topRisks,
      rawExcerpt: rawExcerpt?.slice(0, 50000) ?? null,
      modelUsed: process.env.OPENAI_API_KEY ? "gpt-4o-mini" : "keyword-fallback",
    });

    await db
      .update(agentRuns)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(agentRuns.id, run[0].id));

    return result;
  } catch (error) {
    await db
      .update(agentRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(agentRuns.id, run[0].id));
    throw error;
  }
}

export async function syncPricingForCompany(companyId: string) {
  const db = getDb();
  const company = await db.query.ipoCompanies.findFirst({
    where: eq(ipoCompanies.id, companyId),
    with: { filings: true, pricing: true },
  });

  if (!company?.ticker) return null;

  const prospectus424 = company.filings.find((f) => f.formType === "424B4");
  let offerPrice: number | null = company.pricing?.offerPrice ?? null;
  let offerPriceSource = company.pricing?.offerPriceSource ?? null;

  if (prospectus424?.primaryDocument && !offerPrice) {
    try {
      const html = await fetchFilingDocument(
        company.cik,
        prospectus424.accessionNumber,
        prospectus424.primaryDocument,
      );
      offerPrice = extractOfferPrice(html);
      offerPriceSource = `424B4 ${prospectus424.accessionNumber}`;
    } catch {
      // keep existing
    }
  }

  const market = getMarketProvider();
  const quote = await market.getQuote(company.ticker);

  const listingDate =
    company.listingDate ??
    (prospectus424 ? new Date(prospectus424.filedAt) : subMonths(new Date(), 3));

  const firstDay = await market.getFirstTradingDay(company.ticker, listingDate);

  let returnVsOffer: number | null = null;
  let returnVsOpen: number | null = null;

  if (quote?.price) {
    if (offerPrice) returnVsOffer = ((quote.price - offerPrice) / offerPrice) * 100;
    if (firstDay?.open)
      returnVsOpen = ((quote.price - firstDay.open) / firstDay.open) * 100;
  }

  await db
    .insert(ipoPricing)
    .values({
      companyId,
      offerPrice,
      offerPriceSource,
      openingPrice: firstDay?.open ?? null,
      openingDate: firstDay?.date ?? null,
      currentPrice: quote?.price ?? null,
      currentPriceAt: quote?.asOf ?? null,
      returnVsOffer,
      returnVsOpen,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: ipoPricing.companyId,
      set: {
        offerPrice,
        offerPriceSource,
        openingPrice: firstDay?.open ?? null,
        openingDate: firstDay?.date ?? null,
        currentPrice: quote?.price ?? null,
        currentPriceAt: quote?.asOf ?? null,
        returnVsOffer,
        returnVsOpen,
        updatedAt: new Date(),
      },
    });

  if (firstDay) {
    const history = await market.getHistorical(
      company.ticker,
      subMonths(new Date(), 6),
      new Date(),
    );

    for (const bar of history) {
      await db
        .insert(priceSnapshots)
        .values({
          companyId,
          date: bar.date,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume ?? null,
        })
        .onConflictDoNothing();
    }
  }

  if (firstDay && company.status !== "listed") {
    await db
      .update(ipoCompanies)
      .set({
        status: "listed",
        listingDate: firstDay.date,
        updatedAt: new Date(),
      })
      .where(eq(ipoCompanies.id, companyId));
  }

  return { offerPrice, openingPrice: firstDay?.open, currentPrice: quote?.price };
}

export async function syncAllRecentPricing() {
  const db = getDb();
  const sixMonthsAgo = subMonths(new Date(), 6);

  const companies = await db.query.ipoCompanies.findMany({
    where: and(
      sql`${ipoCompanies.ticker} IS NOT NULL`,
      gte(ipoCompanies.listingDate, sixMonthsAgo),
    ),
  });

  const listedWithTicker = await db.query.ipoCompanies.findMany({
    where: and(
      sql`${ipoCompanies.ticker} IS NOT NULL`,
      inArray(ipoCompanies.status, ["listed", "priced"]),
    ),
  });

  const toSync = [...companies, ...listedWithTicker];
  const unique = [...new Map(toSync.map((c) => [c.id, c])).values()];

  let synced = 0;
  for (const company of unique) {
    try {
      await syncPricingForCompany(company.id);
      synced++;
    } catch (error) {
      console.error(`Price sync failed for ${company.ticker}:`, error);
    }
  }

  return { synced, total: unique.length };
}

export async function listIpos(filters: IpoListFilters = {}) {
  const db = getDb();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const companies = await db.query.ipoCompanies.findMany({
    orderBy: [desc(ipoCompanies.updatedAt)],
    with: {
      pricing: true,
      dateEstimates: {
        orderBy: [desc(ipoDateEstimates.createdAt)],
        limit: 1,
      },
      riskAssessments: {
        orderBy: [desc(ipoRiskAssessments.createdAt)],
        limit: 1,
      },
    },
  });

  let filtered = companies;

  if (filters.status) {
    filtered = filtered.filter((c) => c.status === filters.status);
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.ticker?.toLowerCase().includes(q) ||
        c.cik.includes(q),
    );
  }

  if (filters.riskLevel) {
    filtered = filtered.filter(
      (c) => c.riskAssessments[0]?.overallRisk === filters.riskLevel,
    );
  }

  const total = filtered.length;
  const items = filtered.slice(offset, offset + pageSize);

  return { items, total, page, pageSize };
}

export async function getIpoDetail(cik: string) {
  const db = getDb();
  const padded = padCik(cik);

  const company = await db.query.ipoCompanies.findFirst({
    where: eq(ipoCompanies.cik, padded),
    with: {
      filings: { orderBy: [desc(ipoFilings.filedAt)] },
      pricing: true,
      dateEstimates: { orderBy: [desc(ipoDateEstimates.createdAt)], limit: 1 },
      riskAssessments: {
        orderBy: [desc(ipoRiskAssessments.createdAt)],
        limit: 1,
      },
      priceSnapshots: { orderBy: [desc(priceSnapshots.date)], limit: 180 },
    },
  });

  return company;
}

export async function getDashboardStats() {
  const db = getDb();
  const sixMonthsAgo = subMonths(new Date(), 6);

  const all = await db.query.ipoCompanies.findMany({
    with: { pricing: true },
  });

  const upcoming = all.filter((c) => c.status === "upcoming").length;
  const listedRecent = all.filter(
    (c) =>
      c.status === "listed" &&
      c.listingDate &&
      c.listingDate >= sixMonthsAgo,
  );

  const returns = listedRecent
    .map((c) => c.pricing?.returnVsOffer)
    .filter((r): r is number => r != null);

  const avgReturn =
    returns.length > 0
      ? returns.reduce((a, b) => a + b, 0) / returns.length
      : null;

  const topMovers = listedRecent
    .filter((c) => c.pricing?.returnVsOffer != null)
    .sort(
      (a, b) =>
        (b.pricing?.returnVsOffer ?? 0) - (a.pricing?.returnVsOffer ?? 0),
    )
    .slice(0, 5);

  return {
    upcoming,
    listedRecentCount: listedRecent.length,
    avgReturn,
    topMovers,
    upcomingIpos: all
      .filter((c) => c.status === "upcoming")
      .slice(0, 5),
    recentIpos: listedRecent.slice(0, 5),
  };
}

export async function getRecentAgentRuns(limit = 20) {
  const db = getDb();
  return db.query.agentRuns.findMany({
    orderBy: [desc(agentRuns.createdAt)],
    limit,
    with: { company: true },
  });
}
