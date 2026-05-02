import { createPublicClient, createWalletClient, fallback, http, parseGwei } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";
import { config } from "./config.js";

export const account = privateKeyToAccount(config.privateKey.startsWith("0x") ? config.privateKey : `0x${config.privateKey}`);
export const txAccount = config.gasPrivateKey
  ? privateKeyToAccount(config.gasPrivateKey.startsWith("0x") ? config.gasPrivateKey : `0x${config.gasPrivateKey}`)
  : account;

const rpcHttpUrls = Array.from(new Set([config.rpcUrl, ...(config.rpcUrls || [])].filter(Boolean)));
const rpcTransports = rpcHttpUrls.map((url) => http(url, { timeout: 10_000, retryCount: 0 }));
const publicTransport = rpcTransports.length > 1 ? fallback(rpcTransports, { rank: true }) : rpcTransports[0];

export const publicClient = createPublicClient({
  chain: arbitrum,
  transport: publicTransport,
});

export const walletClient = createWalletClient({
  account: txAccount,
  chain: arbitrum,
  transport: http(config.rpcUrl, { timeout: 10_000, retryCount: 0 }),
});

/** Send a tx with simulation + gas cap. Returns hash or null if skipped. */
export async function safeSend({ address, abi, functionName, args, label }) {
  if (config.dryRun) {
    console.log(`[DRY] ${label} ${functionName}(${JSON.stringify(args)})`);
    return null;
  }
  try {
    // Simulate first
    const { request } = await publicClient.simulateContract({
      address,
      abi,
      functionName,
      args,
      account: txAccount,
    });
    const gasPrice = await publicClient.getGasPrice();
    const legacyCap = parseGwei(String(config.maxGasGwei));
    if (gasPrice > legacyCap) {
      console.warn(`[gas] ${label} skipped — gasPrice ${gasPrice} > cap ${legacyCap}`);
      return null;
    }
    request.maxPriorityFeePerGas = parseGwei(String(config.maxPriorityFeeGwei || 0.08));
    request.maxFeePerGas = parseGwei(String(config.maxFeePerGasGwei || config.maxGasGwei));
    const hash = await walletClient.writeContract(request);
    console.log(`[tx] ${label} sent: ${hash}`);
    return hash;
  } catch (e) {
    console.warn(`[tx] ${label} simulation/send failed: ${e.shortMessage || e.message}`);
    return null;
  }
}
