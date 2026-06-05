import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { ipoCompanies } from "@/db/schema";
import { inngest } from "@/inngest/client";
import { padCik } from "@/lib/utils";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ cik: string }> },
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { cik } = await params;
  const db = getDb();
  const company = await db.query.ipoCompanies.findFirst({
    where: eq(ipoCompanies.cik, padCik(cik)),
  });

  if (!company) {
    return NextResponse.json({ error: "IPO not found" }, { status: 404 });
  }

  await inngest.send({
    name: "ipo/analyze.manual",
    data: { companyId: company.id },
  });

  return NextResponse.json({
    message: "Analysis queued",
    companyId: company.id,
  });
}
