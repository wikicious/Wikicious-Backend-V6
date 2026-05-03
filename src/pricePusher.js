import { CONTRACTS } from "./contracts.js";
import { safeSend } from "./chain.js";
import { getMarketSnapshot } from "./marketData.js";
import { getCachedPrice } from "./priceCache.js";

const ORACLE_GUARDIAN_ABI = [
  {
    type: "function",
    name: "submitGuardianPrice",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "price", type: "uint256" },
    ],
    outputs: [],
  },
];

const lastPushed = new Map();

function to1e18(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return BigInt(Math.round(n * 1e8)) * 10n ** 10n;
}

export async function pushGuardianPrices(limit = 8) {
  const markets = getMarketSnapshot()?.markets || [];
  let pushed = 0;
  for (const m of markets) {
    if (pushed >= limit) break;
    const symbol = String(m?.symbol || "").toUpperCase();
    const row = getCachedPrice(symbol);
    if (!row?.price) continue;
    const scaled = to1e18(row.price);
    if (!scaled) continue;
    const previous = lastPushed.get(m.marketId);
    if (previous === scaled) continue;
    const hash = await safeSend({
      address: CONTRACTS.WikiOracle,
      abi: ORACLE_GUARDIAN_ABI,
      functionName: "submitGuardianPrice",
      args: [m.marketId, scaled],
      label: `guardian-price-${symbol}`,
    });
    if (hash) {
      lastPushed.set(m.marketId, scaled);
      pushed += 1;
    }
  }
  return { pushed, markets: markets.length };
}
