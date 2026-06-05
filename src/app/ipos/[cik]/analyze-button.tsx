"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AnalyzeButton({ cik }: { cik: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleAnalyze() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/agent/analyze/${cik}`, { method: "POST" });
      const data = await res.json();
      setMessage(res.ok ? "Analysis queued" : data.error ?? "Failed");
    } catch {
      setMessage("Failed to queue analysis");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleAnalyze} disabled={loading} variant="outline">
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Queuing..." : "Re-run Agent"}
      </Button>
      {message ? <span className="text-xs text-zinc-500">{message}</span> : null}
    </div>
  );
}
