"use client";

import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { mainnet } from "@reown/appkit/networks";
import { config, networks, projectId, wagmiAdapter } from "@/lib/wagmi";
import { SITE } from "@/lib/site";
import { ConnectionGuard } from "@/components/ConnectionGuard";

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
    icons: [`${SITE.url}/icon.svg`],
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
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
