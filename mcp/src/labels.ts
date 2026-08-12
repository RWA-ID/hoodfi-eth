/**
 * Server-side mirror of LabelUtils.sol. The contract enforces the same rules — this
 * exists so a tool call can explain the problem in words instead of handing an agent
 * calldata that is guaranteed to revert.
 */

export const PARENT = 'hoodfi.eth'
export const MAX_LABEL_LENGTH = 32

/** Shortest label anyone can mint without spending a donation credit. */
export const PUBLIC_MIN_LENGTH = 4

export type LabelCheck =
  | { ok: true; label: string }
  | { ok: false; reason: string }

/** Accepts `foo`, `foo.hoodfi.eth` or `foo.eth` and returns the bare label. */
export function normalizeLabel(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\.hoodfi\.eth$/, '')
    .replace(/\.eth$/, '')
}

export function checkLabel(input: string): LabelCheck {
  const label = normalizeLabel(input)
  if (label.length === 0) return { ok: false, reason: 'Name is empty' }
  if (label.length > MAX_LABEL_LENGTH)
    return {
      ok: false,
      reason: `Names are at most ${MAX_LABEL_LENGTH} characters`,
    }
  if (!/^[a-z0-9-]+$/.test(label))
    return {
      ok: false,
      reason:
        'Names may only contain a-z, 0-9 and hyphens. Unicode and uppercase are rejected on-chain.',
    }
  if (label.startsWith('-') || label.endsWith('-'))
    return { ok: false, reason: 'Names cannot start or end with a hyphen' }
  return { ok: true, label }
}

/** Tier index 0-3 (1 char, 2 chars, 3 chars, 4+). Mirrors LabelUtils.tierOf. */
export function tierOf(label: string): number {
  return label.length >= 4 ? 3 : label.length - 1
}

/** True for 1-3 character names — premium inventory, gated behind donation credits. */
export function isShort(label: string): boolean {
  return label.length > 0 && label.length < PUBLIC_MIN_LENGTH
}

export function fullName(label: string): string {
  return `${label}.${PARENT}`
}

/** HoodfiRegistrar.status() codes, in words. */
export const STATUS_TEXT: Record<number, string> = {
  0: 'available',
  1: 'taken',
  2: 'locked',
  3: 'invalid',
  4: 'blocked',
}
