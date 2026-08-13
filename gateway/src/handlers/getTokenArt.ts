import { ImageResponse } from 'workers-og'

import { type Env } from '../env'
import { loadFonts } from '../fonts'
import { normalizeLabel } from '../name-profile'
import { SIZE, tokenArtHtml } from './tokenArtHtml'

/**
 * The image a hoodfi.eth token carries on marketplaces and in wallets.
 *
 * Rendered per name rather than pinned, for the reason the share card is: the set of
 * names is open-ended, so there is nothing to pre-build. What every token shared before
 * this was one piece of collection art, which made a grid of names indistinguishable
 * from each other — the name is the asset, so the name is the picture.
 *
 * Deliberately reads no chain state. The art is a function of the label alone: no
 * avatar, no owner, no records, so there is nothing to look up and nothing to go stale.
 * That is also what keeps it available — a marketplace that fetches an image while the
 * RPC is throttling would otherwise cache the failure, and a broken thumbnail on a
 * listing is far stickier than a missing one. Only `/nft/{tokenId}` decides whether a
 * token exists; it is the only route a marketplace reaches this one through.
 */
export async function getTokenArt(raw: string, env: Env): Promise<Response> {
  const name = normalizeName(raw.replace(/\.png$/, ''))
  if (!name) {
    return Response.json({ message: 'Invalid name' }, { status: 400 })
  }

  const fonts = await loadFonts().catch(() => undefined)

  const rendered = new ImageResponse(tokenArtHtml(name), {
    width: SIZE,
    height: SIZE,
    format: 'png',
    fonts,
  })
  const response = new Response(await rendered.arrayBuffer(), rendered)

  const headers = new Headers(response.headers)
  headers.set('Content-Type', 'image/png')
  // A name's art never changes, so this is cached far harder than the share card, which
  // moves whenever the owner edits a record.
  headers.set('Cache-Control', 'public, max-age=86400, s-maxage=2592000')
  return new Response(response.body, { status: 200, headers })
}

/** The parent, which the registry mints to itself and which owns no label of its own. */
const ROOT = 'hoodfi.eth'

/**
 * The full name this art is for, or null if no token could carry it.
 *
 * Checked against the root before anything else: `normalizeLabel` reads `hoodfi.eth` as
 * the label `hoodfi`, which is a real distinction — one is the parent, the other would
 * be a subname of it. Every other form goes through the registrar's own charset rules,
 * so `gm`, `gm.hoodfi.eth` and `gm.eth` all name the same picture and a bare label keeps
 * working as the short way to ask for one.
 */
function normalizeName(raw: string): string | null {
  if (raw.trim().toLowerCase() === ROOT) return ROOT
  const label = normalizeLabel(raw)
  return label ? `${label}.${ROOT}` : null
}
