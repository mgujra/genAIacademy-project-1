export interface QuoteData {
  price: number;
  asOf: Date;
}

export interface OhlcBar {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface MarketDataProvider {
  getQuote(ticker: string): Promise<QuoteData | null>;
  getHistorical(
    ticker: string,
    startDate: Date,
    endDate: Date,
  ): Promise<OhlcBar[]>;
  getFirstTradingDay(ticker: string, afterDate: Date): Promise<OhlcBar | null>;
}
