"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { IpoTable, type IpoListItem } from "@/components/ipo/ipo-table";
import { Button } from "@/components/ui/button";

interface IpoListClientProps {
  initialItems: IpoListItem[];
  total: number;
  dbConfigured: boolean;
  error?: boolean;
  errorMessage?: string | null;
  initialFilters?: {
    status?: string;
    search?: string;
    riskLevel?: string;
  };
}

export function IpoListClient({
  initialItems,
  total,
  dbConfigured,
  error,
  errorMessage,
  initialFilters,
}: IpoListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialFilters?.search ?? "");
  const [syncing, setSyncing] = useState(false);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/ipos?${params.toString()}`);
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch("/api/sync", { method: "POST" });
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  if (!dbConfigured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        Database not configured. Set DATABASE_URL and run migrations.
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        <p className="font-medium">Failed to load IPO data.</p>
        <p className="mt-2">
          {errorMessage ?? "Check DATABASE_URL in .env.local and restart the dev server."}
        </p>
        <p className="mt-2 text-xs">
          Supabase tip: use the transaction pooler URL (port 6543) in DATABASE_URL for the app.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by name, ticker, or CIK..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") updateFilter("search", search);
            }}
            className="h-10 w-full rounded-md border border-zinc-300 bg-white pl-10 pr-4 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={initialFilters?.status ?? ""}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">All statuses</option>
            <option value="upcoming">Upcoming</option>
            <option value="priced">Priced</option>
            <option value="listed">Listed</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
          <select
            value={initialFilters?.riskLevel ?? ""}
            onChange={(e) => updateFilter("riskLevel", e.target.value)}
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">All risk levels</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            {syncing ? "Syncing..." : "Sync SEC Data"}
          </Button>
        </div>
      </div>

      <p className="text-sm text-zinc-500">{total} IPO{total !== 1 ? "s" : ""} found</p>
      <IpoTable items={initialItems} />
    </div>
  );
}
