"use client";

import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { robinhoodChain } from "@/lib/chains";
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
    icons: [`${SITE.url}/icon.svg`],
  },
  // Wallet ids from the WalletConnect explorer: Robinhood Wallet, MetaMask
  featuredWalletIds: [
    "8837dd9413b1d9b585ee937d27a816590248386d9dbf099aff5048f435ef347b",
    "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96",
  ],
  // The modal stays dark — it is the same object as the mint card, which is the one
  // ink surface on a paper page, so a light modal would read as a different product.
  themeMode: "dark",
  themeVariables: {
    "--w3m-accent": "#c6f702", // lime
    "--w3m-color-mix": "#0b0e08", // pull the modal toward our ink
    "--w3m-color-mix-strength": 20,
    // Radius zero is the identity of this design; a rounded modal is a different one.
    "--w3m-border-radius-master": "0px",
  },
  features: {
    analytics: false,
    email: false,
    socials: false,
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
