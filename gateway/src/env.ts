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
  /** First block that can hold a donation; bounds the ledger's log query. */
  DONATIONS_DEPLOY_BLOCK?: string
  /** HoodfiRegistrar on Robinhood Chain — bound into the voucher digest. */
  REGISTRAR_ADDRESS?: Hex
  /** Public origin the share pages link back to. Defaults to the hosted domain. */
  SITE_URL?: string
  /** Pinata JWT for avatar uploads. Secret — it must never reach the bundle. */
  PINATA_JWT?: string
  /** Optional Analytics Engine binding for the cookieless funnel sink. */
  ANALYTICS?: AnalyticsEngineDataset
  /** Resend credential for partner enquiries. Secret — it must never reach the bundle. */
  RESEND_API_KEY?: string
  /** The one address partner enquiries are delivered to. Never caller-supplied. */
  PARTNER_NOTIFY_TO?: string
  /**
   * Envelope sender. Resend will only accept a `from` on a verified domain, and ours
   * is `mail.onchain-id.id` exactly — a bare `onchain-id.id` is a different domain to
   * Resend and is rejected, not treated as a parent.
   */
  PARTNER_FROM?: string
}

/** Minimal shape of Cloudflare's Analytics Engine binding. */
export interface AnalyticsEngineDataset {
  writeDataPoint(event: {
    blobs?: string[]
    doubles?: number[]
    indexes?: string[]
  }): void
}

/**
 * Reads from Cloudflare's env object, falling back to `process.env` under Node.
 *
 * The `typeof` guard is load-bearing. Workers has no `process` binding without
 * `nodejs_compat`, and optional chaining does NOT make an *undeclared* identifier
 * safe — `process?.env` throws ReferenceError, it does not evaluate to undefined.
 * So the old fallback blew up on any var that wasn't set, which is exactly the case
 * the fallback existed to handle.
 */
function readEnv<T extends keyof Env>(key: T, env: Env | undefined): Env[T] | undefined {
  const fromBinding = env?.[key]
  if (fromBinding !== undefined) return fromBinding
  if (typeof process === 'undefined') return undefined
  return process.env?.[key] as Env[T] | undefined
}

// Returns NonNullable because it throws when unset — without that, every optional
// field in Env leaks `undefined` into call sites that are already guaranteed a value.
export function envVar<T extends keyof Env>(
  key: T,
  env: Env | undefined
): NonNullable<Env[T]> {
  const value = readEnv(key, env)

  if (!value) {
    throw new Error(`Environment variable ${key} is not set`)
  }

  return value as NonNullable<Env[T]>
}

export function envVarOptional<T extends keyof Env>(
  key: T,
  env: Env | undefined
): Env[T] | undefined {
  return readEnv(key, env)
}
