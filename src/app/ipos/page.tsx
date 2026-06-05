import { Suspense } from "react";
import { IpoListClient } from "./ipo-list-client";
import { isDatabaseConfigured } from "@/db";
import { listIpos } from "@/lib/ipo/service";

async function loadIpoList(filters: {
  status?: string;
  search?: string;
  riskLevel?: string;
}) {
  if (!isDatabaseConfigured()) {
    return { items: [], total: 0, dbConfigured: false, error: false };
  }

  try {
    const { items, total } = await listIpos({ ...filters, pageSize: 50 });
    return { items, total, dbConfigured: true, error: false };
  } catch {
    return { items: [], total: 0, dbConfigured: true, error: true };
  }
}

async function IpoListData({
  status,
  search,
  riskLevel,
}: {
  status?: string;
  search?: string;
  riskLevel?: string;
}) {
  const data = await loadIpoList({ status, search, riskLevel });

  return (
    <IpoListClient
      initialItems={data.items}
      total={data.total}
      dbConfigured={data.dbConfigured}
      error={data.error}
      initialFilters={{ status, search, riskLevel }}
    />
  );
}

export default async function IposPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; riskLevel?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">IPO Directory</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          All known IPOs from SEC filings with agent-curated dates and risk scores.
        </p>
      </div>
      <Suspense fallback={<div className="text-sm text-zinc-500">Loading IPOs...</div>}>
        <IpoListData
          status={params.status}
          search={params.search}
          riskLevel={params.riskLevel}
        />
      </Suspense>
    </div>
  );
}
