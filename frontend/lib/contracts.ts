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
] as const;

/**
 * L2Registry. Name owners can write their own records directly — the registry's
 * authorization check passes for the token owner, not just registrars — so the
 * manage page talks to this contract with no intermediary.
 */
export const registryAbi = [
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
