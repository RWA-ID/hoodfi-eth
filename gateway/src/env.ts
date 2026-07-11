import type { Hex } from 'viem'

export interface Env {
  /** Gateway signer key — must match HoodfiL1Resolver.signer() on mainnet. */
  SIGNER_PRIVATE_KEY: Hex
  /** Optional RPC override; defaults to the public Robinhood Chain RPC. */
  ROBINHOOD_RPC_URL?: string
  /** Default L2Registry, used when a request doesn't carry a target (POST fallback / resolve-wrapped shape). */
  L2_REGISTRY_ADDRESS?: Hex
}

// Loads env var from either `process.env` or Cloudflare's env object
export function envVar<T extends keyof Env>(
  key: T,
  env: Env | undefined
): Env[T] {
  const value = env?.[key] ?? (process?.env?.[key] as Env[T] | undefined)

  if (!value) {
    throw new Error(`Environment variable ${key} is not set`)
  }

  return value as Env[T]
}

export function envVarOptional<T extends keyof Env>(
  key: T,
  env: Env | undefined
): Env[T] | undefined {
  return env?.[key] ?? (process?.env?.[key] as Env[T] | undefined)
}
