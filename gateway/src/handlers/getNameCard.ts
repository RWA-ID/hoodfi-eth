import { namehash } from 'viem'
import { ImageResponse, loadGoogleFont } from 'workers-og'

import { BRAND_MARK_DATA_URI } from '../brand-mark'
import { type Env } from '../env'
import { avatarToUrl, normalizeLabel, readNameProfile } from '../name-profile'

/**
 * The site's own type, so a shared card looks like the page behind it. Without this
 * satori falls back to a serif, which reads as somebody else's product.
 *
 * Archivo carries the brand rail, Inter the small print, and IBM Plex Mono the name
 * and the data cells — the same division of labour as the site's stylesheet, which is
 * what makes the rendered card and the card on /search read as one object.
 *
 * Cached in module scope: a warm isolate renders every subsequent card without
 * re-fetching, and the fetch itself is only three requests on a cold start.
 */
let fontCache: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 600 | 700 }[]> | null =
  null

function loadFonts() {
  if (!fontCache) {
    fontCache = Promise.all([
      loadGoogleFont({ family: 'Archivo', weight: 700 }),
      loadGoogleFont({ family: 'Inter', weight: 400 }),
      loadGoogleFont({ family: 'IBM Plex Mono', weight: 600 }),
    ]).then(([archivo, inter, mono]) => [
      { name: 'Archivo', data: archivo, weight: 700 as const },
      { name: 'Inter', data: inter, weight: 400 as const },
      { name: 'IBM Plex Mono', data: mono, weight: 600 as const },
    ])
    // A failed fetch must not poison the cache for the life of the isolate.
    fontCache.catch(() => {
      fontCache = null
    })
  }
  return fontCache
}

const WIDTH = 1200
const HEIGHT = 630

/** Site palette, inlined — satori resolves no CSS variables. */
const INK = '#0a0f0c'
const PANEL = '#0d1310'
const PANEL_2 = '#101812'
const GREEN = '#00c805'
const PAPER = '#e9f2ea'
const DIM = 'rgba(233,242,234,0.58)'
const FAINT = 'rgba(233,242,234,0.36)'
const LINE = 'rgba(148,210,165,0.13)'
const LINE_STRONG = 'rgba(148,210,165,0.28)'
/** The green bar's text — dark enough to read as ink on that green, per the site. */
const ON_GREEN = '#04270a'

/** Rail, gutter and card add up to WIDTH minus the two 56px page margins. */
const RAIL_W = 424
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
 * than between its children. (The card this replaces had the same bug: its footer
 * lockup and button sat in from both edges instead of at them.) An explicit grown
 * spacer is the part of the flex model that does survive.
 */
const SPACER = '<div style="display:flex;flex-grow:1;"></div>'

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function shortAddress(value: string): string {
  return value ? `${value.slice(0, 6)}…${value.slice(-6)}` : '—'
}

/** The mark, drawn at whatever size the slot needs. */
function mark(size: number, opacity = 1): string {
  return `<img src="${BRAND_MARK_DATA_URI}" width="${size}" height="${size}" style="width:${size}px;height:${size}px;opacity:${opacity};" />`
}

/**
 * The avatar disc, ringed in green exactly as `.avatar-ring` does on the site.
 *
 * The fallback is the house mark at 40% rather than the name's initials. Initials read
 * as a deliberate monogram — as something the owner chose — when the truth is that no
 * avatar is set at all, and the dimmed H is how every other surface in the product
 * already says that.
 */
function avatarBlock(avatar: string): string {
  const RING = 2
  const DISC = 140
  const inner = avatar
    ? `<img src="${escapeHtml(avatar)}" width="${DISC}" height="${DISC}" style="width:${DISC}px;height:${DISC}px;border-radius:${DISC / 2}px;object-fit:cover;" />`
    : `<div style="display:flex;align-items:center;justify-content:center;width:${DISC}px;height:${DISC}px;border-radius:${DISC / 2}px;background:${PANEL_2};">${mark(
        DISC / 2,
        0.45
      )}</div>`

  // The site draws this ring as a conic gradient that fades in and out of green.
  // Satori has no conic support, so it flattens to one colour — at full strength that
  // reads far louder than the original, hence the alpha.
  return `<div style="display:flex;padding:${RING}px;border-radius:999px;background:rgba(0,200,5,0.62);">${inner}</div>`
}

/** One cell of the three-up strip under the name. */
function statCell(label: string, value: string, green: boolean, first: boolean): string {
  return `<div style="display:flex;flex-direction:column;flex-grow:1;flex-basis:0;padding:15px 20px;${
    first ? '' : `border-left:1px solid ${LINE};`
  }">
    <span style="font-size:12px;letter-spacing:2.2px;color:${FAINT};">${escapeHtml(label)}</span>
    <span style="font-family:IBM Plex Mono;font-size:17px;margin-top:7px;color:${green ? GREEN : PAPER};">${escapeHtml(value)}</span>
  </div>`
}

/**
 * The card markup.
 *
 * This is the `ProfileCard` component redrawn for satori, which supports a flexbox
 * subset only: every container with more than one child needs an explicit
 * `display:flex`, there is no CSS variable resolution, and gradients and conic rings
 * degrade to flat colour. Everything else — the header rule, the ringed avatar, the
 * three-up stat strip, the green vanity-URL bar — is the same object the owner sees
 * on /search and /manage, which is the point: the thing they share is the thing they
 * were looking at.
 */
function cardHtml(opts: {
  label: string
  avatar: string
  owner: string
  description: string
  token: string
}): string {
  const { label, avatar, owner, description, token } = opts
  const { size, stack } = nameLayout(label)

  const suffixSpan = `<span style="color:rgba(233,242,234,0.32);">${SUFFIX}</span>`
  // Stacked, the two halves are separate rows; inline, they are one baseline. Satori
  // has no soft-wrap opportunity to lean on, so the choice is made here, not in CSS.
  const nameBlock = stack
    ? `<div style="display:flex;flex-direction:column;align-items:center;font-family:IBM Plex Mono;font-size:${size}px;line-height:1.12;color:${PAPER};">
         <span>${escapeHtml(label)}</span>
         ${suffixSpan}
       </div>`
    : `<div style="display:flex;font-family:IBM Plex Mono;font-size:${size}px;line-height:1.12;color:${PAPER};">${escapeHtml(
        label
      )}${suffixSpan}</div>`

  // The address deliberately isn't the fallback here any more: the OWNER cell below
  // already carries it, and two truncations of the same hex on one card reads as a
  // rendering bug rather than as two facts.
  const subtitle = description
    ? truncate(description, 78)
    : 'A lifetime name on Robinhood Chain.'

  // The green bar has to hold the vanity URL and the chain label without them meeting.
  // "ROBINHOOD CHAIN" and the bar's padding claim ~200px of the 606, and the URL is set
  // at 17px with 1px of tracking — 11.2px a glyph — which leaves room for 34 of them.
  const vanity = truncate(`hoodfi.name/${label}`, 34)

  const card = `
<div style="display:flex;flex-direction:column;width:${CARD_W}px;border:1px solid ${LINE_STRONG};border-radius:16px;background:${PANEL_2};overflow:hidden;">

  <div style="display:flex;align-items:center;padding:18px 26px;border-bottom:1px solid ${LINE};">
    <div style="display:flex;align-items:center;">
      ${mark(20)}
      <span style="font-size:13px;letter-spacing:3px;color:${FAINT};margin-left:10px;">HOODFI NAMES</span>
    </div>
    ${SPACER}
    <div style="display:flex;border:1px solid rgba(0,200,5,0.45);background:rgba(0,200,5,0.09);border-radius:999px;padding:7px 15px;font-size:12px;letter-spacing:2.4px;color:${GREEN};">LIFETIME</div>
  </div>

  <div style="display:flex;flex-direction:column;align-items:center;padding:34px ${CARD_PAD}px 30px;">
    ${avatarBlock(avatar)}
    <div style="display:flex;margin-top:22px;">${nameBlock}</div>
    <div style="display:flex;margin-top:16px;font-size:20px;line-height:1.35;color:${DIM};text-align:center;">${escapeHtml(subtitle)}</div>
  </div>

  <div style="display:flex;border-top:1px solid ${LINE};">
    ${statCell('TOKEN', token, false, true)}
    ${statCell('OWNER', shortAddress(owner), false, false)}
    ${statCell('EXPIRES', 'Never', true, false)}
  </div>

  <div style="display:flex;align-items:center;background:${GREEN};padding:13px 20px;">
    <span style="font-family:IBM Plex Mono;font-size:17px;letter-spacing:1px;color:${ON_GREEN};">${escapeHtml(vanity)}</span>
    ${SPACER}
    <span style="font-family:IBM Plex Mono;font-size:15px;letter-spacing:1.4px;color:rgba(4,39,10,0.7);">ROBINHOOD CHAIN</span>
  </div>
</div>`

  const rail = `
<div style="display:flex;flex-direction:column;justify-content:center;width:${RAIL_W}px;">
  <div style="display:flex;align-items:center;">
    ${mark(44)}
    <span style="font-family:Archivo;font-size:30px;font-weight:700;color:${PAPER};margin-left:14px;">HoodFi Names</span>
  </div>
  <div style="display:flex;font-family:Archivo;font-size:40px;font-weight:700;line-height:1.16;color:${PAPER};margin-top:30px;">Lifetime ENS names on Robinhood Chain.</div>
  <div style="display:flex;font-size:20px;line-height:1.4;color:${DIM};margin-top:20px;">One name. Every wallet. Every chain.</div>
  <div style="display:flex;margin-top:32px;">
    <div style="display:flex;background:${GREEN};color:${ON_GREEN};font-family:Archivo;font-size:23px;font-weight:700;padding:14px 26px;border-radius:11px;">hoodfi.name</div>
  </div>
</div>`

  return `
<div style="display:flex;align-items:center;width:${WIDTH}px;height:${HEIGHT}px;background:${INK};padding:44px 56px;border-top:10px solid ${GREEN};font-family:Inter;">
  ${rail}
  <div style="display:flex;margin-left:56px;">${card}</div>
</div>`.trim()
}

/**
 * 1200x630 share card for a single name.
 *
 * Rendered per request because the set of names is open-ended — there is nothing to
 * pre-build. Cached hard at the edge so X, Slack and every other unfurler that hits
 * the same name pays for the render once.
 */
export async function getNameCard(rawLabel: string, env: Env): Promise<Response> {
  const label = normalizeLabel(rawLabel.replace(/\.png$/, ''))
  if (!label) {
    return Response.json({ message: 'Invalid name' }, { status: 400 })
  }

  const profile = await readNameProfile(label, env)
  if (!profile) {
    return Response.json({ message: 'Name not registered' }, { status: 404 })
  }

  const node = namehash(profile.name)
  const token = `#${node.slice(2, 6)}…${node.slice(-4)}`
  const fonts = await loadFonts().catch(() => undefined)

  const render = (avatar: string) =>
    new ImageResponse(
      cardHtml({
        label: profile.label,
        avatar,
        owner: profile.owner,
        description: profile.description,
        token,
      }),
      { width: WIDTH, height: HEIGHT, format: 'png', fonts }
    )

  let response: Response
  try {
    response = render(avatarToUrl(profile.avatar))
    // Touch the body here so a failing avatar fetch throws inside this try, not
    // halfway through streaming a response we've already committed to.
    response = new Response(await response.arrayBuffer(), response)
  } catch {
    // A dead or slow avatar host must not cost the whole card — fall back to the mark.
    const fallback = render('')
    response = new Response(await fallback.arrayBuffer(), fallback)
  }

  const headers = new Headers(response.headers)
  headers.set('Content-Type', 'image/png')
  headers.set('Cache-Control', 'public, max-age=300, s-maxage=86400')
  return new Response(response.body, { status: 200, headers })
}
