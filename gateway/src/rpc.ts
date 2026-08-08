import { http, createPublicClient, fallback } from 'viem'
import { mainnet } from 'viem/chains'

import {
  DEFAULT_ROBINHOOD_RPC,
  FALLBACK_ROBINHOOD_RPC,
  robinhoodChain,
} from './chains'
import { type Env, envVarOptional } from './env'

/**
 * Robinhood Chain client, shared by every handler that reads L2 state.
 *
 * The public RPC rate-limits per IP and all Cloudflare Workers egress from a small
 * shared pool, so this worker collects 429s that the identical call from a laptop
 * never sees — measured 2/12 success from the worker against 15/15 direct. That is
 * what silently emptied every CCIP answer.
 *
 * A dedicated endpoint in the ROBINHOOD_RPC_URL secret is the real fix. The public
 * endpoints stay behind it so a missing or expired secret degrades to the old
 * behaviour instead of taking resolution down entirely.
 *
 * Note ROBINHOOD_RPC_URL must NOT also be declared in wrangler.toml [vars] — a
 * plain var of the same name shadows the secret on every deploy.
 */
export function robinhoodClient(env: Env) {
  const dedicated = envVarOptional('ROBINHOOD_RPC_URL', env)
  const urls = [dedicated, DEFAULT_ROBINHOOD_RPC, FALLBACK_ROBINHOOD_RPC].filter(
    (url): url is string => Boolean(url)
  )

  return createPublicClient({
    chain: robinhoodChain,
    transport: fallback(
      urls.map((url) => http(url, { retryCount: 2, retryDelay: 200, timeout: 6_000 })),
      // Ranking probes endpoints in the background on every request, which on a
      // rate-limited RPC spends the budget we are trying to conserve.
      { rank: false }
    ),
  })
}

/** Mainnet client for the donation-credit reads behind short-name vouchers. */
export function mainnetClient(env: Env) {
  const dedicated = envVarOptional('MAINNET_RPC_URL', env)
  return createPublicClient({
    chain: mainnet,
    transport: dedicated
      ? http(dedicated, { retryCount: 2, retryDelay: 200, timeout: 6_000 })
      : http(undefined, { retryCount: 2, retryDelay: 200, timeout: 6_000 }),
  })
}
