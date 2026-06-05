import { format } from "date-fns";
import { ExternalLink } from "lucide-react";
import type { IpoFiling } from "@/db/schema";

export function FilingTimeline({ filings }: { filings: IpoFiling[] }) {
  if (filings.length === 0) {
    return <p className="text-sm text-zinc-500">No filings recorded yet.</p>;
  }

  return (
    <div className="space-y-3">
      {filings.map((filing) => (
        <div
          key={filing.id}
          className="flex items-start justify-between gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-semibold dark:bg-zinc-800">
                {filing.formType}
              </span>
              <span className="text-sm text-zinc-500">
                {format(filing.filedAt, "MMM d, yyyy")}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">{filing.accessionNumber}</p>
          </div>
          {filing.documentUrl ? (
            <a
              href={filing.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-emerald-700 hover:underline dark:text-emerald-400"
            >
              SEC <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      ))}
    </div>
  );
}
