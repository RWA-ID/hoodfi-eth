import { defineChain } from "@reown/appkit/networks";

export const ROBINHOOD_CHAIN_ID = 4663;

/** The chain's own endpoint. Correct, and unusable from a browser — see below. */
export const ROBINHOOD_RPC_DIRECT = "https://rpc.mainnet.chain.robinhood.com";

/**
 * Every browser call goes through our gateway worker instead of the chain's own RPC.
 *
 * `rpc.mainnet.chain.robinhood.com` answers POST with a duplicated
 * `access-control-allow-origin: *,*`. A list is not a legal value, so the browser
 * discards the response — while the OPTIONS preflight returns a clean single `*` and
 * passes, which is what makes it read as anything but CORS. Measured 12/12 on
 * 2026-09-04, identical on desktop and mobile; `curl`, which does not enforce CORS,
 * succeeded every time and the chain answered `eth_chainId` with 0x1237.
 *
 * It broke every browser read and write on this site, not only wallet actions: the
 * name counter, the price, the mint, the chain switch. The error people actually saw
 * told them to add Robinhood Chain to their wallet by hand, which fixes nothing.
 *
 * Server-to-server has no CORS, so the worker forwards the call and answers with one
 * clean header. Point NEXT_PUBLIC_ROBINHOOD_RPC at ROBINHOOD_RPC_DIRECT to go straight
 * to the chain again once the upstream header is fixed; that is the whole rollback.
 */
export const ROBINHOOD_RPC =
  process.env.NEXT_PUBLIC_ROBINHOOD_RPC ??
  "https://hoodfi-gateway.dmpay.workers.dev/rpc";

export const ROBINHOOD_EXPLORER = "https://robinhoodchain.blockscout.com";

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
});
