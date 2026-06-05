import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/db";
import {
  applyBaselineEstimatesToAll,
  backfillCompanyData,
} from "@/lib/ipo/service";

export const maxDuration = 300;

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const limit = Number(body.limit ?? 10);

  const baselineCount = await applyBaselineEstimatesToAll();
  const summary = await backfillCompanyData({ limit, onlyMissing: true });

  return NextResponse.json({
    message: "Backfill batch complete",
    baselineCount,
    ...summary,
  });
}
