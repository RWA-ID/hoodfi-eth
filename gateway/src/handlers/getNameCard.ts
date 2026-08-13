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
 * gateway returns in one, and against a 4s timeout that is an avatar silently missing
 * from the card. Our gateway goes first and the public one only catches CIDs it won't
 * serve.
 */
async function inlineAvatar(urls: string[]): Promise<string> {
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
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
  const avatar = await inlineAvatar(avatarUrls(profile.avatar))

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
