import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/db";
import { getIpoDetail } from "@/lib/ipo/service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cik: string }> },
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { cik } = await params;
  const company = await getIpoDetail(cik);

  if (!company) {
    return NextResponse.json({ error: "IPO not found" }, { status: 404 });
  }

  return NextResponse.json(company);
}
