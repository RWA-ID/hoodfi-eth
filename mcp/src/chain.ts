import { createPublicClient, defineChain, fallback, http } from 'viem'

import { type Env, envVarOptional } from './env'

export const ROBINHOOD_CHAIN_ID = 4663
export const DEFAULT_ROBINHOOD_RPC = 'https://rpc.mainnet.chain.robinhood.com'
/** Last resort when the public RPC rate-limits us. Also throttled, but on its own budget. */
export const FALLBACK_ROBINHOOD_RPC =
  'https://robinhoodchain.blockscout.com/api/eth-rpc'

export const ROBINHOOD_EXPLORER = 'https://robinhoodchain.blockscout.com'

/**
 * ENSIP-11 coinType for Robinhood Chain: 0x80000000 | 4663.
 *
 * Written as a literal on purpose. In JS `0x80000000 | 4663` is evaluated as a
 * *signed* 32-bit int and comes out negative (-2147478985), which silently breaks
 * every addr record read — and a failed read looks exactly like an empty field, so
 * nothing appears to be wrong. Compute it in BigInt or not at all.
 */
export const ROBINHOOD_COIN_TYPE = 2147488311n
/** Mainnet ETH coinType, also written by the registrar on mint. */
export const ETH_COIN_TYPE = 60n

export const robinhoodChain = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [DEFAULT_ROBINHOOD_RPC] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: ROBINHOOD_EXPLORER },
  },
  // Canonical Multicall3, deployed here at the same address as everywhere else.
  // Every tool batches through it: resolving a name reads nine records, and nine
  // separate round-trips from a Worker is exactly the shape a public RPC throttles.
  contracts: {
    multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' },
  },
})

/**
 * Robinhood Chain client.
 *
 * The public RPC rate-limits per IP and all Cloudflare Workers egress from a small
 * shared pool, so a worker collects 429s that the identical call from a laptop never
 * sees. A dedicated endpoint in the ROBINHOOD_RPC_URL secret is the real fix; the
 * public endpoints stay behind it so a missing secret degrades instead of failing.
 */
export function robinhoodClient(env: Env) {
  const dedicated = envVarOptional('ROBINHOOD_RPC_URL', env)
  const urls = [
    dedicated,
    DEFAULT_ROBINHOOD_RPC,
    FALLBACK_ROBINHOOD_RPC,
  ].filter((url): url is string => Boolean(url))

  return createPublicClient({
    chain: robinhoodChain,
    transport: fallback(
      urls.map((url) =>
        http(url, { retryCount: 2, retryDelay: 200, timeout: 6_000 })
      ),
      // Ranking probes endpoints in the background on every request, which on a
      // rate-limited RPC spends the budget we are trying to conserve.
      { rank: false }
    ),
  })
}

export type RobinhoodClient = ReturnType<typeof robinhoodClient>
