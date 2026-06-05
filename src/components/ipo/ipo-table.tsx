import Link from "next/link";
import { format } from "date-fns";
import { StatusBadge } from "./status-badge";
import { RiskBadge } from "./risk-badge";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { IpoCompany, IpoDateEstimate, IpoPricing, IpoRiskAssessment } from "@/db/schema";

export type IpoListItem = IpoCompany & {
  pricing: IpoPricing | null;
  dateEstimates: IpoDateEstimate[];
  riskAssessments: IpoRiskAssessment[];
};

export function IpoTable({ items }: { items: IpoListItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center text-zinc-500 dark:border-zinc-700">
        <p className="text-lg font-medium">No IPOs found</p>
        <p className="mt-2 text-sm">
          Run a SEC sync to populate IPO data, or adjust your filters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
          <tr>
            <th className="px-4 py-3 font-medium">Company</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Target IPO Date</th>
            <th className="px-4 py-3 font-medium">Risk</th>
            <th className="px-4 py-3 font-medium">Offer</th>
            <th className="px-4 py-3 font-medium">Open</th>
            <th className="px-4 py-3 font-medium">Current</th>
            <th className="px-4 py-3 font-medium">Return</th>
          </tr>
        </thead>
        <tbody>
          {items.map((ipo) => {
            const estimate = ipo.dateEstimates[0];
            const risk = ipo.riskAssessments[0];
            const pricing = ipo.pricing;

            return (
              <tr
                key={ipo.id}
                className="border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/ipos/${ipo.cik}`}
                    className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    {ipo.name}
                  </Link>
                  <div className="text-xs text-zinc-500">
                    {ipo.ticker ?? "Pre-ticker"} · CIK {ipo.cik}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={ipo.status} />
                </td>
                <td className="px-4 py-3">
                  {estimate?.targetDate ? (
                    <div>
                      <div>{format(estimate.targetDate, "MMM d, yyyy")}</div>
                      <div className="text-xs text-zinc-500">
                        {Math.round((estimate.confidence ?? 0) * 100)}% confidence
                      </div>
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  {risk ? <RiskBadge level={risk.overallRisk} /> : "—"}
                </td>
                <td className="px-4 py-3">{formatCurrency(pricing?.offerPrice)}</td>
                <td className="px-4 py-3">{formatCurrency(pricing?.openingPrice)}</td>
                <td className="px-4 py-3">{formatCurrency(pricing?.currentPrice)}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      (pricing?.returnVsOffer ?? 0) >= 0
                        ? "text-emerald-600"
                        : "text-red-600"
                    }
                  >
                    {formatPercent(pricing?.returnVsOffer)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
