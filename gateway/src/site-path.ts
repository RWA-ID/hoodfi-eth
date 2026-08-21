/**
 * What identifies a name being published on: its whole path below `hoodfi.eth`.
 *
 * Deliberately free of imports, so it can be exercised directly by a script — the same
 * reason `tokenArtHtml.ts` has none. It is the one piece of the publish protocol whose
 * answer has to match the builder's exactly, and getting it wrong is not visible in
 * anything you can look at: it silently addresses a different name.
 */

/** Deepest path we'll serve. A namehash of arbitrary depth is probing, not publishing. */
export const MAX_DEPTH = 8

/** Longest path, before `.hoodfi.eth`. */
export const MAX_LENGTH = 255

/**
 * The path below `hoodfi.eth`, or '' if it isn't one we'd serve.
 *
 * Accepts any depth — `agent`, `crypto.gm`, `a.b.gm` — because subnames go any depth and
 * cost only gas.
 *
 * The first version of this took a single label and rejected every dot, which quietly
 * made subnames unpublishable in a way that cost somebody a real payment. The editor
 * sent the leftmost label, so this function accepted `crypto` where the name was
 * `crypto.gm`: the pin and the signature were checked against `crypto.hoodfi.eth` while
 * the payment was made on the node of `crypto.gm.hoodfi.eth`. Both halves succeeded, and
 * the publish then died on "No payment found on chain for this site yet" — over a
 * payment that had landed, against a name that had never been asked about.
 *
 * A trailing `.hoodfi.eth` is tolerated because callers have sent both forms.
 */
export function normalizeSitePath(raw: string): string {
  const path = raw.trim().toLowerCase().replace(/\.hoodfi\.eth$/, '')
  if (!path || path.length > MAX_LENGTH) return ''
  const labels = path.split('.')
  if (labels.length > MAX_DEPTH) return ''
  return labels.every((label) => /^[a-z0-9-]{1,63}$/.test(label)) ? path : ''
}
