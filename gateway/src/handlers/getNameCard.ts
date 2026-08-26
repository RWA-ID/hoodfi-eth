import { namehash } from 'viem'
import { ImageResponse } from 'workers-og'

import { type Env } from '../env'
import { loadFonts } from '../fonts'
import { avatarUrls, normalizeLabel, readNameProfile } from '../name-profile'
import { HEIGHT, WIDTH, cardHtml } from './nameCardHtml'

/**
 * The formats satori can actually decode. WebP and AVIF are not among them, and the
 * site's own uploader emits WebP, so this is the common case rather than the edge.
 */
const RENDERABLE = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'])

/** Matches the uploader's own cap in postAvatar.ts. */
const MAX_AVATAR_BYTES = 512 * 1024

/**
 * The pixel size the avatar is asked for: twice the 132px box `nameCardHtml` draws it in,
 * so it stays crisp without paying for a file the card cannot use.
 */
const AVATAR_PX = 264

/**
 * How long the whole avatar hunt gets, across every candidate.
 *
 * This was 4000ms *per* candidate, which is the bug rather than the budget: two gateways
 * meant a card could spend eight seconds before satori started, and a crawler waits about
 * three for the entire response. A per-candidate timeout also cannot be reasoned about
 * from the outside — the ceiling moves whenever a gateway is added to the list.
 *
 * 1800ms is what is left of that three seconds after the chain reads, the fonts and the
 * render itself, measured against a card that took 3.57s cold and needs to come in under
 * X's limit with room to spare. Blowing it costs the avatar and nothing else: the card
 * still draws, with the house mark, which is the trade this is here to make. A card that
 * arrives without an avatar is a card; a card that arrives too late is no card at all.
 */
const AVATAR_BUDGET_MS = 1800

/** Workers have btoa but not Buffer, and spreading a 512KB array blows the stack. */
function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

/**
 * Resolve the avatar to something satori will draw, or to nothing at all.
 *
 * Handing satori a remote URL looks like it works and doesn't: it fetches the image
 * itself, and when it can't decode the bytes it neither throws nor draws — it returns a
 * perfectly valid PNG with a hole where the avatar was. No try/catch around the render
 * can see that, which is why the mark fallback below it never fired for a WebP avatar.
 *
 * Fetching here moves the failure somewhere it can be observed. The format is knowable
 * only before the markup is built, so that is where the decision gets made: anything
 * satori can decode is inlined, and anything else — an unsupported format, a dead host,
 * a slow one, an oversized file — returns empty and the card draws the house mark.
 *
 * Candidates are tried in order because a public IPFS gateway is exactly the slow host
 * this guards against: ipfs.io has been measured taking 25s to serve a CID our own
 * gateway returns in one — and on the avatar this was first debugged with, it 504s after
 * 28 seconds rather than serving anything at all. Our gateway goes first and the public
 * one only catches CIDs it won't serve.
 *
 * The budget is shared across the whole list rather than given to each candidate, so the
 * ceiling is AVATAR_BUDGET_MS however many gateways get added here later. Running out is
 * a normal outcome, not an error: the caller draws the house mark.
 */
async function inlineAvatar(urls: string[]): Promise<string> {
  const deadline = Date.now() + AVATAR_BUDGET_MS
  for (const url of urls) {
    const remaining = deadline - Date.now()
    // Under half a second there is no point starting a gateway fetch: the pinned gateway
    // needs ~450ms warm, so anything less buys an abort mid-flight and spends the rest of
    // the budget to end up exactly where breaking does.
    if (remaining < 500) break
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(remaining) })
      if (!res.ok) continue
      const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
      // A format satori can't decode is the file itself, not the gateway serving it —
      // another gateway would return the same bytes, so stop rather than pay for it.
      if (!RENDERABLE.has(type)) return ''
      const buf = await res.arrayBuffer()
      if (buf.byteLength === 0 || buf.byteLength > MAX_AVATAR_BYTES) return ''
      return `data:${type};base64,${toBase64(buf)}`
    } catch {
      continue
    }
  }
  return ''
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

  // Already resolved to inline bytes or to nothing, so the render itself has no
  // network left to fail on and needs no fallback path of its own.
  const avatar = await inlineAvatar(avatarUrls(profile.avatar, AVATAR_PX))

  const rendered = new ImageResponse(
    cardHtml({
      label: profile.label,
      avatar,
      owner: profile.owner,
      description: profile.description,
      token,
    }),
    { width: WIDTH, height: HEIGHT, format: 'png', fonts }
  )
  const response = new Response(await rendered.arrayBuffer(), rendered)

  const headers = new Headers(response.headers)
  headers.set('Content-Type', 'image/png')
  headers.set('Cache-Control', 'public, max-age=300, s-maxage=86400')
  return new Response(response.body, { status: 200, headers })
}
