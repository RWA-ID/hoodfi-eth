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

export type HoodfiNameCheck =
  | { ok: true; labels: string[] }
  | { ok: false; reason: string }

/**
 * For tools that pay a name or report who holds it: the labels under hoodfi.eth, or a
 * reason to refuse.
 *
 * normalizeLabel turns "vitalik.eth" into "vitalik". When minting that is a convenience:
 * you get the name you typed. When paying it is a hazard: vitalik.hoodfi.eth is a
 * different name that anyone can mint, so "send to vitalik.eth" would pay whoever did.
 * The same goes for "jesse.base.eth", which whoever holds base.hoodfi.eth can create for
 * free. So only two shapes pass: a single bare label, or a name ending in .hoodfi.eth.
 * Nothing is stripped twice, so "foo.eth.hoodfi.eth" stays a two-label name.
 */
export function checkHoodfiName(input: string): HoodfiNameCheck {
  const name = input.trim().toLowerCase()
  const suffix = `.${PARENT}`
  let labels: string[]
  if (name.endsWith(suffix)) labels = name.slice(0, -suffix.length).split('.')
  else if (!name.includes('.')) labels = [name]
  else if (name === PARENT)
    return { ok: false, reason: `${PARENT} is the parent name itself, not a name anyone holds.` }
  else if (name.endsWith('.eth'))
    return {
      ok: false,
      reason: `${name} is not a hoodfi.eth name. ${name.slice(0, -'.eth'.length)}${suffix} would be a different name, possibly held by someone else, so it is not substituted. Look ${name} up with an ENS tool on Ethereum instead.`,
    }
  else
    return {
      ok: false,
      reason: `"${name}" is not a hoodfi.eth name. Give a bare name ("gm") or the full name ending in ${suffix} ("jack.gm${suffix}").`,
    }
  for (const label of labels) {
    const check = checkLabel(label)
    if (!check.ok) return { ok: false, reason: `"${label}": ${check.reason}` }
  }
  return { ok: true, labels }
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
