import type { Hex } from 'viem'

export interface Env {
  /** Gateway signer key — must match HoodfiL1Resolver.signer() on mainnet. */
  SIGNER_PRIVATE_KEY: Hex
  /** Optional RPC override; defaults to the public Robinhood Chain RPC. */
  ROBINHOOD_RPC_URL?: string
  /** Default L2Registry, used when a request doesn't carry a target (POST fallback / resolve-wrapped shape). */
  L2_REGISTRY_ADDRESS?: Hex
  /** Mainnet RPC, for reading donation credits when signing short-name vouchers. */
  MAINNET_RPC_URL?: string
  /** HoodfiDonations on mainnet — the source of truth for earned short-name credits. */
  DONATIONS_ADDRESS?: Hex
  /** HoodfiRegistrar on Robinhood Chain — bound into the voucher digest. */
  REGISTRAR_ADDRESS?: Hex
  /** Optional Analytics Engine binding for the cookieless funnel sink. */
  ANALYTICS?: AnalyticsEngineDataset
}

/** Minimal shape of Cloudflare's Analytics Engine binding. */
export interface AnalyticsEngineDataset {
  writeDataPoint(event: {
    blobs?: string[]
    doubles?: number[]
    indexes?: string[]
  }): void
}

// Loads env var from either `process.env` or Cloudflare's env object.
// Returns NonNullable because it throws when unset — without that, every optional
// field in Env leaks `undefined` into call sites that are already guaranteed a value.
export function envVar<T extends keyof Env>(
  key: T,
  env: Env | undefined
): NonNullable<Env[T]> {
  const value = env?.[key] ?? (process?.env?.[key] as Env[T] | undefined)

  if (!value) {
    throw new Error(`Environment variable ${key} is not set`)
  }

  return value as NonNullable<Env[T]>
}

export function envVarOptional<T extends keyof Env>(
  key: T,
  env: Env | undefined
): Env[T] | undefined {
  return env?.[key] ?? (process?.env?.[key] as Env[T] | undefined)
}
