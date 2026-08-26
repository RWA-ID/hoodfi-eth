/**
 * The token's art, kept apart from the rendering.
 *
 * Same split as `nameCardHtml`, for the same reason: satori's flexbox subset can only be
 * checked by rendering, and this module has no runtime dependency on `workers-og` — no
 * wasm, no worker globals — so the exact markup that ships can be built in plain Node and
 * screenshotted in a browser. It also cannot be checked any other way: workers-og's wasm
 * will not initialise outside the Workers runtime, so there is no local satori to run.
 */

/** Square, because every marketplace grid is. 1000px is generous for a flat two-colour
 *  image and keeps the render cheap. */
export const SIZE = 1000

/**
 * Site palette, inlined — satori resolves no CSS variables.
 *
 * These are the lime section's own tokens, not approximations of them: on lime the site
 * sets `--fg` to ink and `--faint` to ink at half strength, which is the pair the homepage
 * identity card already uses for a name and its suffix.
 */
const LIME = '#C6F702'
const INK = '#0B0E08'
const FAINT = 'rgba(11, 14, 8, 0.5)'
/**
 * The same half-strength relationship as FAINT, measured from the other ground: paper at
 * 50% on ink. Taken from `nameCardHtml`'s ON_INK_LABEL rather than picked, so the two
 * grounds mute their suffix by the same amount and the pair reads as one system inverted
 * rather than as two designs.
 */
const ON_INK_FAINT = 'rgba(241, 241, 234, 0.5)'

/**
 * Which ground a name is drawn on.
 *
 * A subname is not a lesser name, but it is a different thing to buy: `crypto.gm.hoodfi.eth`
 * is issued by whoever holds `gm.hoodfi.eth`, not by HoodFi, and nothing about a lime tile
 * said so. On a marketplace grid the two sat side by side identically, which is the one
 * place the distinction has to survive — a buyer there sees the picture and the price, and
 * has no reason to count the dots.
 *
 * Inverting the ground rather than restyling the type is deliberate: it separates the two
 * at thumbnail size, where a grid is actually read, and it costs the collection nothing
 * because both tiles keep the same lime, the same face and the same flush-left block.
 */
const GROUNDS = {
  issued: { bg: LIME, head: INK, tail: FAINT },
  sub: { bg: INK, head: LIME, tail: ON_INK_FAINT },
} as const

/**
 * Is this name a subname of a hoodfi.eth name, rather than one HoodFi issued directly?
 *
 * Counted in segments because that is the whole of the distinction: `hoodfi.eth` is the
 * root, `adam.hoodfi.eth` is a name HoodFi sold, and anything longer was created by a
 * holder through `createSubnode`. Names nest to any depth, so this is a floor, not an
 * equality — `a.b.c.hoodfi.eth` is as much a subname as `crypto.gm.hoodfi.eth`.
 */
function isSubname(fullName: string): boolean {
  return fullName.split('.').length > 3
}

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

/**
 * The lime the name is not allowed to touch.
 *
 * The block is set flush left against this rather than centred: two lines of different
 * lengths centred against each other wander, and a common left edge is what makes the
 * label and the parent read as one object.
 */
const MARGIN = 110
const MAX_W = SIZE - MARGIN * 2

/**
 * Archivo 800's advance widths, in ems, coarse enough to write down.
 *
 * A single average per glyph is what this started as, and it can't be both safe and
 * tight: mintable labels run from `iiii` to `mmmm`, and an average wide enough to keep
 * the second on the canvas leaves the first floating in the middle of the tile. Satori
 * neither reflows nor shrinks an overflow — it draws the text straight off the edge — so
 * the sizing has to know that `m` is three times `i`.
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

/**
 * One type size for the whole collection, not one per name.
 *
 * Sizing each name to fill the measure is what made a grid of these look like four
 * unrelated pictures: the thing that varied tile to tile was the type rather than the
 * name. A collection has to read as one system, so the size is a constant and the name is
 * the only variable in it.
 *
 * 138 is measured, not chosen by eye. Stacking is what buys it: the longest line any
 * current token has to set is `archeri0nn` at 10 characters, and the parent line is the
 * same `.hoodfi.eth` every time, so the constant is bounded by two short strings instead
 * of one 21-character one. Set on a single line the same uniformity costs 72px — roughly
 * half — which is the whole argument for the stacked form at thumbnail size.
 *
 * `archeri0nn` clears the margins at 139, so the constant sits one under that with the
 * rounding absorbed: set it any higher and that one token drops a pixel below its
 * neighbours. Invisible alone, but the entire point here is that nothing varies.
 *
 * A label past 10 characters is sized down and will not match its neighbours. That is the
 * one case this cannot have both ways; see `typeSize`.
 */
const BASE_SIZE = 138

/**
 * The size this name is set at: the constant, unless a line is too long to wear it.
 *
 * Measured against the wider of the two lines, not just the label — the parent line is
 * longer than any label under 10 characters, so it is what actually binds for most of the
 * collection. Satori neither reflows nor shrinks an overflow, it draws the text straight
 * off the edge, so anything past the uniform range has to be measured down here.
 */
function typeSize(lines: string[]): number {
  const widest = Math.max(...lines.map(measure))
  return Math.min(BASE_SIZE, Math.floor(MAX_W / widest))
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
 * The name in two flush-left lines, set the way the homepage identity card sets a name:
 * Archivo at its heaviest, the label over the parent in a muted half-strength grey. It says
 * which name the token is, which is the one thing a marketplace grid of identical
 * collection art could never say, and it needs no chain read beyond the name itself: no
 * avatar, no owner, no records, so the image for a given token is fixed the moment it is
 * minted.
 *
 * The ground says who issued it — house lime for a name HoodFi sold, inverted onto ink for
 * a holder's subname. See GROUNDS: that is the one distinction a marketplace thumbnail has
 * to carry, because it is the one a buyer cannot get from the picture any other way.
 *
 * Takes the whole name, `gm.hoodfi.eth`, not the label — the registry's own root token is
 * `hoodfi.eth`, and it is the one token a label plus a fixed parent gets wrong. Splitting
 * at the first dot rather than assuming a fixed parent is what lets it read `hoodfi` over
 * `eth` instead of claiming to be `hoodfi.hoodfi.eth`.
 */
export function tokenArtHtml(fullName: string): string {
  const { head, tail } = split(fullName)

  // The joining dot leads the second line rather than trailing the first. That is how the
  // site writes a suffix everywhere it appears — the homepage identity card and the manage
  // page both set `.hoodfi.eth` as one grey run — so the art matches rather than inventing
  // a second convention for the same string.
  const parent = tail
  const size = typeSize(parent ? [head, parent] : [head])

  // Unquoted family, as the share card writes it. The declaration goes inside a
  // double-quoted `style` attribute, so quoting the family name closes the attribute early
  // and silently drops every rule after it — the size included, which then renders at a
  // default 16px on a 1000px canvas and reads as a layout bug rather than a broken rule.
  const type = `font-family:Archivo;font-weight:800;font-size:${size}px;line-height:1.28;letter-spacing:-${(
    size * 0.025
  ).toFixed(1)}px;`

  const ground = isSubname(fullName) ? GROUNDS.sub : GROUNDS.issued

  const parentLine = parent
    ? `<div style="display:flex;color:${ground.tail};">${escapeHtml(parent)}</div>`
    : ''

  return `
<div style="display:flex;align-items:center;width:${SIZE}px;height:${SIZE}px;background:${ground.bg};padding-left:${MARGIN}px;">
  <div style="display:flex;flex-direction:column;align-items:flex-start;${type}">
    <div style="display:flex;color:${ground.head};">${escapeHtml(head)}</div>
    ${parentLine}
  </div>
</div>`.trim()
}
