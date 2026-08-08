import { ImageResponse, loadGoogleFont } from 'workers-og'

import { type Env } from '../env'
import { avatarToUrl, normalizeLabel, readNameProfile } from '../name-profile'

/**
 * The site's own type, so a shared card looks like the page behind it. Without this
 * satori falls back to a serif, which reads as somebody else's product.
 *
 * Cached in module scope: a warm isolate renders every subsequent card without
 * re-fetching, and the fetch itself is only two requests on a cold start.
 */
let fontCache: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 700 }[]> | null =
  null

function loadFonts() {
  if (!fontCache) {
    fontCache = Promise.all([
      loadGoogleFont({ family: 'Archivo', weight: 700 }),
      loadGoogleFont({ family: 'Inter', weight: 400 }),
    ]).then(([archivo, inter]) => [
      { name: 'Archivo', data: archivo, weight: 700 as const },
      { name: 'Inter', data: inter, weight: 400 as const },
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
const GREEN = '#00c805'
const PAPER = '#e9f2ea'
const DIM = 'rgba(233,242,234,0.58)'
const LINE = 'rgba(148,210,165,0.20)'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Long names have to shrink or they run off a fixed-width card. */
function nameFontSize(label: string): number {
  if (label.length <= 8) return 96
  if (label.length <= 14) return 72
  if (label.length <= 22) return 52
  return 40
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

/**
 * The card markup. Satori supports a flexbox subset only: every container with more
 * than one child needs an explicit `display:flex`, and there is no CSS variable
 * resolution, so all colours are literal.
 */
function cardHtml(opts: {
  label: string
  avatar: string
  address: string
  description: string
}): string {
  const { label, avatar, address, description } = opts
  const size = nameFontSize(label)

  const avatarBlock = avatar
    ? `<img src="${escapeHtml(avatar)}" width="140" height="140" style="width:140px;height:140px;border-radius:70px;object-fit:cover;border:2px solid ${LINE};" />`
    : `<div style="display:flex;align-items:center;justify-content:center;width:140px;height:140px;border-radius:70px;border:2px solid ${LINE};background:${PANEL};color:${GREEN};font-size:56px;font-weight:700;">${escapeHtml(
        label.slice(0, 2).toUpperCase()
      )}</div>`

  const subtitle = description
    ? truncate(description, 84)
    : address
      ? `${address.slice(0, 10)}…${address.slice(-8)}`
      : 'A lifetime name on Robinhood Chain'

  // The identity block is centred and the footer pinned, so short and long names
  // both sit optically centred instead of drifting to the top of the frame.
  return `
<div style="display:flex;flex-direction:column;width:${WIDTH}px;height:${HEIGHT}px;background:${INK};padding:64px;border-top:10px solid ${GREEN};font-family:Inter;">
  <div style="display:flex;flex-direction:column;justify-content:center;flex-grow:1;">
    <div style="display:flex;align-items:center;">
      ${avatarBlock}
      <div style="display:flex;flex-direction:column;margin-left:40px;">
        <div style="display:flex;align-items:baseline;">
          <span style="font-family:Archivo;font-size:${size}px;font-weight:700;color:${PAPER};">${escapeHtml(label)}</span>
          <span style="font-family:Archivo;font-size:${Math.round(size * 0.6)}px;font-weight:700;color:${DIM};">.hoodfi.eth</span>
        </div>
        <div style="display:flex;font-size:30px;color:${DIM};margin-top:18px;">${escapeHtml(subtitle)}</div>
      </div>
    </div>
  </div>

  <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid ${LINE};padding-top:34px;">
    <div style="display:flex;flex-direction:column;">
      <span style="font-family:Archivo;font-size:32px;font-weight:700;color:${GREEN};">HoodFi Names</span>
      <span style="font-size:25px;color:${DIM};margin-top:8px;">Lifetime ENS names on Robinhood Chain</span>
    </div>
    <div style="display:flex;align-items:center;background:${GREEN};color:${INK};font-family:Archivo;font-size:27px;font-weight:700;padding:18px 32px;border-radius:12px;">hoodfi.name</div>
  </div>
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

  const fonts = await loadFonts().catch(() => undefined)

  const render = (avatar: string) =>
    new ImageResponse(
      cardHtml({
        label: profile.label,
        avatar,
        address: profile.address,
        description: profile.description,
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
    // A dead or slow avatar host must not cost the whole card — fall back to initials.
    const fallback = render('')
    response = new Response(await fallback.arrayBuffer(), fallback)
  }

  const headers = new Headers(response.headers)
  headers.set('Content-Type', 'image/png')
  headers.set('Cache-Control', 'public, max-age=300, s-maxage=86400')
  return new Response(response.body, { status: 200, headers })
}
