/**
 * Wikicious Backend Server
 * Serves the REST API for the frontend (markets, AI bots, health, etc.)
 * Runs independently from the keeper — deploy on the same VPS or separately.
 */
import "dotenv/config";
import { startBackendServer } from "./backend.js";
import { refreshMarketSnapshot } from "./marketData.js";
import { refreshPriceCache } from "./priceFetcher.js";
import { pushGuardianPrices } from "./pricePusher.js";
import { runtime, pushError } from "./state.js";
import { alert } from "./alerts.js";
import { log } from "./logger.js";

async function main() {
  log("info", "Wikicious backend server starting…");
  startBackendServer();

  // Keep market data fresh in background
  await refreshMarketSnapshot(true).catch((e) => {
    pushError("marketData.initial", e);
    log("warn", "Initial market snapshot failed:", e?.message);
  });

  setInterval(async () => {
    try {
      await refreshMarketSnapshot();
    } catch (e) {
      pushError("marketData.refresh", e);
    }
  }, Number(process.env.MARKET_REFRESH_MS || 5000));

  setInterval(async () => {
    try {
      await refreshPriceCache();
    } catch (e) {
      pushError("priceCache.refresh", e);
    }
  }, Number(process.env.PRICE_FETCH_INTERVAL_MS || 15000));

  if (process.env.PRICE_PUSH_ENABLED === "true") {
    setInterval(async () => {
      try {
        await pushGuardianPrices(Number(process.env.PRICE_PUSH_BATCH_SIZE || 8));
      } catch (e) {
        pushError("pricePush.refresh", e);
      }
    }, Number(process.env.PRICE_PUSH_INTERVAL_MS || 30000));
  }

  log("info", `Backend API listening on port ${process.env.API_PORT || 8787}`);
}

process.on("uncaughtException", (e) => {
  pushError("uncaughtException", e);
  alert("error", "uncaughtException", e.stack || e.message);
});
process.on("unhandledRejection", (e) => {
  pushError("unhandledRejection", e);
  alert("error", "unhandledRejection", String(e));
});

main().catch((e) => {
  pushError("main", e);
  alert("error", "backend crashed", e?.stack || e?.message || String(e));
});
