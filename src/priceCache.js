const cache = new Map();
let updatedAt = null;

export function setCachedPrice(symbol, price, source = "unknown", at = Date.now()) {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return;
  cache.set(String(symbol || "").toUpperCase(), { price: n, source, updatedAt: at });
  updatedAt = at;
}

export function getCachedPrice(symbol) {
  return cache.get(String(symbol || "").toUpperCase()) || null;
}

export function getCachedPricesSnapshot() {
  const prices = {};
  for (const [symbol, row] of cache.entries()) prices[symbol] = row;
  return { updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null, count: cache.size, prices };
}
