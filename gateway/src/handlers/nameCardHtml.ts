import { BRAND_MARK_DATA_URI } from '../brand-mark'

/**
 * The share card's layout, kept apart from the rendering.
 *
 * Splitting it out is not tidiness: satori's flexbox subset can only be checked by
 * rendering, and this module has no runtime dependency on `workers-og` — no wasm, no
 * worker globals — so the exact markup that ships can be built in plain Node and
 * screenshotted in a browser. Anything that imports the renderer cannot be.
 */

export const WIDTH = 1200
export const HEIGHT = 630

/** Site palette, inlined — satori resolves no CSS variables. */
const PAPER = '#F1F1EA'
const PAPER_ALT = '#E9EAE1'
const INK = '#0B0E08'
const LIME = '#C6F702'
/** On paper. Lime is a ground, never a label — olive is its stand-in as text. */
const OLIVE = '#4A5A18'
const DIM = 'rgba(11,14,8,.66)'
const LABEL = 'rgba(11,14,8,.55)'
const LINE = 'rgba(11,14,8,.18)'
/** On ink. */
const ON_INK = 'rgba(241,241,234,.85)'
const ON_INK_LABEL = 'rgba(241,241,234,.5)'
const ON_INK_FAINT = 'rgba(241,241,234,.42)'
const ON_INK_LINE = 'rgba(241,241,234,.16)'

/** Rail, gutter and card add up to WIDTH minus the two 64px page margins. */
const RAIL_W = 416
const CARD_W = 608
/** The card's own horizontal padding, so the name knows what it has to fit inside. */
const CARD_PAD = 32

const SUFFIX = '.hoodfi.eth'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * How to set the name so it fills the card without overflowing it.
 *
 * Labels run to 32 characters, so no single size works for the whole range. Monospace
 * makes the width exactly predictable: N glyphs at 0.6em apiece for Plex Mono. The
 * 0.68 divisor buys the difference back as margin — satori will not reflow an overflow
 * for us, and a name that runs to both edges of the card reads as a mistake even when
 * it technically fits.
 *
 * Below 28px the one-line form stops being a headline and starts being fine print, so
 * past that the suffix drops to its own line and the label gets sized on its own.
 */
function nameLayout(label: string): { size: number; stack: boolean } {
  const inner = CARD_W - CARD_PAD * 2
  const oneLine = Math.floor(inner / (0.68 * (label.length + SUFFIX.length)))
  if (oneLine >= 28) return { size: Math.min(46, oneLine), stack: false }
  const stacked = Math.floor(inner / (0.68 * Math.max(label.length, SUFFIX.length)))
  return { size: Math.min(46, stacked), stack: true }
}

/**
 * A flexible gap that pushes what follows it to the far edge.
 *
 * `justify-content: space-between` is accepted and then ignored by satori's layout —
 * a row using it renders centred, with the slack split either side of the group rather
 * than between its children. An explicit grown spacer is the part of the flex model
 * that does survive.
 */
const SPACER = '<div style="display:flex;flex-grow:1;"></div>'

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function shortAddress(value: string): string {
  return value ? `${value.slice(0, 6)}…${value.slice(-6)}` : '—'
}

/**
 * The mark, drawn at whatever size the slot needs.
 *
 * The source PNG is a single green glyph, which reads on paper — it is the site's own
 * header treatment — but goes muddy on ink. `invert` is not available in satori, so the
 * rail keeps the green mark and the ink card carries no mark at all; its wordmark row
 * is set in Plex Mono, which is how the ProfileCard header reads anyway.
 */
function mark(size: number): string {
  return `<img src="${BRAND_MARK_DATA_URI}" width="${size}" height="${size}" style="width:${size}px;height:${size}px;" />`
}

/**
 * The avatar, square and hairlined.
 *
 * Square because every avatar on the site is square now — the only circle in this design
 * is the tier radio on the homepage. The fallback is the house mark rather than the
 * name's initials: initials read as a deliberate monogram, as something the owner chose,
 * when the truth is that no avatar is set at all.
 */
function avatarBlock(avatar: string): string {
  const DISC = 132
  if (avatar) {
    return `<img src="${escapeHtml(avatar)}" width="${DISC}" height="${DISC}" style="width:${DISC}px;height:${DISC}px;object-fit:cover;border:1px solid ${ON_INK_LINE};" />`
  }
  return `<div style="display:flex;align-items:center;justify-content:center;width:${DISC}px;height:${DISC}px;border:1px solid ${ON_INK_LINE};background:rgba(241,241,234,0.06);">${mark(
    DISC / 2
  )}</div>`
}

/** One cell of the three-up strip under the name. */
function statCell(label: string, value: string, lime: boolean, first: boolean): string {
  return `<div style="display:flex;flex-direction:column;flex-grow:1;flex-basis:0;padding:15px 20px;${
    first ? '' : `border-left:1px solid ${ON_INK_LINE};`
  }">
    <span style="font-family:IBM Plex Mono;font-size:12px;letter-spacing:2.2px;color:${ON_INK_FAINT};">${escapeHtml(
      label
    )}</span>
    <span style="font-family:IBM Plex Mono;font-size:17px;margin-top:7px;color:${lime ? LIME : PAPER};">${escapeHtml(
      value
    )}</span>
  </div>`
}

/**
 * The card markup.
 *
 * This is the `ProfileCard` component redrawn for satori, which supports a flexbox
 * subset only: every container with more than one child needs an explicit
 * `display:flex`, there is no CSS variable resolution, and there are no gradients worth
 * relying on. That costs nothing here — the design is flat by construction. Radius is
 * zero throughout, rules are hairlines, and the one hard offset shadow the site uses is
 * drawn as a second, offset ink rectangle behind the card, because satori has no
 * box-shadow.
 *
 * Everything else — the header rule, the square avatar, the three-up stat strip, the
 * lime vanity-URL bar — is the same object the owner sees on /search and /manage, which
 * is the point: the thing they share is the thing they were looking at.
 */
export function cardHtml(opts: {
  label: string
  avatar: string
  owner: string
  description: string
  token: string
}): string {
  const { label, avatar, owner, description, token } = opts
  const { size, stack } = nameLayout(label)

  const suffixSpan = `<span style="color:${ON_INK_FAINT};">${SUFFIX}</span>`
  // Stacked, the two halves are separate rows; inline, they are one baseline. Satori
  // has no soft-wrap opportunity to lean on, so the choice is made here, not in CSS.
  const nameBlock = stack
    ? `<div style="display:flex;flex-direction:column;align-items:center;font-family:IBM Plex Mono;font-weight:600;font-size:${size}px;line-height:1.12;color:${PAPER};">
         <span>${escapeHtml(label)}</span>
         ${suffixSpan}
       </div>`
    : `<div style="display:flex;font-family:IBM Plex Mono;font-weight:600;font-size:${size}px;line-height:1.12;color:${PAPER};">${escapeHtml(
        label
      )}${suffixSpan}</div>`

  // The address deliberately isn't the fallback here: the OWNER cell below already
  // carries it, and two truncations of the same hex on one card reads as a rendering
  // bug rather than as two facts.
  const subtitle = description
    ? truncate(description, 78)
    : 'A lifetime name on Robinhood Chain.'

  // The lime bar has to hold the vanity URL and the chain label without them meeting.
  // "ROBINHOOD CHAIN" and the bar's padding claim ~200px of the 608, and the URL is set
  // at 17px with 1px of tracking — 11.2px a glyph — which leaves room for 34 of them.
  const vanity = truncate(`hoodfi.name/${label}`, 34)

  const card = `
<div style="display:flex;flex-direction:column;width:${CARD_W}px;background:${INK};">

  <div style="display:flex;align-items:center;padding:18px 26px;border-bottom:1px solid ${ON_INK_LINE};">
    <span style="font-family:IBM Plex Mono;font-size:13px;letter-spacing:3px;color:${ON_INK_FAINT};">HOODFI NAMES</span>
    ${SPACER}
    <div style="display:flex;border:1px solid ${LIME};padding:6px 14px;font-family:IBM Plex Mono;font-size:12px;letter-spacing:2.4px;color:${LIME};">LIFETIME</div>
  </div>

  <div style="display:flex;flex-direction:column;align-items:center;padding:34px ${CARD_PAD}px 30px;">
    ${avatarBlock(avatar)}
    <div style="display:flex;margin-top:22px;">${nameBlock}</div>
    <div style="display:flex;margin-top:16px;font-size:20px;line-height:1.35;color:${ON_INK};text-align:center;">${escapeHtml(
      subtitle
    )}</div>
  </div>

  <div style="display:flex;border-top:1px solid ${ON_INK_LINE};">
    ${statCell('TOKEN', token, false, true)}
    ${statCell('OWNER', shortAddress(owner), false, false)}
    ${statCell('EXPIRES', 'Never', true, false)}
  </div>

  <div style="display:flex;align-items:center;background:${LIME};padding:13px 20px;">
    <span style="font-family:IBM Plex Mono;font-weight:600;font-size:17px;letter-spacing:1px;color:${INK};">${escapeHtml(
      vanity
    )}</span>
    ${SPACER}
    <span style="font-family:IBM Plex Mono;font-size:15px;letter-spacing:1.4px;color:rgba(11,14,8,0.65);">ROBINHOOD CHAIN</span>
  </div>
</div>`

  const rail = `
<div style="display:flex;flex-direction:column;justify-content:center;width:${RAIL_W}px;">
  <div style="display:flex;align-items:center;">
    ${mark(30)}
    <span style="font-family:IBM Plex Mono;font-weight:600;font-size:19px;letter-spacing:3.4px;color:${INK};margin-left:12px;">HOODFI.NAME</span>
  </div>
  <div style="display:flex;font-family:Archivo;font-weight:800;font-size:52px;line-height:.96;letter-spacing:-2px;color:${INK};margin-top:34px;">Lifetime ENS names.</div>
  <div style="display:flex;font-size:20px;font-weight:500;line-height:1.45;color:${DIM};margin-top:20px;">One name, on Robinhood Chain. Minted once, owned forever.</div>
  <div style="display:flex;align-items:center;margin-top:30px;padding-top:22px;border-top:1px solid ${LINE};">
    <span style="display:flex;width:10px;height:10px;background:${OLIVE};"></span>
    <span style="font-family:IBM Plex Mono;font-size:16px;letter-spacing:1.8px;color:${LABEL};margin-left:10px;">NO RENEWALS · NO EXPIRY</span>
  </div>
</div>`

  // The site sets this card on a 14px hard offset shadow. Satori has no box-shadow and
  // its layout is a flexbox subset, so faking one costs either negative margins or
  // absolute positioning — both of which would be load-bearing tricks in an engine that
  // can only be checked by deploying. The card is ink on paper with a lime bar; it does
  // not need the offset to sit off the page, so it goes without.
  return `
<div style="display:flex;align-items:center;width:${WIDTH}px;height:${HEIGHT}px;background:${PAPER};padding:44px 64px;border-top:10px solid ${LIME};font-family:Archivo;">
  ${rail}
  <div style="display:flex;margin-left:48px;">${card}</div>
</div>`.trim()
}
