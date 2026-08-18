import type { NextConfig } from "next";

/**
 * Static export, like the main site — but for a different reason.
 *
 * The site is exported because it gets pinned to IPFS. This app never will be; it is
 * a tool, and the sites it produces are the things that get pinned. It is exported
 * anyway to keep the constraint that there is no server here: every secret this
 * product needs (the Pinata key, the paid RPC key) lives on the gateway worker, and a
 * Vercel server runtime is an open invitation to put a second copy somewhere else.
 *
 * `trailingSlash` matches the site so route strings behave identically between the two.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    // No `root` override, and `shared/` is NOT a symlink — both were tried and both
    // fail. Turbopack rejects a symlink that leaves the project with "Symlink
    // [project]/shared/contenthash.ts is invalid, it points out of the filesystem
    // root", and pointing `root` at the repo instead just moves the resolution
    // problem into node_modules. `shared/` is therefore a generated copy, written by
    // scripts/sync-shared.mjs on prebuild and gitignored; the authored original lives
    // at frontend/shared/. Same conclusion the MCP worker reached, for the same reason.
    resolveAlias: {
      // Same optional-dep stubs the site needs: wagmi's tempo connector imports
      // "accounts", WalletConnect's pino logger imports "pino-pretty".
      accounts: "./lib/empty-stub.ts",
      "pino-pretty": "./lib/empty-stub.ts",
    },
  },
};

export default nextConfig;
