import Link from "next/link";
import { ArrowRight, TrendingUp, Calendar, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isDatabaseConfigured } from "@/db";
import { getDashboardStats } from "@/lib/ipo/service";
import { formatPercent } from "@/lib/utils";
import { StatusBadge } from "@/components/ipo/status-badge";

async function getStats() {
  if (!isDatabaseConfigured()) return null;
  try {
    return await getDashboardStats();
  } catch (error) {
    console.error("[dashboard] Failed to load stats:", error);
    return null;
  }
}

export default async function DashboardPage() {
  const stats = await getStats();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">IPO Dashboard</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Track upcoming IPOs, agent-curated dates, and 6-month performance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/ipos">Browse IPOs</Link>
          </Button>
          <Button asChild>
            <Link href="/agent">Agent Activity</Link>
          </Button>
        </div>
      </div>

      {!isDatabaseConfigured() ? (
        <Card>
          <CardHeader>
            <CardTitle>Setup Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <p>Configure <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">DATABASE_URL</code> and <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">SEC_USER_AGENT</code> in your environment.</p>
            <p>Then run <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">npm run db:push</code> and <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">npm run seed</code> to populate IPO data.</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Upcoming IPOs</CardTitle>
            <Calendar className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.upcoming ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Listed (6 mo)</CardTitle>
            <TrendingUp className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.listedRecentCount ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Avg Return vs Offer</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">
              {formatPercent(stats?.avgReturn)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Agent Status</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">Background sync active</div>
            <p className="mt-1 text-xs text-zinc-500">SEC filings every 6h · Prices hourly</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Upcoming IPOs</h2>
            <Link href="/ipos?status=upcoming" className="flex items-center gap-1 text-sm text-emerald-700 hover:underline dark:text-emerald-400">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {(stats?.upcomingIpos ?? []).map((ipo) => (
              <Link
                key={ipo.id}
                href={`/ipos/${ipo.cik}`}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              >
                <div>
                  <div className="font-medium">{ipo.name}</div>
                  <div className="text-xs text-zinc-500">{ipo.ticker ?? "Pre-ticker"}</div>
                </div>
                <StatusBadge status={ipo.status} />
              </Link>
            ))}
            {(stats?.upcomingIpos ?? []).length === 0 ? (
              <p className="text-sm text-zinc-500">No upcoming IPOs synced yet.</p>
            ) : null}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Top Movers (6 months)</h2>
            <Link href="/ipos?status=listed" className="flex items-center gap-1 text-sm text-emerald-700 hover:underline dark:text-emerald-400">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {(stats?.topMovers ?? []).map((ipo) => (
              <Link
                key={ipo.id}
                href={`/ipos/${ipo.cik}`}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              >
                <div>
                  <div className="font-medium">{ipo.name}</div>
                  <div className="text-xs text-zinc-500">{ipo.ticker}</div>
                </div>
                <span className="font-semibold text-emerald-600">
                  {formatPercent(ipo.pricing?.returnVsOffer)}
                </span>
              </Link>
            ))}
            {(stats?.topMovers ?? []).length === 0 ? (
              <p className="text-sm text-zinc-500">No performance data yet.</p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
