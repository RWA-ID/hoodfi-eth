/** Only the parts of each ABI this SDK actually calls. */

export const registrarAbi = [
  { type: 'function', name: 'register', stateMutability: 'payable', inputs: [{ name: 'label', type: 'string' }], outputs: [] },
  { type: 'function', name: 'registerWithUsdc', stateMutability: 'nonpayable', inputs: [{ name: 'label', type: 'string' }], outputs: [] },
  // 0 = available, 1 = taken, 2 = locked, 3 = invalid, 4 = blocked.
  { type: 'function', name: 'status', stateMutability: 'view', inputs: [{ name: 'label', type: 'string' }], outputs: [{ type: 'uint8' }] },
  {
    type: 'function',
    name: 'priceOf',
    stateMutability: 'view',
    inputs: [{ name: 'label', type: 'string' }],
    outputs: [{ name: 'weiPrice', type: 'uint256' }, { name: 'usdcPrice', type: 'uint256' }],
  },
  { type: 'function', name: 'paused', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
] as const

export const registryAbi = [
  { type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }] },
  {
    type: 'function',
    name: 'addr',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }, { name: 'coinType', type: 'uint256' }],
    outputs: [{ type: 'bytes' }],
  },
  {
    type: 'function',
    name: 'text',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }, { name: 'key', type: 'string' }],
    outputs: [{ type: 'string' }],
  },
  { type: 'function', name: 'contenthash', stateMutability: 'view', inputs: [{ name: 'node', type: 'bytes32' }], outputs: [{ type: 'bytes' }] },
] as const
