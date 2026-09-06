"use client";

import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { robinhoodChain, ROBINHOOD_CHAIN_ID } from "@/lib/chains";
import { config, networks, projectId, wagmiAdapter } from "@/lib/wagmi";
import { SITE } from "@/lib/site";

/**
 * wagmi (via Reown AppKit adapter) + react-query. createAppKit mounts the
 * connect modal once at module load; open it with useAppKit().open().
 * Robinhood Wallet + MetaMask are surfaced first in the modal.
 */
createAppKit({
  adapters: [wagmiAdapter],
  networks,
  // Robinhood Chain, not mainnet — copied from the site originally, where mainnet is
  // right because donations live there. Everything in THIS app is on 4663: reading
  // names, paying, writing the contenthash. Defaulting to mainnet meant every session
  // opened on the wrong chain and then needed a switch, and a WalletConnect session
  // approved for eip155:1 alone has nothing to switch within — `requestedChains` comes
  // back empty and the switch quietly fails. Starting on the right chain removes the
  // step rather than handling it.
  defaultNetwork: robinhoodChain,
  projectId,
  metadata: {
    name: SITE.name,
    description: SITE.description,
    url: SITE.url,
    /*
     * A PNG, not the SVG this used to point at.
     *
     * This is the icon the wallet draws beside "do you want to sign this", and
     * the prompt was rendering with no mark on it at all. `app/icon.svg` is a few
     * hundred bytes and wallet UIs commonly will not render SVG for a dapp icon —
     * the Reown secure site included. `hoodfi-h.png` is 512x512 and was already
     * sitting in public/, unused here.
     *
     * Same class of mistake as pointing this at a 1200x630 social card: whatever
     * goes here is drawn small and square, so it wants a square raster. It is not
     * the OG image and it is not the favicon.
     */
    icons: [`${SITE.url}/hoodfi-h.png`],
  },
  /*
   * Point the EMBEDDED WALLET at Reown's own Blockchain API for this chain.
   *
   * This steers the social-login wallet ONLY. This app's own reads and writes go
   * through the explicit transports in lib/wagmi.ts (`[ROBINHOOD_CHAIN_ID]:
   * http(ROBINHOOD_RPC)`), which this does not touch.
   *
   * WHY. `W3mFrameProvider.getRpcUrl()` returns
   * `activeNetwork.rpcUrls.default.http[0]`, and `extendCaipNetwork` builds that
   * array as `[...customRpcUrls[caipNetworkId], ...(reownRpcUrl ? [reownRpcUrl] :
   * [])]` — so whatever is put here becomes the URL the wallet is handed. Left to
   * itself, `getDefaultRpcUrl` hands over the Blockchain API only for chains in
   * `WC_HTTP_RPC_SUPPORTED_CHAINS`, which does not list 4663, so the wallet got a
   * public RPC it never successfully fetched and every signature died with
   * "Magic RPC Error: [-32603] Failed to fetch".
   *
   * That constant is STALE rather than authoritative: the Blockchain API demonstrably
   * serves 4663 — `eth_blockNumber` returns a live block and `eth_getCode` returns
   * real bytecode — while a fabricated `eip155:999999` is refused outright.
   *
   * PROVEN on the sibling site: `johann.hoodfi.eth` was minted through a Google login
   * on Robinhood Chain once this was in place. Two live caveats carry over here:
   * an intermittent 503 ("chain provider is temporarily unavailable") that a retry
   * clears, and no failover possible — `getRpcUrl()` returns only `http[0]`.
   *
   * The projectId is public and already in this bundle, so putting it in a URL here
   * reveals nothing new.
   */
  customRpcUrls: {
    [`eip155:${ROBINHOOD_CHAIN_ID}`]: [
      {
        url: `https://rpc.walletconnect.org/v1/?chainId=eip155:${ROBINHOOD_CHAIN_ID}&projectId=${projectId}`,
      },
    ],
  },
  // Wallet ids from the WalletConnect explorer: Robinhood Wallet, MetaMask
  featuredWalletIds: [
    "8837dd9413b1d9b585ee937d27a816590248386d9dbf099aff5048f435ef347b",
    "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96",
  ],
  // Light, matching the site's modal exactly — a paper field (#dcdcd2) with card-white
  // rows on it. This reverses the earlier "the modal stays dark" call, which reasoned
  // from the ink publish card. The two apps share a header, a palette and a wallet
  // flow, and a person moves between them mid-task; a dark modal here and a paper one
  // on www.hoodfi.name reads as two different products asking for the same signature.
  // The surfaces themselves are set in globals.css — see the AppKit block there.
  themeMode: "light",
  /* These three are the whole of AppKit's *supported* theming surface that this design
   * needs. The docs list exactly seven variables — font-family, accent, color-mix,
   * color-mix-strength, font-size-master, border-radius-master, z-index — and nothing
   * for card or row backgrounds, borders or text. Everything beyond this is done with
   * internal `--apkt-tokens-*` in globals.css.
   *
   * `--apkt-*` is the current prefix; the old `--w3m-*` names this used to carry still
   * resolve as a fallback, but they are the deprecated half of the pair. */
  themeVariables: {
    "--apkt-accent": "#c6f702", // --lime; literal, this is injected outside our cascade
    // Radius zero is the identity of this design; a rounded modal is a different one.
    "--apkt-border-radius-master": "0px",
    // Strength 0 on purpose. color-mix tints EVERY token including body text, so any
    // strength high enough to warm the background also washes the type out. The
    // surfaces are set explicitly in globals.css instead.
    "--apkt-color-mix-strength": 0,
  },
  features: {
    analytics: false,

    /* ── Remote features — these are NOT actually decided here ──
     *
     * In AppKit 1.8, `email`, `socials`, `onramp`, `swaps` and `activity` are
     * "remote features": on load AppKit fetches the project config from
     * dashboard.reown.com and, whenever that fetch succeeds, the dashboard value
     * REPLACES whatever is set below. The only signal is a console warning ("Your
     * local configuration for … was ignored"). See
     * @reown/appkit/dist/esm/src/utils/ConfigUtil.js → fetchRemoteFeatures.
     *
     * This app shares its projectId with the site (both `43bdd1b8…`), so the
     * dashboard switch that turned social login on for www.hoodfi.name turned it on
     * HERE TOO — while `email: false` below said otherwise and none of the supporting
     * code existed. The values here are the fallback for when the config fetch fails,
     * not the switch; they now agree with the dashboard rather than contradicting it.
     */

    // Email and socials mint a Reown embedded wallet, so a name holder who has never
    // managed a key can still publish a site. The wallet list stays above them:
    // Robinhood Wallet is the reason this chain is interesting.
    email: true,
    socials: ["google", "x", "discord", "apple", "github", "farcaster"],

    /* Onramp is off on purpose, and must also be off in the dashboard.
     *
     * Meld is the only provider AppKit wires up, and AppKit hands it a URL built from
     * `destinationCurrencyCode` + `walletAddress` and NO chain
     * (OnRampController.setSelectedProvider). For any EVM chain that currency is
     * hardcoded to USDC. Publishing here is paid in ETH or USDG on Robinhood Chain
     * (4663), so a buyer would pay card fees to receive USDC on Ethereum mainnet —
     * wrong asset, wrong chain, still unable to publish, and no bridge in the flow.
     *
     * AppKit will not stop this: its gate is ONRAMP_SUPPORTED_CHAIN_NAMESPACES, which
     * checks the *namespace* (EVM) and so passes Robinhood Chain happily. WalletSheet
     * shows the two routes that actually reach this chain instead.
     */
    onramp: false,

    // Local (not remote-controlled) — these do take effect from here.
    emailShowWallets: true,
    connectMethodsOrder: ["wallet", "social", "email"],
  },
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
