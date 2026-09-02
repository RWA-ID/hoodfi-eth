/**
 * The slice of each ABI this server actually touches. Kept deliberately narrow —
 * a keyless server has no business encoding anything it cannot also explain.
 */

export const registrarAbi = [
  {
    type: 'function',
    name: 'register',
    stateMutability: 'payable',
    inputs: [{ name: 'label', type: 'string' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'registerWithUsdc',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'label', type: 'string' }],
    outputs: [],
  },
  {
    // 0 = available, 1 = taken, 2 = locked (short, pre-goal), 3 = invalid, 4 = blocked.
    type: 'function',
    name: 'status',
    stateMutability: 'view',
    inputs: [{ name: 'label', type: 'string' }],
    outputs: [{ type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'priceOf',
    stateMutability: 'view',
    inputs: [{ name: 'label', type: 'string' }],
    outputs: [
      { name: 'weiPrice', type: 'uint256' },
      { name: 'usdcPrice', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'shortsOpen',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'paused',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
] as const

export const registryAbi = [
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'addr',
    stateMutability: 'view',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'coinType', type: 'uint256' },
    ],
    outputs: [{ type: 'bytes' }],
  },
  {
    type: 'function',
    name: 'text',
    stateMutability: 'view',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
    ],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    // EIP-1577. The record that makes a name a website, served at
    // <label>.hoodfi.eth.link — see shared/contenthash.ts for the byte format.
    type: 'function',
    name: 'contenthash',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ type: 'bytes' }],
  },
  {
    // Owner-only, and this server holds no key: the calldata is handed back for the
    // agent's own wallet to sign, exactly like registration.
    type: 'function',
    name: 'setContenthash',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'hash', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    // ENSIP-9. Owner-only on the same `isAuthorised(node)` check as setContenthash.
    // `a` is the chain's own encoding, not address text — see coins.ts.
    type: 'function',
    name: 'setAddr',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'coinType', type: 'uint256' },
      { name: 'a', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    // From the resolver's Multicallable: several record writes in one transaction, so
    // an owner setting three addresses signs once rather than three times. Each entry
    // re-enters this contract and is authorised individually, so it grants nothing a
    // direct call would not.
    type: 'function',
    name: 'multicall',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'data', type: 'bytes[]' }],
    outputs: [{ type: 'bytes[]' }],
  },
] as const

export const erc20Abi = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const
