import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/db";
import { inngest } from "@/inngest/client";

export async function POST() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  await inngest.send({ name: "inngest/scheduled", data: {} });

  const { syncSecFilings } = await import("@/lib/ipo/service");

  try {
    const result = await syncSecFilings(90);
    return NextResponse.json({ message: "Sync completed", result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Sync failed",
      },
      { status: 500 },
    );
  }
}
