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
      <QueryClientProvider client={queryClient}>
        {/* Above the page rather than inside Header, because Header is rendered per
            route — mounting here is what puts the escape hatch on every one of them. */}
        <ConnectionGuard />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
