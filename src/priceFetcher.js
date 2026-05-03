import { getMarketSnapshot } from "./marketData.js";
import { setCachedPrice } from "./priceCache.js";

function quoteSymbol(symbol) {
  const s = String(symbol || "").toUpperCase();
  if (s.endsWith("USDT")) return s;
  if (s.endsWith("USD")) return `${s.slice(0, -3)}USDT`;
  return `${s}USDT`;
}

export async function refreshPriceCache() {
  const symbols = (getMarketSnapshot()?.markets || []).map((m) => String(m?.symbol || "").toUpperCase()).filter(Boolean);
  const unique = Array.from(new Set(symbols));
  if (!unique.length) return { symbols: 0, mapped: 0 };

  let mapped = 0;
  const YAHOO_TICKERS = {
    EURUSD: "EURUSD=X", GBPUSD: "GBPUSD=X", USDJPY: "JPY=X", USDCHF: "CHF=X",
    AUDUSD: "AUDUSD=X", USDCAD: "CAD=X", NZDUSD: "NZDUSD=X", EURGBP: "EURGBP=X",
    EURJPY: "EURJPY=X", GBPJPY: "GBPJPY=X", XAUUSD: "GC=F", XAGUSD: "SI=F",
    WTIUSD: "CL=F", BRENTUSD: "BZ=F", SPX500: "^GSPC", NAS100: "^NDX",
    DJI30: "^DJI", GER40: "^GDAXI",
  };

  const fetchYahoo = async (symbol) => {
    const ticker = YAHOO_TICKERS[symbol];
    if (!ticker) return null;
    try {
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = await res.json();
      const price = Number(json?.quoteResponse?.result?.[0]?.regularMarketPrice || 0);
      return Number.isFinite(price) && price > 0 ? price : null;
    } catch {
      return null;
    }
  };

  const STOOQ_TICKERS = {
    USDJPY: "usdjpy", USDCHF: "usdchf", USDCAD: "usdcad", NZDUSD: "nzdusd",
    EURGBP: "eurgbp", EURJPY: "eurjpy", GBPJPY: "gbpjpy", XAUUSD: "xauusd",
    XAGUSD: "xagusd", WTIUSD: "cl.f", BRENTUSD: "brent.f", SPX500: "^spx",
    NAS100: "^ndq", DJI30: "^dji", GER40: "^dax",
  };

  const fetchStooq = async (symbol) => {
    const t = STOOQ_TICKERS[symbol];
    if (!t) return null;
    try {
      const res = await fetch(`https://stooq.com/q/l/?s=${encodeURIComponent(t)}&f=sd2t2ohlcv&h&e=csv`);
      if (!res.ok) return null;
      const text = await res.text();
      const lines = text.trim().split("\n");
      if (lines.length < 2) return null;
      const parts = lines[1].split(",");
      const close = Number(parts[6] || 0);
      return Number.isFinite(close) && close > 0 ? close : null;
    } catch {
      return null;
    }
  };

  await Promise.all(unique.map(async (symbol) => {
    try {
      const pair = quoteSymbol(symbol);
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(pair)}`);
      if (res.ok) {
        const json = await res.json();
        const price = Number(json?.price || 0);
        if (Number.isFinite(price) && price > 0) {
          setCachedPrice(symbol, price, "binance");
          mapped += 1;
          return;
        }
      }
    } catch {}

    const yahooPrice = await fetchYahoo(symbol);
    if (yahooPrice) {
      setCachedPrice(symbol, yahooPrice, "yahoo");
      mapped += 1;
      return;
    }

    const stooqPrice = await fetchStooq(symbol);
    if (stooqPrice) {
      setCachedPrice(symbol, stooqPrice, "stooq");
      mapped += 1;
    }
  }));
  return { symbols: unique.length, mapped };
}
