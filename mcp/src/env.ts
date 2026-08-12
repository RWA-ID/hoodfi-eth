import type { Hex } from 'viem'

export interface Env {
  /** Optional dedicated RPC. Secret — it carries an API key. */
  ROBINHOOD_RPC_URL?: string
  /** HoodfiRegistrar on Robinhood Chain. */
  REGISTRAR_ADDRESS?: Hex
  /** L2Registry — the ERC-721 that holds the names and their records. */
  L2_REGISTRY_ADDRESS?: Hex
  /** USDG, the stablecoin the registrar accepts alongside ETH. */
  USDG_ADDRESS?: Hex
}

/**
 * Reads from Cloudflare's env object, falling back to `process.env` under Node.
 *
 * The `typeof` guard is load-bearing. Workers has no `process` binding without
 * `nodejs_compat`, and optional chaining does NOT make an *undeclared* identifier
 * safe — `process?.env` throws ReferenceError, it does not evaluate to undefined.
 */
function readEnv<T extends keyof Env>(
  key: T,
  env: Env | undefined
): Env[T] | undefined {
  const fromBinding = env?.[key]
  if (fromBinding !== undefined) return fromBinding
  if (typeof process === 'undefined') return undefined
  return process.env?.[key] as Env[T] | undefined
}

export function envVar<T extends keyof Env>(
  key: T,
  env: Env | undefined
): NonNullable<Env[T]> {
  const value = readEnv(key, env)
  if (!value) throw new Error(`Environment variable ${key} is not set`)
  return value as NonNullable<Env[T]>
}

export function envVarOptional<T extends keyof Env>(
  key: T,
  env: Env | undefined
): Env[T] | undefined {
  return readEnv(key, env)
}
