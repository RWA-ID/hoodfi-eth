"use client";

import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { mainnet } from "@reown/appkit/networks";
import { config, networks, projectId, wagmiAdapter } from "@/lib/wagmi";
import { SITE } from "@/lib/site";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chains";
import { ConnectionGuard } from "@/components/ConnectionGuard";
import { SocialDefaultNetwork } from "@/components/SocialDefaultNetwork";

/**
 * wagmi (via Reown AppKit adapter) + react-query. createAppKit mounts the
 * connect modal once at module load; open it with useAppKit().open().
 * Robinhood Wallet + MetaMask are surfaced first in the modal.
 */
createAppKit({
  adapters: [wagmiAdapter],
  networks,
  defaultNetwork: mainnet,
  projectId,
  metadata: {
    name: SITE.name,
    description: SITE.description,
    url: SITE.url,
    /*
     * A PNG, not the SVG this used to point at.
     *
     * This is the icon the wallet shows beside "do you want to sign this", and
     * the signing prompt was rendering with no mark at all. `icon.svg` is 244
     * bytes and wallet UIs commonly won't render SVG for a dapp icon — the
     * secure site included. `hoodfi-h.png` is 512x512 and was already in
     * public/, just unused here.
     *
     * The same class of mistake as pointing this at a 1200x630 social card:
     * whatever goes here is drawn small and square, so it wants a square raster.
     */
    icons: [`${SITE.url}/hoodfi-h.png`],
  },
  /*
   * Point the EMBEDDED WALLET at Reown's own Blockchain API for this chain.
   *
   * This steers the social-login wallet ONLY. The app's own reads and writes go
   * through explicit transports in lib/wagmi.ts (`[ROBINHOOD_CHAIN_ID]:
   * http(ROBINHOOD_RPC)`), which this does not touch — so the gateway remains
   * the site's RPC and the Blockchain API is not billed for page traffic.
   *
   * WHY. `W3mFrameProvider.getRpcUrl()` returns
   * `activeNetwork.rpcUrls.default.http[0]`, and `extendCaipNetwork` builds that
   * array as `[...customRpcUrls[caipNetworkId], ...(reownRpcUrl ? [reownRpcUrl]
   * : [])]` — so whatever is put here becomes the URL the wallet is handed.
   * Left to itself, `getDefaultRpcUrl` hands over Reown's Blockchain API only
   * for chains in `WC_HTTP_RPC_SUPPORTED_CHAINS`, which lists eip155:1, 8453,
   * 42161 and ~20 more but NOT 4663 — so this chain fell back to our gateway,
   * and a `wrangler tail` through a full mint shows the wallet never fetched it.
   *
   * THE BET. The Blockchain API demonstrably serves 4663 even though it is
   * absent from the docs table AND from that constant: `eth_blockNumber`
   * returns a live block matching our gateway to ~20 blocks, and `eth_getCode`
   * returns the registrar's real bytecode, while a genuinely unknown id
   * (eip155:999999) is refused outright. So the RPC layer is fine and the
   * constant looks stale. If the secure site simply uses the URL it is given,
   * this works. If it independently refuses chains outside its own list, it
   * changes nothing.
   *
   * EXPECTATION: LOW, and documented as such. docs.reown.com/appkit/networks/overview
   * says embedded wallets are "limited to the chains the secure site and
   * Blockchain API support" and that others "will allow login but transactions
   * won't reliably work" — which describes this exactly. Reown also state they
   * do not accept requests for new Blockchain API chains, so this is not
   * something to wait on. If the mint still fails, social login should be
   * turned OFF for this project in the Reown dashboard rather than left
   * offering a path that dead-ends after someone has funded a wallet.
   *
   * The projectId is public and already in this bundle, so putting it in a URL
   * here reveals nothing new.
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
  // Light, per the Connect Wallet Modal design: a paper field (#dcdcd2) with card-white
  // rows on it. This reverses the earlier "modal stays dark" call — the design makes the
  // modal a paper object like the rest of the page, not a second ink surface.
  themeMode: "light",
  /* These four are the whole of AppKit's *supported* theming surface. The docs
   * list exactly seven variables — font-family, accent, color-mix,
   * color-mix-strength, font-size-master, border-radius-master, z-index — and
   * nothing for card or row backgrounds, borders or text. Everything the design
   * needs beyond this is done with internal tokens in globals.css.
   *
   * `--apkt-*` is the current prefix; the old `--w3m-*` names still resolve as a
   * fallback, but new code should use these. */
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

    /* ── Remote features — these four are NOT actually decided here ──
     *
     * In AppKit 1.8, `email`, `socials`, `onramp`, `swaps` and `activity` are
     * "remote features": on load, AppKit fetches the project config from
     * dashboard.reown.com and, whenever that fetch succeeds, the dashboard value
     * REPLACES whatever is set below. The only signal is a console warning
     * ("Your local configuration for … was ignored"). See
     * @reown/appkit/dist/esm/src/utils/ConfigUtil.js → fetchRemoteFeatures.
     *
     * So the values below are the fallback for when the config fetch fails
     * (offline, blocked, ad-blocker) — not the switch. To actually change any of
     * them, change it on the project in the Reown dashboard.
     */

    // Email and socials mint a Reown embedded wallet, so someone who has never held
    // a key can still claim a subname. The wallet list stays above them: Robinhood
    // Wallet is the reason this chain is interesting, and burying it under a Google
    // button would sell the wrong front door.
    email: true,
    socials: ["google", "x", "discord", "apple", "github", "farcaster"],

    /* Onramp is off on purpose, and must also be turned off in the dashboard.
     *
     * Meld is the only provider AppKit wires up, and AppKit hands it a URL built
     * from `destinationCurrencyCode` + `walletAddress` and NO chain
     * (OnRampController.setSelectedProvider). For any EVM chain that currency is
     * hardcoded to USDC. Mints here are ETH on Robinhood Chain (4663), so a buyer
     * would pay card fees to receive USDC on Ethereum mainnet — wrong asset, wrong
     * chain, still unable to mint, and no bridge in the flow to fix it.
     *
     * AppKit will not stop this: its gate is ONRAMP_SUPPORTED_CHAIN_NAMESPACES,
     * which checks the *namespace* (EVM) and so passes Robinhood Chain happily.
     *
     * The answer for someone with no crypto is PayBox (/mcp) or a social login,
     * not a card purchase that lands somewhere they cannot spend it.
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
      <QueryClientProvider client={queryClient}>
        {/* Above the page rather than inside Header, because Header is rendered per
            route — mounting here is what puts the escape hatch on every one of them. */}
        <ConnectionGuard />
        {/* Renders nothing; mounted here so it sees every connection, on every route. */}
        <SocialDefaultNetwork />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
