import type { Address } from "viem";

/**
 * Contracts this app talks to.
 *
 * Deliberately its own file rather than an import from the site: `mcp/src/contracts.ts`
 * already set that precedent, and the three consumers need genuinely different subsets.
 * The one module that *is* shared is the contenthash codec, because two copies of a
 * codec is two chances to encode a record the gateways refuse.
 */

function addressEnv(value: string | undefined): Address | undefined {
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) return undefined;
  return value as Address;
}

/** Robinhood Chain (4663). */
export const L2_REGISTRY_ADDRESS = addressEnv(process.env.NEXT_PUBLIC_L2_REGISTRY_ADDRESS);
export const REGISTRAR_ADDRESS = addressEnv(process.env.NEXT_PUBLIC_REGISTRAR_ADDRESS);
export const USDG_ADDRESS = addressEnv(process.env.NEXT_PUBLIC_USDC_ADDRESS);

/**
 * The publishing paywall. Undefined until deployed, which is the normal state during
 * Phase 0 — every surface that needs it degrades rather than throwing, the same way the
 * site handled its own pre-deploy period.
 */
export const SITES_ADDRESS = addressEnv(process.env.NEXT_PUBLIC_SITES_ADDRESS);

export const L2_DEPLOY_BLOCK = BigInt(process.env.NEXT_PUBLIC_L2_DEPLOY_BLOCK ?? "0");

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/**
 * Registry errors carry a sentence each on purpose. A bare selector in a wallet dialog
 * is what produced the "reverted with the following reason:" bug on the mint page — an
 * ABI without error entries leaves viem nothing to decode.
 */
const registryErrors = [
  { type: "error", name: "Unauthorized", inputs: [{ name: "node", type: "bytes32" }] },
  {
    type: "error",
    name: "ERC721NonexistentToken",
    inputs: [{ name: "tokenId", type: "uint256" }],
  },
] as const;

export const registryAbi = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "names",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ type: "bytes" }],
  },
  {
    type: "function",
    name: "text",
    stateMutability: "view",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
    ],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "setText",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
  },
  {
    // EIP-1577 — the record that makes the published site reachable at
    // <label>.hoodfi.eth.link. Written by the owner, never by us.
    type: "function",
    name: "contenthash",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ type: "bytes" }],
  },
  {
    type: "function",
    name: "setContenthash",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "hash", type: "bytes" },
    ],
    outputs: [],
  },
  {
    // ENS Multicallable delegatecalls itself, so msg.sender survives and the per-node
    // owner check still holds. This is how the site writes a whole form in one tx.
    type: "function",
    name: "multicall",
    stateMutability: "nonpayable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [{ type: "bytes[]" }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
  ...registryErrors,
] as const;
