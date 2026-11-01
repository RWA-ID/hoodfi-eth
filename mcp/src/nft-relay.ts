import { type Address, type Hex, decodeFunctionData } from 'viem'

/**
 * The two ways this server moves an NFT, and the relay's test for them.
 *
 * Any collection can be sent, so hoodfi_send_transaction can't allowlist by contract
 * address the way it does for HoodFi's own. It allowlists the call instead: exactly
 * these two selectors, no ETH attached, moving the signer's own token. Deliberately
 * absent: setApprovalForAll and approve (the calls a drainer wants), and
 * transferFrom, whose selector is also ERC-20's. Kept free of imports from the tools
 * so it can be tested without a chain.
 */
export const nftAbi = [
  {
    type: 'function',
    name: 'safeTransferFrom',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'safeTransferFrom',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'id', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'supportsInterface',
    stateMutability: 'view',
    inputs: [{ name: 'interfaceId', type: 'bytes4' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'id', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const

/** True only for a zero-value NFT transfer of the signer's own token. */
export function isOwnNftTransfer(data: Hex, value: bigint, signer: Address): boolean {
  if (value !== 0n) return false
  try {
    const { functionName, args } = decodeFunctionData({ abi: nftAbi, data })
    return (
      functionName === 'safeTransferFrom' &&
      (args[0] as string).toLowerCase() === signer.toLowerCase()
    )
  } catch {
    return false
  }
}

/**
 * Seaport 1.6, the one marketplace contract the relay accepts, and only its basic-order
 * fill: that call has no recipient argument, so the NFT always goes to the signer.
 */
export const SEAPORT = '0x0000000000000068F116a894984e2DB1123eB395'

export const SEAPORT_FUNCTION =
  'fulfillBasicOrder_efficient_6GL6yc((address,uint256,uint256,address,address,address,uint256,uint256,uint8,uint256,uint256,bytes32,uint256,bytes32,bytes32,uint256,(uint256,address)[],bytes))'

export const seaportAbi = [
  {
    type: 'function',
    name: 'fulfillBasicOrder_efficient_6GL6yc',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'parameters',
        type: 'tuple',
        components: [
          { name: 'considerationToken', type: 'address' },
          { name: 'considerationIdentifier', type: 'uint256' },
          { name: 'considerationAmount', type: 'uint256' },
          { name: 'offerer', type: 'address' },
          { name: 'zone', type: 'address' },
          { name: 'offerToken', type: 'address' },
          { name: 'offerIdentifier', type: 'uint256' },
          { name: 'offerAmount', type: 'uint256' },
          { name: 'basicOrderType', type: 'uint8' },
          { name: 'startTime', type: 'uint256' },
          { name: 'endTime', type: 'uint256' },
          { name: 'zoneHash', type: 'bytes32' },
          { name: 'salt', type: 'uint256' },
          { name: 'offererConduitKey', type: 'bytes32' },
          { name: 'fulfillerConduitKey', type: 'bytes32' },
          { name: 'totalOriginalAdditionalRecipients', type: 'uint256' },
          {
            name: 'additionalRecipients',
            type: 'tuple[]',
            components: [
              { name: 'amount', type: 'uint256' },
              { name: 'recipient', type: 'address' },
            ],
          },
          { name: 'signature', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: 'fulfilled', type: 'bool' }],
  },
] as const

/** True only for a Seaport basic-order fill paid in ETH (order types 0-7). */
export function isSeaportEthFill(to: Address, data: Hex): boolean {
  if (to.toLowerCase() !== SEAPORT.toLowerCase()) return false
  try {
    const { functionName, args } = decodeFunctionData({ abi: seaportAbi, data })
    return functionName === 'fulfillBasicOrder_efficient_6GL6yc' && args[0].basicOrderType < 8
  } catch {
    return false
  }
}

/** What a relayed transaction did to an NFT, read from its own calldata. For the result card. */
export function describeNftTx(
  to: Address,
  data: Hex
):
  | { kind: 'send'; contract: Address; tokenId: bigint; recipient: Address; quantity: bigint }
  | { kind: 'buy'; contract: Address; tokenId: bigint }
  | null {
  if (isSeaportEthFill(to, data)) {
    const { args } = decodeFunctionData({ abi: seaportAbi, data })
    return { kind: 'buy', contract: args[0].offerToken, tokenId: args[0].offerIdentifier }
  }
  try {
    const { functionName, args } = decodeFunctionData({ abi: nftAbi, data })
    if (functionName !== 'safeTransferFrom') return null
    return {
      kind: 'send',
      contract: to,
      recipient: args[1],
      tokenId: args[2],
      quantity: args.length === 5 ? (args[3] as bigint) : 1n,
    }
  } catch {
    return null
  }
}
