import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { isDatabaseConfigured } from "@/db";
import { getIpoDetail } from "@/lib/ipo/service";
import { cikToUrl, formatCurrency, formatPercent } from "@/lib/utils";
import { StatusBadge } from "@/components/ipo/status-badge";
import { AgentInsights } from "@/components/ipo/agent-insights";
import { FilingTimeline } from "@/components/ipo/filing-timeline";
import { PriceChart } from "@/components/ipo/price-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IpoChat } from "./ipo-chat";
import { AnalyzeButton } from "./analyze-button";

export default async function IpoDetailPage({
  params,
}: {
  params: Promise<{ cik: string }>;
}) {
  const { cik } = await params;

  if (!isDatabaseConfigured()) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <p className="text-zinc-500">Database not configured.</p>
      </div>
    );
  }

  const company = await getIpoDetail(cik);
  if (!company) notFound();

  const dateEstimate = company.dateEstimates[0];
  const riskAssessment = company.riskAssessments[0];
  const pricing = company.pricing;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link
        href="/ipos"
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" /> Back to IPOs
      </Link>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{company.name}</h1>
            <StatusBadge status={company.status} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
            <span>{company.ticker ?? "Pre-ticker"}</span>
            <span>·</span>
            <span>CIK {company.cik}</span>
            {company.exchange ? (
              <>
                <span>·</span>
                <span>{company.exchange}</span>
              </>
            ) : null}
            <a
              href={cikToUrl(company.cik)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-700 hover:underline dark:text-emerald-400"
            >
              SEC EDGAR <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
        <AnalyzeButton cik={company.cik} />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-500">Offer Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(pricing?.offerPrice)}</div>
            {pricing?.offerPriceSource ? (
              <p className="mt-1 text-xs text-zinc-500">{pricing.offerPriceSource}</p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-500">Opening Day</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(pricing?.openingPrice)}</div>
            {pricing?.openingDate ? (
              <p className="mt-1 text-xs text-zinc-500">
                {format(pricing.openingDate, "MMM d, yyyy")}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-500">Current Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(pricing?.currentPrice)}</div>
            {pricing?.currentPriceAt ? (
              <p className="mt-1 text-xs text-zinc-500">
                As of {format(pricing.currentPriceAt, "MMM d, h:mm a")}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-500">Return vs Offer</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                (pricing?.returnVsOffer ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {formatPercent(pricing?.returnVsOffer)}
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              vs open: {formatPercent(pricing?.returnVsOpen)}
            </p>
          </CardContent>
        </Card>
      </div>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Agent Insights</h2>
        <AgentInsights
          dateEstimate={dateEstimate}
          riskAssessment={riskAssessment}
        />
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Price Performance (6 months)</h2>
        <Card>
          <CardContent className="pt-6">
            <PriceChart
              snapshots={company.priceSnapshots}
              offerPrice={pricing?.offerPrice}
              openingPrice={pricing?.openingPrice}
            />
          </CardContent>
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">SEC Filing Timeline</h2>
        <FilingTimeline filings={company.filings} />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Ask the Agent</h2>
        <IpoChat cik={company.cik} companyName={company.name} />
      </section>
    </div>
  );
}
