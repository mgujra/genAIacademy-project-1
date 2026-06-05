import { format } from "date-fns";
import { RiskBadge } from "./risk-badge";
import type { IpoDateEstimate, IpoRiskAssessment } from "@/db/schema";

export function AgentInsights({
  dateEstimate,
  riskAssessment,
}: {
  dateEstimate?: IpoDateEstimate | null;
  riskAssessment?: IpoRiskAssessment | null;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h3 className="font-semibold">Curated IPO Date</h3>
        <p className="mt-1 text-xs text-zinc-500">Agent-curated from SEC filings</p>
        {dateEstimate ? (
          <div className="mt-4 space-y-3">
            <div className="text-2xl font-bold">
              {dateEstimate.targetDate
                ? format(dateEstimate.targetDate, "MMMM d, yyyy")
                : "Date not yet determined"}
            </div>
            <div className="text-sm">
              Confidence: {Math.round((dateEstimate.confidence ?? 0) * 100)}%
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {dateEstimate.reasoning}
            </p>
            {dateEstimate.sourceFilingIds &&
            Array.isArray(dateEstimate.sourceFilingIds) &&
            dateEstimate.sourceFilingIds.length > 0 ? (
              <div className="text-xs text-zinc-500">
                Sources: {dateEstimate.sourceFilingIds.join(", ")}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">
            Date curation pending. Trigger agent analysis to generate.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h3 className="font-semibold">Risk Assessment</h3>
        <p className="mt-1 text-xs text-zinc-500">Based on filed prospectus</p>
        {riskAssessment ? (
          <div className="mt-4 space-y-4">
            <RiskBadge level={riskAssessment.overallRisk} />
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {riskAssessment.summary}
            </p>
            {riskAssessment.topRisks && riskAssessment.topRisks.length > 0 ? (
              <ul className="space-y-2">
                {riskAssessment.topRisks.slice(0, 5).map((risk, i) => (
                  <li
                    key={i}
                    className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900"
                  >
                    <div className="font-medium">{risk.title}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {risk.category} · {risk.severity}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">
            Risk analysis pending. Requires S-1 or 424B4 filing.
          </p>
        )}
      </div>
    </div>
  );
}
