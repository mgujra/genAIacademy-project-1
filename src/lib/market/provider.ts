import { PolygonMarketProvider } from "./polygon";
import type { MarketDataProvider } from "./types";
import { YahooMarketProvider } from "./yahoo";

let _provider: MarketDataProvider | null = null;

export function getMarketProvider(): MarketDataProvider {
  if (_provider) return _provider;

  const providerType = process.env.MARKET_DATA_PROVIDER ?? "yahoo";

  if (providerType === "polygon") {
    const apiKey = process.env.POLYGON_API_KEY;
    if (!apiKey) {
      throw new Error("POLYGON_API_KEY is required when MARKET_DATA_PROVIDER=polygon");
    }
    _provider = new PolygonMarketProvider(apiKey);
  } else {
    _provider = new YahooMarketProvider();
  }

  return _provider;
}
