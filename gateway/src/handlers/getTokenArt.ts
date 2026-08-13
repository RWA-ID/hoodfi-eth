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
export async function getTokenArt(rawLabel: string, env: Env): Promise<Response> {
  const label = normalizeLabel(rawLabel.replace(/\.png$/, ''))
  if (!label) {
    return Response.json({ message: 'Invalid name' }, { status: 400 })
  }

  const fonts = await loadFonts().catch(() => undefined)

  const rendered = new ImageResponse(tokenArtHtml(label), {
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
