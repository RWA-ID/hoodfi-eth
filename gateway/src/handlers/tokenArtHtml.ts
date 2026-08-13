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

/** Site palette, inlined — satori resolves no CSS variables. */
const LIME = '#C6F702'
const INK = '#0B0E08'

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
const MARGIN = 60
const MAX_PILL_W = SIZE - MARGIN * 2

/**
 * Archivo 800's advance widths, in ems, coarse enough to write down.
 *
 * A single average per glyph is what this started as, and it can't be both safe and
 * tight: mintable labels run from `iiii` to `mmmm`, and an average wide enough to keep
 * the second on the canvas leaves the first floating in the middle of an oversized pill.
 * Satori neither reflows nor shrinks an overflow — it draws the text straight off the
 * edge — so the sizing has to know that `m` is three times `i`.
 *
 * Only a–z, 0–9 and `-` can appear in a label, plus the `.` from the suffix; anything
 * else is unmintable. DEFAULT is the round-lowercase width the alphabet mostly is.
 */
const DEFAULT_ADVANCE = 0.6
const ADVANCE: Record<string, number> = {
  '.': 0.3,
  '-': 0.38,
  i: 0.3,
  j: 0.32,
  l: 0.3,
  f: 0.38,
  t: 0.4,
  r: 0.44,
  s: 0.55,
  z: 0.55,
  m: 0.94,
  w: 0.82,
  1: 0.45,
}

/** Bought back on top of the table, because it is a table of round numbers. */
const SAFETY = 1.04

/** How wide a string sets, in ems. */
function measure(text: string): number {
  let ems = 0
  for (const ch of text) ems += ADVANCE[ch] ?? DEFAULT_ADVANCE
  return ems * SAFETY
}

/** Everything below is in ems, so the whole pill scales with one number. */
const LINE = 1.14
const PAD_Y = 0.42

/**
 * The pill's horizontal padding, given how many lines of type it holds.
 *
 * It is exactly half the pill's own height, which is also its cap radius: text set
 * closer to the end than that sits inside the curve rather than beside it. The stacked
 * form is where it shows — two lines make the pill twice as tall, so its caps are twice
 * as deep, and a padding that looked generous on one line put a 32-character label
 * right up against the turn.
 */
function padX(lines: number): number {
  return (LINE * lines + PAD_Y * 2) / 2
}

/**
 * How big a string can be set inside a pill that still fits the canvas.
 *
 * The pill grows with its text, so its padding is part of what has to fit:
 * `width(text)·size + 2·padX·size ≤ MAX_PILL_W` solved for size.
 */
function fit(text: string, lines: number): number {
  return Math.floor(MAX_PILL_W / (measure(text) + padX(lines) * 2))
}

/**
 * How to set the name so it fills the pill without overflowing it.
 *
 * Labels run to 32 characters and `.hoodfi.eth` costs another 11, so no single size
 * works for the whole range — a 32-character name set on one line lands near 30px on a
 * 1000px canvas, which is a caption, not a token. Past the point where one line stops
 * reading as a name, the tail drops to its own line and both are sized against the
 * longer of the two.
 */
function nameLayout(name: string): { size: number; stack: boolean } {
  const oneLine = fit(name, 1)
  if (oneLine >= 54) return { size: Math.min(132, oneLine), stack: false }
  const { head, tail } = split(name)
  // Sized against whichever line is wider. That is the label in every case that
  // actually stacks, but the tail is measured rather than assumed to be shorter.
  const stacked = Math.min(fit(head, 2), fit(tail, 2))
  return { size: Math.min(132, stacked), stack: true }
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
 * One name, set in the house lime on an ink pill — the same object the site puts on
 * every button and the share card puts under every profile. It says which name the token
 * is, which is the one thing a marketplace grid of identical collection art could never
 * say, and it needs no chain read beyond the name itself: no avatar, no owner, no
 * records, so the image for a given token is fixed the moment it is minted.
 *
 * Takes the whole name, `gm.hoodfi.eth`, not the label — the registry's own root token
 * is `hoodfi.eth`, and it is the one token a label plus a fixed parent gets wrong.
 */
export function tokenArtHtml(fullName: string): string {
  const { size, stack } = nameLayout(fullName)
  const lines = stack ? 2 : 1
  const pad = `${Math.round(size * PAD_Y)}px ${Math.round(size * padX(lines))}px`

  const type = `font-family:Archivo;font-weight:800;font-size:${size}px;line-height:${LINE};letter-spacing:-${(
    size * 0.02
  ).toFixed(1)}px;color:${LIME};`

  // Stacked, the two halves are separate rows; inline, they are one baseline. Satori has
  // no soft-wrap opportunity to lean on, so the choice is made here, not in CSS.
  const { head, tail } = split(fullName)
  const name = stack
    ? `<div style="display:flex;flex-direction:column;align-items:center;${type}">
         <span>${escapeHtml(head)}</span>
         <span>${escapeHtml(tail)}</span>
       </div>`
    : `<div style="display:flex;${type}">${escapeHtml(fullName)}</div>`

  // Radius is the one place this design leaves the site's square geometry: a pill is what
  // the name wears everywhere it is quoted as itself, and a rectangle here would read as
  // a cropped screenshot rather than as a mark.
  return `
<div style="display:flex;align-items:center;justify-content:center;width:${SIZE}px;height:${SIZE}px;background:${LIME};">
  <div style="display:flex;align-items:center;justify-content:center;background:${INK};border-radius:${SIZE}px;padding:${pad};">
    ${name}
  </div>
</div>`.trim()
}
