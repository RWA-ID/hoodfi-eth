import { defineChain } from "@reown/appkit/networks";

export const ROBINHOOD_CHAIN_ID = 4663;
export const ROBINHOOD_RPC = "https://rpc.mainnet.chain.robinhood.com";
export const ROBINHOOD_EXPLORER = "https://robinhoodchain.blockscout.com";

/** Deployed on Robinhood Chain at the address it uses on every chain that has it. */
export const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;

/** Robinhood Chain (Arbitrum Orbit L2, mainnet since 2026-07-01). ETH gas. */
export const robinhoodChain = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  caipNetworkId: `eip155:${ROBINHOOD_CHAIN_ID}`,
  chainNamespace: "eip155",
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [ROBINHOOD_RPC] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: ROBINHOOD_EXPLORER },
  },
  /**
   * Multicall3, at the canonical CREATE2 address it has on every chain that has it.
   *
   * Load-bearing, not an optimisation. viem REFUSES to batch through a contract the
   * chain definition does not declare — it throws ChainDoesNotSupportContract rather
   * than falling back to sequential reads. Every `client.multicall` in this app then
   * fails, and since the failure lands in the same catch as a network error it surfaces
   * as "couldn't reach Robinhood Chain", which sends you looking at the RPC.
   *
   * The site never hit this because its reads are sequential; this app batches.
   */
  contracts: {
    multicall3: { address: MULTICALL3_ADDRESS },
  },
});
