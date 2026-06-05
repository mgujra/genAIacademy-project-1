"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

interface PricePoint {
  date: Date | string;
  close: number;
}

interface PriceChartProps {
  snapshots: PricePoint[];
  offerPrice?: number | null;
  openingPrice?: number | null;
}

export function PriceChart({
  snapshots,
  offerPrice,
  openingPrice,
}: PriceChartProps) {
  const data = [...snapshots]
    .reverse()
    .map((s) => ({
      date: format(new Date(s.date), "MMM d"),
      close: s.close,
    }));

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-sm text-zinc-500 dark:border-zinc-700">
        No price history available yet
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            domain={["auto", "auto"]}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            formatter={(value) => [formatCurrency(Number(value)), "Close"]}
          />
          {offerPrice ? (
            <ReferenceLine
              y={offerPrice}
              stroke="#10b981"
              strokeDasharray="4 4"
              label={{ value: "Offer", position: "insideTopRight", fontSize: 11 }}
            />
          ) : null}
          {openingPrice ? (
            <ReferenceLine
              y={openingPrice}
              stroke="#3b82f6"
              strokeDasharray="4 4"
              label={{ value: "Open", position: "insideBottomRight", fontSize: 11 }}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="close"
            stroke="#059669"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
