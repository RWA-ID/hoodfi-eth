import { type Chain, defineChain } from 'viem'

export const PARENT = 'hoodfi.eth'
export const ROBINHOOD_CHAIN_ID = 4663
export const DEFAULT_ROBINHOOD_RPC = 'https://rpc.mainnet.chain.robinhood.com'
/** Used when the public RPC rate-limits. It's throttled too, but on a separate budget. */
export const FALLBACK_ROBINHOOD_RPC = 'https://robinhoodchain.blockscout.com/api/eth-rpc'
export const ROBINHOOD_EXPLORER = 'https://robinhoodchain.blockscout.com'
/** Base URL of the HoodFi gateway that serves the reverse lookup. */
export const DEFAULT_API_URL = 'https://ccip.hoodfi-mcp.com'

/** Live contracts. Owners and sources: contracts/README.md in the repository. */
export const CONTRACTS = {
  registry: '0xf2bABA012244bdD7445129597350054E1B3aEe5C',
  registrar: '0x56be5565acc823f4195c2cf3b9046C083633209a',
  partnerRouter: '0xb7bd5f2c7c445ddc5d55ebd9b8f6a20c2e6e4b5d',
  usdg: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
  /** HoodfiL1Resolver on Ethereum mainnet. */
  l1Resolver: '0x37215Dd89D0Fd4ea0Dbce690bDe58490fB7f7cF2',
} as const

/**
 * The ENSIP-11 coinType for Robinhood Chain, 0x80000000 | 4663.
 *
 * It's written as a literal on purpose. In JS, `0x80000000 | 4663` is a signed 32-bit
 * operation and comes out negative, so every addr read silently returns nothing.
 */
export const ROBINHOOD_COIN_TYPE = 2147488311n
export const ETH_COIN_TYPE = 60n
export const BTC_COIN_TYPE = 0n
export const SOL_COIN_TYPE = 501n
export const XRP_COIN_TYPE = 144n

export const robinhoodChain: Chain = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [DEFAULT_ROBINHOOD_RPC] } },
  blockExplorers: { default: { name: 'Blockscout', url: ROBINHOOD_EXPLORER } },
  contracts: { multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' } },
})
