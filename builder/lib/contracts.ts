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
 * The publishing paywall, for reads and writes. Env-driven so a preview deployment can
 * point at a different one.
 */
export const SITES_ADDRESS = addressEnv(process.env.NEXT_PUBLIC_SITES_ADDRESS);

/**
 * The same contract, as a fixed constant, for anything that merely *shows* the address.
 *
 * Deliberately not the env var. This is listed publicly as something to go and check,
 * and a "verify us" link that silently disappears when a variable is unset defeats its
 * own purpose — the site's contracts table hardcodes its resolver for exactly this
 * reason. Keep the two in step when the contract is redeployed.
 */
export const SITES_ADDRESS_PUBLIC =
  "0x90517237F52caC977398CA1391b3B006bA028c99" as const;

/** Where a Robinhood Chain address can be read by anyone. */
export const EXPLORER = "https://robinhoodchain.blockscout.com";

export const REPO_URL = "https://github.com/RWA-ID/hoodfi-eth";

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

/**
 * USDG, as much of ERC-20 as paying with it needs.
 *
 * `decimals` is deliberately absent: it is 6, the contract's price fields are documented
 * as 6, and reading it at runtime would invite code that adapts to an answer the prices
 * were never denominated in. If USDG were ever swapped for a token with different
 * decimals, the prices themselves would be wrong and a live read would hide that rather
 * than surface it.
 */
export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

/**
 * HoodfiSites — the publish paywall.
 *
 * Errors carry a sentence each. An ABI without them leaves viem only a selector, and a
 * refused publish then reads as "reverted with the following signature: 0x…" — which is
 * the exact bug the mint page shipped with for weeks.
 */
export const sitesAbi = [
  {
    type: "function",
    name: "publish",
    stateMutability: "payable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "templateId", type: "bytes32" },
      { name: "cid", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "publishWithUsdg",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "templateId", type: "bytes32" },
      { name: "cid", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "quote",
    stateMutability: "view",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "templateId", type: "bytes32" },
      { name: "buyer", type: "address" },
    ],
    outputs: [
      { name: "weiPrice", type: "uint256" },
      { name: "usdgPrice", type: "uint256" },
      { name: "eligible", type: "bool" },
      { name: "publishCount", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "isPaid",
    stateMutability: "view",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "cid", type: "string" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "canUseTemplate",
    stateMutability: "view",
    inputs: [
      { name: "templateId", type: "bytes32" },
      { name: "buyer", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  { type: "error", name: "PublishingPaused", inputs: [] },
  { type: "error", name: "NotNameOwner", inputs: [{ name: "node", type: "bytes32" }] },
  { type: "error", name: "UnknownTemplate", inputs: [{ name: "templateId", type: "bytes32" }] },
  { type: "error", name: "TemplateInactive", inputs: [{ name: "templateId", type: "bytes32" }] },
  {
    type: "error",
    name: "CollectionRequired",
    inputs: [
      { name: "templateId", type: "bytes32" },
      { name: "collection", type: "address" },
    ],
  },
  {
    type: "error",
    name: "InsufficientPayment",
    inputs: [
      { name: "required", type: "uint256" },
      { name: "provided", type: "uint256" },
    ],
  },
  { type: "error", name: "UsdgNotConfigured", inputs: [] },
  { type: "error", name: "EmptyCid", inputs: [] },
  {
    type: "error",
    name: "CidTooLong",
    inputs: [
      { name: "length", type: "uint256" },
      { name: "max", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "AlreadyPaid",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "cid", type: "string" },
    ],
  },
] as const;
