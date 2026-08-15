import { type Env } from '../env'

/**
 * Cookieless analytics sink.
 *
 * The site lives on IPFS, so there are no server logs. This gives the funnel a home
 * without adding a third-party service or a cookie banner: events land in Cloudflare
 * Analytics Engine, queryable over the SQL API.
 *
 * Deliberately stores nothing that identifies a person — no IP, no wallet address, no
 * full referrer URL. The session id is generated client-side per tab and is not
 * persisted across visits.
 */

const KNOWN_EVENTS = new Set([
  'page_view',
  'name_searched',
  'mint_started',
  'mint_completed',
  'mint_failed',
  'donate_started',
  'donate_completed',
  'voucher_requested',
  'short_mint_started',
  'short_mint_completed',
  'record_saved',
  'avatar_uploaded',
  'share_clicked',
  'site_visited',
  'connect_opened',
])

/** Bounds what a caller can write, so a stray script can't blow up cardinality. */
function clamp(value: unknown, max = 64): string {
  if (typeof value !== 'string') return ''
  return value.slice(0, max)
}

export async function postEvent(request: Request, env: Env) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return new Response(null, { status: 204 })
  }

  const event = clamp(body.e, 32)
  if (!KNOWN_EVENTS.has(event)) {
    // Unknown event names are dropped rather than stored.
    return new Response(null, { status: 204 })
  }

  const dataset = env.ANALYTICS
  if (!dataset) {
    // Binding not configured — accept and discard so the site never sees an error.
    return new Response(null, { status: 204 })
  }

  try {
    dataset.writeDataPoint({
      // Blobs are the queryable dimensions.
      blobs: [
        event,
        clamp(body.p, 64), // path
        clamp(body.r, 64), // referrer host only
        clamp(body.tier, 8), // name length tier, for mint funnel analysis
        clamp(body.method, 16), // eth | usdg | credit
        // Country comes from Cloudflare itself; we never read or store the IP.
        clamp(request.headers.get('cf-ipcountry') ?? '', 4),
      ],
      doubles: [typeof body.value === 'number' ? body.value : 0],
      // Session id groups events within one tab visit; it is random and ephemeral.
      indexes: [clamp(body.s, 32)],
    })
  } catch {
    // Never surface analytics failures to the page.
  }

  return new Response(null, { status: 204 })
}
