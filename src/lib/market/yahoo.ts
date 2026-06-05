import type { MarketDataProvider, OhlcBar, QuoteData } from "./types";

const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";
const YAHOO_QUOTE = "https://query1.finance.yahoo.com/v7/finance/quote";

export class YahooMarketProvider implements MarketDataProvider {
  async getQuote(ticker: string): Promise<QuoteData | null> {
    try {
      const params = new URLSearchParams({ symbols: ticker });
      const response = await fetch(`${YAHOO_QUOTE}?${params}`, {
        headers: { "User-Agent": "IPOTracker/1.0" },
        next: { revalidate: 300 },
      });

      if (!response.ok) return null;

      const data = await response.json();
      const quote = data.quoteResponse?.result?.[0];
      if (!quote?.regularMarketPrice) return null;

      return {
        price: quote.regularMarketPrice,
        asOf: new Date(
          (quote.regularMarketTime ?? Date.now() / 1000) * 1000,
        ),
      };
    } catch {
      return null;
    }
  }

  async getHistorical(
    ticker: string,
    startDate: Date,
    endDate: Date,
  ): Promise<OhlcBar[]> {
    try {
      const period1 = Math.floor(startDate.getTime() / 1000);
      const period2 = Math.floor(endDate.getTime() / 1000);
      const params = new URLSearchParams({
        period1: String(period1),
        period2: String(period2),
        interval: "1d",
        events: "history",
      });

      const response = await fetch(
        `${YAHOO_CHART}/${encodeURIComponent(ticker)}?${params}`,
        {
          headers: { "User-Agent": "IPOTracker/1.0" },
          next: { revalidate: 3600 },
        },
      );

      if (!response.ok) return [];

      const data = await response.json();
      const result = data.chart?.result?.[0];
      const timestamps: number[] = result?.timestamp ?? [];
      const quote = result?.indicators?.quote?.[0];

      if (!quote) return [];

      return timestamps
        .map((ts, i) => ({
          date: new Date(ts * 1000),
          open: quote.open?.[i] ?? 0,
          high: quote.high?.[i] ?? 0,
          low: quote.low?.[i] ?? 0,
          close: quote.close?.[i] ?? 0,
          volume: quote.volume?.[i] ?? undefined,
        }))
        .filter((bar) => bar.close > 0);
    } catch {
      return [];
    }
  }

  async getFirstTradingDay(
    ticker: string,
    afterDate: Date,
  ): Promise<OhlcBar | null> {
    const end = new Date();
    const bars = await this.getHistorical(ticker, afterDate, end);
    return bars.find((b) => b.date >= afterDate) ?? bars[0] ?? null;
  }
}
