import type { Address } from "viem";

function addressEnv(value: string | undefined): Address | undefined {
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) return undefined;
  return value as Address;
}

/** Mainnet donation contract. Undefined until deployed (pre-deploy UI). */
export const DONATIONS_ADDRESS = addressEnv(process.env.NEXT_PUBLIC_DONATIONS_ADDRESS);
export const DONATIONS_DEPLOY_BLOCK = BigInt(
  process.env.NEXT_PUBLIC_DONATIONS_DEPLOY_BLOCK ?? "0"
);

/** Robinhood Chain contracts. */
export const REGISTRAR_ADDRESS = addressEnv(process.env.NEXT_PUBLIC_REGISTRAR_ADDRESS);
export const L2_REGISTRY_ADDRESS = addressEnv(process.env.NEXT_PUBLIC_L2_REGISTRY_ADDRESS);
export const USDC_ADDRESS = addressEnv(process.env.NEXT_PUBLIC_USDC_ADDRESS);

/**
 * The mainnet resolver hoodfi.eth points at — the contract that answers every
 * lookup through CCIP-Read. A fixed, verified deployment rather than an env var:
 * it is listed on the site as something to go and check, and a contracts table
 * that silently empties when a variable is unset would defeat the point.
 */
export const L1_RESOLVER_ADDRESS =
  "0x37215Dd89D0Fd4ea0Dbce690bDe58490fB7f7cF2" as const;

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export const donationsAbi = [
  {
    type: "function",
    name: "donate",
    stateMutability: "payable",
    inputs: [{ name: "numYears", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "extend",
    stateMutability: "payable",
    inputs: [{ name: "numYears", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "quote",
    stateMutability: "view",
    inputs: [{ name: "numYears", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "nameExpires",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalYearsDonated",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalDonations",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "goalReached",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "yearsRemaining",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "finalized",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "shortCredits",
    stateMutability: "view",
    inputs: [{ name: "donor", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "Donated",
    inputs: [
      { name: "donor", type: "address", indexed: true },
      { name: "numYears", type: "uint256", indexed: false },
      { name: "ethPaid", type: "uint256", indexed: false },
      { name: "newExpiry", type: "uint256", indexed: false },
      { name: "creditsTotal", type: "uint256", indexed: false },
      { name: "totalYears", type: "uint256", indexed: false },
    ],
  },
  { type: "error", name: "AlreadyFinalized", inputs: [] },
  { type: "error", name: "GoalNotReached", inputs: [] },
  { type: "error", name: "InvalidYears", inputs: [] },
  {
    type: "error",
    name: "InsufficientPayment",
    inputs: [
      { name: "required", type: "uint256" },
      { name: "provided", type: "uint256" },
    ],
  },
  { type: "error", name: "RefundFailed", inputs: [] },
] as const;

/**
 * L2Registry reverts, shared by every ABI that can trigger one. The registrar mints
 * through the registry, so a mint can fail with any of these — `NotAvailable` above
 * all, when the same label is taken between the availability check and the mint.
 */
const registryErrors = [
  { type: "error", name: "LabelTooShort", inputs: [] },
  { type: "error", name: "LabelTooLong", inputs: [{ name: "label", type: "string" }] },
  {
    type: "error",
    name: "NotAvailable",
    inputs: [
      { name: "label", type: "string" },
      { name: "parentNode", type: "bytes32" },
    ],
  },
  { type: "error", name: "Unauthorized", inputs: [{ name: "node", type: "bytes32" }] },
  {
    type: "error",
    name: "ERC721InvalidReceiver",
    inputs: [{ name: "receiver", type: "address" }],
  },
] as const;

/** OpenZeppelin v5 ERC-20 reverts, reachable through the USDG mint path. */
const erc20Errors = [
  {
    type: "error",
    name: "ERC20InsufficientBalance",
    inputs: [
      { name: "sender", type: "address" },
      { name: "balance", type: "uint256" },
      { name: "needed", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ERC20InsufficientAllowance",
    inputs: [
      { name: "spender", type: "address" },
      { name: "allowance", type: "uint256" },
      { name: "needed", type: "uint256" },
    ],
  },
] as const;

export const registrarAbi = [
  {
    type: "function",
    name: "register",
    stateMutability: "payable",
    inputs: [{ name: "label", type: "string" }],
    outputs: [],
  },
  {
    type: "function",
    name: "registerWithUsdc",
    stateMutability: "nonpayable",
    inputs: [{ name: "label", type: "string" }],
    outputs: [],
  },
  {
    type: "function",
    name: "mintShortWithVoucher",
    stateMutability: "nonpayable",
    inputs: [
      { name: "label", type: "string" },
      { name: "totalCredits", type: "uint256" },
      { name: "expiry", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "status",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "priceOf",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [
      { name: "weiPrice", type: "uint256" },
      { name: "usdcPrice", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "shortsOpen",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "creditsSpent",
    stateMutability: "view",
    inputs: [{ name: "donor", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "labelhash", type: "bytes32", indexed: true },
      { name: "label", type: "string", indexed: false },
      { name: "price", type: "uint256", indexed: false },
      { name: "paidInUsdc", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ShortClaimed",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "labelhash", type: "bytes32", indexed: true },
      { name: "label", type: "string", indexed: false },
      { name: "creditsSpent", type: "uint256", indexed: false },
    ],
  },
  // Every revert this contract can produce, plus the ones it bubbles up from the
  // registry and from the USDG token. Without these entries viem has nothing to
  // decode the four-byte selector against, and a failed mint reaches the user as
  // "reverted with the following signature: 0xb99e2ab7" — which says nothing.
  { type: "error", name: "MintingPaused", inputs: [] },
  { type: "error", name: "InvalidLabel", inputs: [{ name: "label", type: "string" }] },
  { type: "error", name: "LabelBlocked", inputs: [{ name: "label", type: "string" }] },
  { type: "error", name: "ShortNameLocked", inputs: [{ name: "label", type: "string" }] },
  { type: "error", name: "NotAShortName", inputs: [{ name: "label", type: "string" }] },
  {
    type: "error",
    name: "InsufficientPayment",
    inputs: [
      { name: "required", type: "uint256" },
      { name: "provided", type: "uint256" },
    ],
  },
  { type: "error", name: "UsdcNotConfigured", inputs: [] },
  {
    type: "error",
    name: "NoCreditsLeft",
    inputs: [
      { name: "attested", type: "uint256" },
      { name: "spent", type: "uint256" },
    ],
  },
  { type: "error", name: "VoucherExpired", inputs: [{ name: "expiry", type: "uint256" }] },
  { type: "error", name: "BadVoucher", inputs: [] },
  { type: "error", name: "SignerNotConfigured", inputs: [] },
  { type: "error", name: "RefundFailed", inputs: [] },
  ...registryErrors,
  ...erc20Errors,
] as const;

/**
 * L2Registry. Name owners can write their own records directly — the registry's
 * authorization check passes for the token owner, not just registrars — so the
 * manage page talks to this contract with no intermediary.
 */
export const registryAbi = [
  {
    // Public counter on L2Registry, incremented on every mint — the honest source
    // for "names minted", read from the chain rather than an indexer.
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "baseNode",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "makeNode",
    stateMutability: "pure",
    inputs: [
      { name: "parentNode", type: "bytes32" },
      { name: "label", type: "string" },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
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
    name: "addr",
    stateMutability: "view",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "coinType", type: "uint256" },
    ],
    outputs: [{ type: "bytes" }],
  },
  {
    type: "function",
    name: "setAddr",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "coinType", type: "uint256" },
      { name: "value", type: "bytes" },
    ],
    outputs: [],
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
    name: "multicall",
    stateMutability: "nonpayable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [{ type: "bytes[]" }],
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

export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
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
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;
