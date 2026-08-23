import { http, fallback } from "wagmi";
import { mainnet } from "@reown/appkit/networks";
import type { AppKitNetwork } from "@reown/appkit/networks";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createPublicClient, defineChain as viemDefineChain } from "viem";
import { mainnet as viemMainnet } from "viem/chains";
import {
  MULTICALL3_ADDRESS,
  robinhoodChain,
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_RPC,
  ROBINHOOD_EXPLORER,
} from "./chains";

/**
 * Reown AppKit + wagmi config — Ethereum mainnet (donations) + Robinhood Chain
 * (claims and mints). Alchemy RPC when a key is configured, always backed by a
 * CORS-safe public fallback (publicnode; never eth.llamarpc browser-side).
 */
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

export const PUBLIC_RPC = "https://ethereum-rpc.publicnode.com";
export const RPC_URL = ALCHEMY_KEY
  ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
  : PUBLIC_RPC;

export const projectId =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "43bdd1b8c477ac4d4a4264a14a8472f8";

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [mainnet, robinhoodChain];

const mainnetTransport = ALCHEMY_KEY
  ? fallback([http(RPC_URL), http(PUBLIC_RPC)])
  : http(PUBLIC_RPC);

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  transports: {
    [mainnet.id]: mainnetTransport,
    [ROBINHOOD_CHAIN_ID]: http(ROBINHOOD_RPC),
  },
  /**
   * True even though there is no server, because a static export prerenders every page
   * at build time and that HTML is the "server" render as far as hydration is concerned.
   *
   * With `ssr: false` wagmi reads its stored connection synchronously during the first
   * client render, so a returning visitor's first paint says "connected" while the
   * prerendered HTML says "not connected". React throws hydration error #418 and
   * re-renders the tree to recover. Observed in production on /build, in the console of
   * a real session: `Minified React error #418 … args[]=text`.
   *
   * `ssr: true` defers the stored state to after mount, so both renders agree and the
   * connection is restored by `reconnectOnMount` instead. The connected UI arrives a tick
   * later either way — the difference is that it arrives without a thrown error.
   */
  ssr: true,
});

export const config = wagmiAdapter.wagmiConfig;

/** Standalone mainnet client for reads that don't depend on the wallet. */
export const publicClient = createPublicClient({
  chain: viemMainnet,
  transport: http(RPC_URL),
});

const viemRobinhood = viemDefineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [ROBINHOOD_RPC] } },
  blockExplorers: { default: { name: "Blockscout", url: ROBINHOOD_EXPLORER } },
  // Same reason as in chains.ts: without this viem throws rather than batching.
  contracts: { multicall3: { address: MULTICALL3_ADDRESS } },
});

/** Standalone Robinhood Chain client for availability checks pre-connect. */
export const l2Client = createPublicClient({
  chain: viemRobinhood,
  transport: http(ROBINHOOD_RPC),
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
