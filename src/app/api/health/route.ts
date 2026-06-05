import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { agentRuns } from "@/db/schema";

export async function GET() {
  const health: {
    status: "ok" | "degraded";
    database: boolean;
    secUserAgent: boolean;
    openai: boolean;
    marketProvider: string;
    lastSync: {
      jobType: string;
      status: string;
      completedAt: string | null;
    } | null;
  } = {
    status: "ok",
    database: isDatabaseConfigured(),
    secUserAgent: Boolean(process.env.SEC_USER_AGENT),
    openai: Boolean(process.env.OPENAI_API_KEY),
    marketProvider: process.env.MARKET_DATA_PROVIDER ?? "yahoo",
    lastSync: null as {
      jobType: string;
      status: string;
      completedAt: string | null;
    } | null,
  };

  if (isDatabaseConfigured()) {
    try {
      const db = getDb();
      const lastRun = await db.query.agentRuns.findFirst({
        where: eq(agentRuns.jobType, "sec-filing-sync"),
        orderBy: [desc(agentRuns.createdAt)],
      });

      if (lastRun) {
        health.lastSync = {
          jobType: lastRun.jobType,
          status: lastRun.status,
          completedAt: lastRun.completedAt?.toISOString() ?? null,
        };
      }
    } catch {
      health.status = "degraded";
    }
  }

  return NextResponse.json(health);
}
