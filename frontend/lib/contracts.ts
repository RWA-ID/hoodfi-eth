import type { Address } from "viem";

function addressEnv(value: string | undefined): Address | undefined {
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) return undefined;
  return value as Address;
}

/** Mainnet donation + reservation contract. Undefined until deployed (pre-deploy UI). */
export const DONATIONS_ADDRESS = addressEnv(process.env.NEXT_PUBLIC_DONATIONS_ADDRESS);
export const DONATIONS_DEPLOY_BLOCK = BigInt(
  process.env.NEXT_PUBLIC_DONATIONS_DEPLOY_BLOCK ?? "0"
);

/** Robinhood Chain contracts. */
export const REGISTRAR_ADDRESS = addressEnv(process.env.NEXT_PUBLIC_REGISTRAR_ADDRESS);
export const L2_REGISTRY_ADDRESS = addressEnv(process.env.NEXT_PUBLIC_L2_REGISTRY_ADDRESS);
export const USDC_ADDRESS = addressEnv(process.env.NEXT_PUBLIC_USDC_ADDRESS);

export const donationsAbi = [
  {
    type: "function",
    name: "donate",
    stateMutability: "payable",
    inputs: [
      { name: "numYears", type: "uint256" },
      { name: "labels", type: "string[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "reserve",
    stateMutability: "nonpayable",
    inputs: [{ name: "labels", type: "string[]" }],
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
    name: "finalized",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "slots",
    stateMutability: "view",
    inputs: [{ name: "donor", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "usedSlots",
    stateMutability: "view",
    inputs: [{ name: "donor", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "reservationStatus",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "event",
    name: "Donated",
    inputs: [
      { name: "donor", type: "address", indexed: true },
      { name: "numYears", type: "uint256", indexed: false },
      { name: "ethPaid", type: "uint256", indexed: false },
      { name: "newExpiry", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "NameReserved",
    inputs: [
      { name: "donor", type: "address", indexed: true },
      { name: "labelhash", type: "bytes32", indexed: true },
      { name: "label", type: "string", indexed: false },
    ],
  },
] as const;

export const registrarAbi = [
  {
    type: "function",
    name: "phase",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [{ name: "label", type: "string" }],
    outputs: [],
  },
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
    name: "reservations",
    stateMutability: "view",
    inputs: [{ name: "labelhash", type: "bytes32" }],
    outputs: [{ type: "address" }],
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
] as const;
