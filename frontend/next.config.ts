import type { NextConfig } from "next";

/**
 * Static export for IPFS hosting (hoodfi.eth contenthash → Pinata CID).
 * No server runtime: every page must be fully client-renderable.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true, // directory-style URLs resolve cleanly on IPFS gateways
  images: { unoptimized: true },
  turbopack: {
    resolveAlias: {
      // Optional deps we don't use: wagmi's tempo connector imports "accounts",
      // WalletConnect's pino logger imports "pino-pretty". Stub both.
      accounts: "./lib/empty-stub.ts",
      "pino-pretty": "./lib/empty-stub.ts",
    },
  },
};

export default nextConfig;
