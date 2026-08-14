/**
 * The token's art, kept apart from the rendering.
 *
 * Same split as `nameCardHtml`, for the same reason: satori's flexbox subset can only be
 * checked by rendering, and this module has no runtime dependency on `workers-og` — no
 * wasm, no worker globals — so the exact markup that ships can be built in plain Node and
 * screenshotted in a browser.
 */

/** Square, because every marketplace grid is. 1000px is generous for a flat two-colour
 *  image and keeps the render cheap. */
export const SIZE = 1000

/**
 * Site palette, inlined — satori resolves no CSS variables.
 *
 * These are the lime section's own tokens, not approximations of them: on lime the site
 * sets `--fg` to ink and `--faint` to ink at half strength, which is the pair the manage
 * page's name cards already use for a label and its suffix.
 */
const LIME = '#C6F702'
const INK = '#0B0E08'
const FAINT = 'rgba(11, 14, 8, 0.5)'

/**
 * A name splits into the part that identifies it and the part that says where it lives:
 * `gm` and `.hoodfi.eth`. The registry holds the parent `hoodfi.eth` as a token too, so
 * the tail is whatever follows the first dot rather than a constant — assuming
 * `.hoodfi.eth` is what drew the root token's art as `hoodfi.hoodfi.eth`.
 */
function split(name: string): { head: string; tail: string } {
  const dot = name.indexOf('.')
  if (dot < 0) return { head: name, tail: '' }
  return { head: name.slice(0, dot), tail: name.slice(dot) }
}

/** The lime the name is not allowed to touch. */
const MARGIN = 90
const MAX_W = SIZE - MARGIN * 2

/**
 * IBM Plex Mono's advance width, in ems — one number, because it is monospaced.
 *
 * This replaces a per-glyph table that Archivo needed, where `m` set three times as wide
 * as `i` and a single average could not be both safe for `mmmm` and tight for `iiii`.
 * Satori neither reflows nor shrinks an overflow, so the sizing still has to be exact;
 * the mono face is what makes exact cheap. SAFETY is bought back on top for hinting.
 */
const ADVANCE = 0.6
const SAFETY = 1.02

/** How wide a string sets, in ems. */
function measure(text: string): number {
  return text.length * ADVANCE * SAFETY
}

/**
 * The label's size, and the cap that stops a short one becoming a poster.
 *
 * The label gets the full width to itself — that is the whole point of dropping the
 * suffix to its own line — so a 32-character name lands near 42px rather than the 30px it
 * managed when `.hoodfi.eth` was sharing the line. The cap is set where a five-character
 * name fills the measure: past that, growing further would only make three letters look
 * like an accident rather than a mark.
 */
const MAX_LABEL = 300

/**
 * The suffix, which is the same eleven characters on every token in the collection.
 *
 * Fixed rather than proportional, up to a point: a constant `.hoodfi.eth` under a varying
 * name is what makes a grid of these read as one collection. The two bounds are where a
 * constant stops working — a 32-character label sets smaller than 95px, and a suffix left
 * at full size would then be larger than the name it belongs to, so it tracks the label
 * down. It is also never allowed to set wider than the name above it, which is what keeps
 * a two-letter name from looking like a caption for its own domain.
 */
const SUFFIX_MAX = 52
const SUFFIX_RATIO = 0.55

function suffixSize(labelSize: number, labelWidth: number, tail: string): number {
  const proportional = Math.round(labelSize * SUFFIX_RATIO)
  const noWiderThanName = Math.floor(labelWidth / measure(tail))
  return Math.max(1, Math.min(SUFFIX_MAX, proportional, noWiderThanName))
}

/**
 * The name is normalised before it reaches here — a–z, 0–9, hyphens and dots only — so
 * this escapes nothing that can currently occur. It stays because the guarantee lives in
 * another module, and markup built by string concatenation should not depend on one.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * The art every hoodfi.eth name carries as its NFT image.
 *
 * One name set on the house lime, in the type the site uses for anything that is data,
 * laid out exactly as the manage page's cards lay out a name you own: the label, and the
 * suffix quieter underneath it. It says which name the token is, which is the one thing a
 * marketplace grid of identical collection art could never say, and it needs no chain read
 * beyond the name itself: no avatar, no owner, no records, so the image for a given token
 * is fixed the moment it is minted.
 *
 * Takes the whole name, `gm.hoodfi.eth`, not the label — the registry's own root token
 * is `hoodfi.eth`, and it is the one token a label plus a fixed parent gets wrong.
 */
export function tokenArtHtml(fullName: string): string {
  const { head, tail } = split(fullName)

  const label = Math.min(MAX_LABEL, Math.floor(MAX_W / measure(head)))
  const labelWidth = measure(head) * label
  const suffix = suffixSize(label, labelWidth, tail)

  // Mono, so no optical tightening: `.data` sets letter-spacing to 0 and this is the same
  // type doing the same job. Line-height is 1 because the gap below is set deliberately.
  //
  // Unquoted, as the share card writes it. The declaration goes inside a double-quoted
  // `style` attribute, so quoting the family name closes the attribute early and silently
  // drops every rule after it — the size included, which renders at a default 16px on a
  // 1000px canvas and looks like nothing more than a spacing bug.
  const type = `font-family:IBM Plex Mono;line-height:1;`

  const suffixLine = tail
    ? `<div style="display:flex;${type}font-weight:400;font-size:${suffix}px;color:${FAINT};margin-top:${Math.round(
        suffix * 0.55
      )}px;">${escapeHtml(tail)}</div>`
    : ''

  return `
<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:${SIZE}px;height:${SIZE}px;background:${LIME};">
  <div style="display:flex;${type}font-weight:600;font-size:${label}px;color:${INK};">${escapeHtml(head)}</div>
  ${suffixLine}
</div>`.trim()
}
