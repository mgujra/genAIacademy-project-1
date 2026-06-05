import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/db";
import { listIpos } from "@/lib/ipo/service";

export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured", items: [], total: 0 },
      { status: 503 },
    );
  }

  const { searchParams } = request.nextUrl;
  const result = await listIpos({
    status: searchParams.get("status") ?? undefined,
    riskLevel: searchParams.get("riskLevel") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    page: Number(searchParams.get("page") ?? 1),
    pageSize: Number(searchParams.get("pageSize") ?? 20),
  });

  return NextResponse.json(result);
}
