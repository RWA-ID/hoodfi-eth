import { namehash } from 'viem'
import { ImageResponse, loadGoogleFont } from 'workers-og'

import { type Env } from '../env'
import { avatarToUrl, normalizeLabel, readNameProfile } from '../name-profile'
import { HEIGHT, WIDTH, cardHtml } from './nameCardHtml'

/**
 * The site's own type, so a shared card looks like the page behind it. Without this
 * satori falls back to a serif, which reads as somebody else's product.
 *
 * Two families and only two, exactly as the site loads: Archivo carries every piece of
 * structure and IBM Plex Mono carries anything that is data. Two weights of each,
 * because the design leans on the distance between 500 and 800.
 *
 * Cached in module scope: a warm isolate renders every subsequent card without
 * re-fetching, and the fetch itself is only four requests on a cold start.
 */
let fontCache: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 500 | 600 | 800 }[]> | null =
  null

function loadFonts() {
  if (!fontCache) {
    fontCache = Promise.all([
      loadGoogleFont({ family: 'Archivo', weight: 500 }),
      loadGoogleFont({ family: 'Archivo', weight: 800 }),
      loadGoogleFont({ family: 'IBM Plex Mono', weight: 400 }),
      loadGoogleFont({ family: 'IBM Plex Mono', weight: 600 }),
    ]).then(([archivo, archivoBold, mono, monoBold]) => [
      { name: 'Archivo', data: archivo, weight: 500 as const },
      { name: 'Archivo', data: archivoBold, weight: 800 as const },
      { name: 'IBM Plex Mono', data: mono, weight: 400 as const },
      { name: 'IBM Plex Mono', data: monoBold, weight: 600 as const },
    ])
    // A failed fetch must not poison the cache for the life of the isolate.
    fontCache.catch(() => {
      fontCache = null
    })
  }
  return fontCache
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
