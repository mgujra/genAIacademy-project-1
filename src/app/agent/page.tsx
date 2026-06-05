import { format } from "date-fns";
import { isDatabaseConfigured } from "@/db";
import { getRecentAgentRuns } from "@/lib/ipo/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const statusVariant = {
  completed: "success" as const,
  running: "warning" as const,
  failed: "danger" as const,
  pending: "secondary" as const,
};

export default async function AgentPage() {
  let runs: Awaited<ReturnType<typeof getRecentAgentRuns>> = [];

  if (isDatabaseConfigured()) {
    try {
      runs = await getRecentAgentRuns(30);
    } catch {
      runs = [];
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Agent Activity</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Background jobs that sync SEC filings, curate IPO dates, analyze prospectus risks, and track prices.
        </p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-zinc-500">SEC Filing Sync</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">Every 6 hours — discovers S-1, F-1, 424B4, EFFECT filings</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-zinc-500">Date Curator</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">Triggered on new filings — infers target IPO date from SEC documents</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-zinc-500">Price Sync</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">Hourly — updates offer, opening, and current prices for recent IPOs</CardContent>
        </Card>
      </div>

      {!isDatabaseConfigured() ? (
        <p className="text-sm text-zinc-500">Database not configured.</p>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <div
              key={run.id}
              className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div>
                <div className="font-medium">{run.jobType}</div>
                <div className="text-xs text-zinc-500">
                  {format(run.createdAt, "MMM d, yyyy h:mm a")}
                  {run.company?.name ? ` · ${run.company.name}` : ""}
                </div>
                {run.error ? (
                  <p className="mt-1 text-xs text-red-600">{run.error}</p>
                ) : null}
              </div>
              <Badge variant={statusVariant[run.status as keyof typeof statusVariant] ?? "outline"}>
                {run.status}
              </Badge>
            </div>
          ))}
          {runs.length === 0 ? (
            <p className="text-sm text-zinc-500">No agent runs yet. Trigger a SEC sync to start.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
