import { type Hex, namehash, parseAbi } from 'viem'
import { ImageResponse, loadGoogleFont } from 'workers-og'

import { type Env, envVar } from '../env'
import { type LoadedFont, loadFonts } from '../fonts'
import { avatarUrls } from '../name-profile'
import { robinhoodClient } from '../rpc'
import { normalizeSitePath } from '../site-path'
import { inlineAvatar } from './getNameCard'
import { type CardData, FACES, HEIGHT, WIDTH, resolveLook, siteCardHtml } from './siteCardHtml'

/**
 * 1200x630 share card for a published Links page.
 *
 * The card never takes what it draws from its own URL. Anyone can type a URL, and a card
 * rendered from query parameters on our domain is a way to put any words at all under
 * somebody's name. Instead it asks the chain which site the name points at (the
 * contenthash, which only the owner can set), fetches that exact page from our pinned
 * gateway, and reads the card data the page carries in `<meta name="hoodfi:card">`.
 * What unfurls is what the owner published, and nothing else.
 *
 * `?v=` on the URL is ignored here. The page writes a hash of its own card data into it,
 * so a republish changes the URL and every unfurler, and our edge cache, fetches fresh.
 *
 * Anything this cannot draw — no contenthash, a page from another template, a gateway
 * that did not answer in time — redirects to the plain name card rather than failing, so
 * a share always has some image.
 */

const registryAbi = parseAbi(['function contenthash(bytes32 node) view returns (bytes)'])

/** Our own Pinata gateway, which serves pins from this account. See pageUrl for the CID form. */
const PINNED_GATEWAY = 'https://ipfs.onchain-id.id/ipfs/'

/**
 * Budgets. A crawler waits about three seconds for the whole response (see getNameCard);
 * the page fetch is ~0.3s warm and ~1s cold, so avatar and fonts share what is left.
 */
const PAGE_BUDGET_MS = 1500
const AVATAR_BUDGET_MS = 1800

/** Card avatar is drawn at 280px; twice that stays sharp. */
const AVATAR_PX = 560

/**
 * The CIDv0 (`Qm…`) for a contenthash, or null.
 *
 * The contenthash stores a CIDv1, but our pinned gateway 403s the v1 form of a pin it
 * holds and serves the v0 form of the same bytes — measured on onchain.hoodfi.eth. Every
 * site the builder publishes is dag-pb over sha2-256, which is exactly the shape that has
 * a v0 form: `e3 01` ipfs-ns, `01` CIDv1, `70` dag-pb, `12 20` sha2-256 of 32 bytes.
 */
export function contenthashToV0(hex: string): string | null {
  const h = hex.toLowerCase()
  const prefix = '0xe30101701220'
  if (!h.startsWith(prefix) || h.length !== prefix.length + 64) return null
  return base58(`1220${h.slice(prefix.length)}`)
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function base58(hex: string): string {
  let n = BigInt(`0x${hex}`)
  let out = ''
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out
    n /= 58n
  }
  // Leading zero bytes become leading 1s. A 0x12 multihash never has one, but it costs
  // nothing to be correct.
  for (let i = 0; i < hex.length && hex.slice(i, i + 2) === '00'; i += 2) out = `1${out}`
  return out
}

function unescapeAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/**
 * The card data a page carries, validated field by field.
 *
 * It came off IPFS, so it is exactly as trustworthy as any other text an owner typed:
 * every string is capped, the look resolves through closed tables, and the avatar is
 * only ever used as a URL to fetch through avatarUrls, which drops non-http(s)/ipfs.
 */
export function parseCardData(
  html: string,
  path: string
): (Omit<CardData, 'avatar'> & { avatarRaw: string }) | null {
  const match = html.match(/<meta name="hoodfi:card" content="([^"]*)">/)
  if (!match) return null
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(unescapeAttr(match[1]))
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return null

  const buttons = Array.isArray(raw.buttons)
    ? raw.buttons
        .slice(0, 2)
        .map((b: { t?: unknown; f?: unknown }) => ({ title: str(b?.t, 60), featured: b?.f === true }))
        .filter((b) => b.title)
    : []

  return {
    path,
    title: str(raw.title, 60),
    bio: str(raw.bio, 300),
    avatarRaw: str(raw.avatar, 500),
    buttons,
    look: resolveLook(raw.look as Record<string, unknown>),
  }
}

/** Display faces load on demand and stay loaded for the life of the isolate. */
const faceCache = new Map<string, Promise<LoadedFont[]>>()

function loadFace(font: string): Promise<LoadedFont[]> {
  const face = FACES[font]
  let loading = faceCache.get(font)
  if (!loading) {
    const wanted = [
      { family: face.family, weight: face.weight },
      // Button labels are set at 600 in the body face; Instrument Serif pairs with DM Sans.
      { family: face.family === 'Instrument Serif' ? 'DM Sans' : face.family, weight: 600 },
      { family: 'DM Sans', weight: 400 },
    ]
    loading = Promise.all(
      wanted.map(async (w) => ({
        name: w.family,
        data: await loadGoogleFont({ family: w.family, weight: w.weight }),
        weight: w.weight as LoadedFont['weight'],
      }))
    )
    loading.catch(() => faceCache.delete(font))
    faceCache.set(font, loading)
  }
  return loading
}

/**
 * Width and height of an inlined PNG, JPEG or GIF, read from its header, or undefined.
 *
 * Only the first 64KB are decoded — every one of these formats states its size before
 * that, JPEG after its metadata segments, which in practice run to a few KB.
 */
export function imageSize(dataUri: string): { w: number; h: number } | undefined {
  const comma = dataUri.indexOf(',')
  if (comma < 0) return undefined
  let bin: string
  try {
    bin = atob(dataUri.slice(comma + 1, comma + 1 + 87384))
  } catch {
    return undefined
  }
  const b = (i: number) => bin.charCodeAt(i)
  const u16 = (i: number) => (b(i) << 8) | b(i + 1)
  // PNG: IHDR width and height, big-endian, at 16 and 20.
  if (b(0) === 0x89 && bin.slice(1, 4) === 'PNG') {
    return { w: (u16(16) << 16) | u16(18), h: (u16(20) << 16) | u16(22) }
  }
  // GIF: little-endian at 6 and 8.
  if (bin.slice(0, 3) === 'GIF') return { w: b(6) | (b(7) << 8), h: b(8) | (b(9) << 8) }
  // JPEG: walk the segments to the first start-of-frame.
  if (b(0) === 0xff && b(1) === 0xd8) {
    let i = 2
    while (i + 9 < bin.length) {
      if (b(i) !== 0xff) return undefined
      const marker = b(i + 1)
      const len = u16(i + 2)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { w: u16(i + 7), h: u16(i + 5) }
      }
      i += 2 + len
    }
  }
  return undefined
}

/** Avatar and faces fetched, then drawn. Separate from the route so it can be rendered directly. */
export async function renderSiteCard(
  data: Omit<CardData, 'avatar'> & { avatarRaw: string }
): Promise<ArrayBuffer> {
  const [avatar, face, base] = await Promise.all([
    inlineAvatar(avatarUrls(data.avatarRaw, AVATAR_PX), AVATAR_BUDGET_MS),
    loadFace(data.look.font).catch(() => [] as LoadedFont[]),
    loadFonts().catch(() => [] as LoadedFont[]),
  ])
  const rendered = new ImageResponse(siteCardHtml({ ...data, avatar, avatarSize: imageSize(avatar) }), {
    width: WIDTH,
    height: HEIGHT,
    format: 'png',
    fonts: [...face, ...base],
  })
  return rendered.arrayBuffer()
}

export async function getSiteCard(rawPath: string, request: Request, env: Env): Promise<Response> {
  const path = normalizeSitePath(rawPath.replace(/\.png$/, ''))
  if (!path) return Response.json({ message: 'Invalid name' }, { status: 400 })

  const fallback = () => Response.redirect(new URL(`/card/${path}`, request.url).toString(), 302)

  // Cloudflare does not cache a Worker's own responses on its own; without the Cache API
  // every unfurl would pay for a chain read, a page fetch and a render.
  const cache = (caches as unknown as { default: Cache }).default
  const hit = await cache.match(request)
  if (hit) return hit

  let pageHtml: string
  try {
    const contenthash = (await robinhoodClient(env).readContract({
      address: envVar('L2_REGISTRY_ADDRESS', env) as Hex,
      abi: registryAbi,
      functionName: 'contenthash',
      args: [namehash(`${path}.hoodfi.eth`)],
    })) as Hex
    const cid = contenthashToV0(contenthash)
    if (!cid) return fallback()
    const res = await fetch(`${PINNED_GATEWAY}${cid}/`, { signal: AbortSignal.timeout(PAGE_BUDGET_MS) })
    if (!res.ok) return fallback()
    pageHtml = await res.text()
  } catch {
    return fallback()
  }

  const data = parseCardData(pageHtml, path)
  if (!data) return fallback()
  const body = await renderSiteCard(data)

  const versioned = new URL(request.url).searchParams.has('v')
  const response = new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      // A versioned URL names one publish, so it can be cached for a long time. An
      // unversioned one follows whatever the name points at now.
      'Cache-Control': versioned ? 'public, max-age=86400, s-maxage=2592000' : 'public, max-age=300, s-maxage=3600',
    },
  })
  await cache.put(request, response.clone()).catch(() => undefined)
  return response
}
