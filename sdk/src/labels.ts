/**
 * Label rules, mirroring LabelUtils.sol (and mcp/src/labels.ts). The contract enforces
 * the same rules; this exists so a bad name fails with a sentence before any RPC call.
 */

import { PARENT } from './constants.js'

export const MAX_LABEL_LENGTH = 32
/** Shortest label at the $3 floor. 1-3 characters are premium tiers ($15 / $10 / $5). */
export const PUBLIC_MIN_LENGTH = 4

export type LabelCheck = { ok: true; label: string } | { ok: false; reason: string }

/**
 * Accepts `foo`, `foo.hoodfi.eth` or `foo.eth` and returns the bare label.
 *
 * Only for minting, where "you typed vitalik.eth, here is vitalik.hoodfi.eth" is a
 * convenience. Never use it to decide who to pay: see {@link checkHoodfiName}.
 */
export function normalizeLabel(input: string): string {
  return input.trim().toLowerCase().replace(/\.hoodfi\.eth$/, '').replace(/\.eth$/, '')
}

export function checkLabel(input: string): LabelCheck {
  const label = normalizeLabel(input)
  if (label.length === 0) return { ok: false, reason: 'Name is empty' }
  if (label.length > MAX_LABEL_LENGTH)
    return { ok: false, reason: `Names are at most ${MAX_LABEL_LENGTH} characters` }
  if (!/^[a-z0-9-]+$/.test(label))
    return {
      ok: false,
      reason: 'Names may only contain a-z, 0-9 and hyphens. Unicode and uppercase are rejected on-chain.',
    }
  if (label.startsWith('-') || label.endsWith('-'))
    return { ok: false, reason: 'Names cannot start or end with a hyphen' }
  return { ok: true, label }
}

export type HoodfiNameCheck = { ok: true; labels: string[]; name: string } | { ok: false; reason: string }

/**
 * For reading or paying a name: its labels under hoodfi.eth, or a reason to refuse.
 *
 * Stricter than {@link normalizeLabel} on purpose. `vitalik.eth` is NOT rewritten to
 * `vitalik.hoodfi.eth`: that is a different name anyone can mint, so "pay vitalik.eth"
 * would pay whoever did. Only a bare label or a name ending in `.hoodfi.eth` passes.
 */
export function checkHoodfiName(input: string): HoodfiNameCheck {
  const name = input.trim().toLowerCase()
  const suffix = `.${PARENT}`
  let labels: string[]
  if (name.endsWith(suffix)) labels = name.slice(0, -suffix.length).split('.')
  else if (!name.includes('.')) labels = [name]
  else if (name === PARENT) return { ok: false, reason: `${PARENT} is the parent name itself, not a name anyone holds.` }
  else if (name.endsWith('.eth'))
    return {
      ok: false,
      reason: `${name} is not a hoodfi.eth name. ${name.slice(0, -'.eth'.length)}${suffix} would be a different name, possibly held by someone else, so it is not substituted. Resolve ${name} with ENS on Ethereum instead.`,
    }
  else
    return {
      ok: false,
      reason: `"${name}" is not a hoodfi.eth name. Give a bare name ("gm") or the full name ending in ${suffix} ("jack.gm${suffix}").`,
    }
  for (const label of labels) {
    const check = checkLabel(label)
    if (!check.ok) return { ok: false, reason: `"${label}": ${check.reason}` }
    // checkLabel would also strip a trailing ".eth"; a label here never contains a dot.
  }
  return { ok: true, labels, name: `${labels.join('.')}${suffix}` }
}

/** Tier index 0-3 (1 char, 2 chars, 3 chars, 4+). Mirrors LabelUtils.tierOf. */
export function tierOf(label: string): 0 | 1 | 2 | 3 {
  return (label.length >= 4 ? 3 : label.length - 1) as 0 | 1 | 2 | 3
}

export function fullName(label: string): string {
  return `${label}.${PARENT}`
}

export type NameStatus = 'available' | 'taken' | 'locked' | 'invalid' | 'blocked'

/** HoodfiRegistrar.status() codes, in words. */
export const STATUS_TEXT: Record<number, NameStatus> = {
  0: 'available',
  1: 'taken',
  2: 'locked',
  3: 'invalid',
  4: 'blocked',
}
