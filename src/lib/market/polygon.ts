import type { MarketDataProvider, OhlcBar, QuoteData } from "./types";

const POLYGON_BASE = "https://api.polygon.io";

export class PolygonMarketProvider implements MarketDataProvider {
  constructor(private apiKey: string) {}

  async getQuote(ticker: string): Promise<QuoteData | null> {
    try {
      const url = `${POLYGON_BASE}/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${this.apiKey}`;
      const response = await fetch(url, { next: { revalidate: 300 } });
      if (!response.ok) return null;

      const data = await response.json();
      const bar = data.results?.[0];
      if (!bar?.c) return null;

      return {
        price: bar.c,
        asOf: new Date(bar.t),
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
      const from = startDate.toISOString().slice(0, 10);
      const to = endDate.toISOString().slice(0, 10);
      const url = `${POLYGON_BASE}/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&apiKey=${this.apiKey}`;
      const response = await fetch(url, { next: { revalidate: 3600 } });
      if (!response.ok) return [];

      const data = await response.json();
      return (data.results ?? []).map(
        (bar: { t: number; o: number; h: number; l: number; c: number; v?: number }) => ({
          date: new Date(bar.t),
          open: bar.o,
          high: bar.h,
          low: bar.l,
          close: bar.c,
          volume: bar.v,
        }),
      );
    } catch {
      return [];
    }
  }

  async getFirstTradingDay(
    ticker: string,
    afterDate: Date,
  ): Promise<OhlcBar | null> {
    const bars = await this.getHistorical(ticker, afterDate, new Date());
    return bars.find((b) => b.date >= afterDate) ?? bars[0] ?? null;
  }
}
