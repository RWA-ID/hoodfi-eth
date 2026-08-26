import { type Hex, getAddress, namehash, parseAbi } from 'viem'

import { type Env, envVar, envVarOptional } from './env'
import { robinhoodClient } from './rpc'

/** ENSIP-11 coinType for Robinhood Chain. BigInt on purpose: `0x80000000 | 4663`
 *  in JS bitwise is signed 32-bit and comes back negative. */
const ROBINHOOD_COIN_TYPE = 0x80000000n | 4663n

const profileAbi = parseAbi([
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function text(bytes32 node, string key) view returns (string)',
  'function addr(bytes32 node, uint256 coinType) view returns (bytes)',
])

const registrarAbi = parseAbi(['function status(string label) view returns (uint8)'])

/** Mirrors HoodfiRegistrar.status(). */
export const MINT_STATUS = {
  AVAILABLE: 0,
  TAKEN: 1,
  LOCKED: 2,
  INVALID: 3,
  BLOCKED: 4,
} as const

/**
 * Why an unowned name still isn't mintable. Short names stay locked until the donation
 * goal and infra labels like `www` are blocked outright — both look identical to
 * "available" if you only ask the registry who owns it.
 */
export async function readMintStatus(label: string, env: Env): Promise<number> {
  const registrar = envVarOptional('REGISTRAR_ADDRESS', env)
  if (!registrar) return MINT_STATUS.AVAILABLE
  try {
    return await robinhoodClient(env).readContract({
      address: registrar,
      abi: registrarAbi,
      functionName: 'status',
      args: [label],
    })
  } catch {
    return MINT_STATUS.AVAILABLE
  }
}

export type NameProfile = {
  label: string
  name: string
  owner: string
  address: string
  avatar: string
  description: string
  twitter: string
}

/**
 * The part of a name below `hoodfi.eth`, validated — `jack` for `jack.hoodfi.eth`, and
 * `jack.aaron` for `jack.aaron.hoodfi.eth`.
 *
 * Returns a path rather than a single label because names nest: the holder of
 * `aaron.hoodfi.eth` can create `jack.aaron.hoodfi.eth`, and that name deserves a card
 * and an avatar like any other. Every caller appends `.hoodfi.eth` to what comes back,
 * so returning the whole path keeps each of them correct at any depth without knowing
 * depth exists.
 *
 * Each segment is held to the same charset the registrar enforces at the top level.
 * That matters more here than there: `createSubnode` checks only that a label is 1–255
 * bytes, so a subname can be created with characters no client will render the same
 * way. Those names resolve, but they are not ones we will draw a card for.
 */
const MAX_DEPTH = 5

export function normalizeLabel(raw: string): string | null {
  const path = raw.trim().toLowerCase().replace(/\.hoodfi\.eth$/, '').replace(/\.eth$/, '')
  if (!path) return null

  const segments = path.split('.')
  if (segments.length > MAX_DEPTH) return null

  for (const segment of segments) {
    if (!segment || segment.length > 32) return null
    if (!/^[a-z0-9-]+$/.test(segment)) return null
    if (segment.startsWith('-') || segment.endsWith('-')) return null
  }

  return segments.join('.')
}

/**
 * The public profile behind a name, or null if nobody owns it.
 *
 * Shared by the share page and the card renderer so a link and the image it embeds
 * can never disagree about what a name says.
 *
 * `path` is whatever `normalizeLabel` returned — one label for a second-level name,
 * a dotted path for anything deeper. Namehash walks the labels either way, so nothing
 * below this line cares which it got.
 */
export async function readNameProfile(
  path: string,
  env: Env
): Promise<NameProfile | null> {
  const registry = envVar('L2_REGISTRY_ADDRESS', env)
  const name = `${path}.hoodfi.eth`
  const node = namehash(name)
  const client = robinhoodClient(env)

  let owner: string
  try {
    owner = await client.readContract({
      address: registry,
      abi: profileAbi,
      functionName: 'ownerOf',
      args: [BigInt(node)],
    })
  } catch {
    return null
  }
  if (!owner || /^0x0{40}$/i.test(owner)) return null

  const text = (key: string) =>
    client
      .readContract({
        address: registry,
        abi: profileAbi,
        functionName: 'text',
        args: [node, key],
      })
      .catch(() => '')

  const [avatar, description, twitter, addrBytes] = await Promise.all([
    text('avatar'),
    text('description'),
    text('com.twitter'),
    client
      .readContract({
        address: registry,
        abi: profileAbi,
        functionName: 'addr',
        args: [node, ROBINHOOD_COIN_TYPE],
      })
      .catch(() => '0x' as Hex),
  ])

  return {
    // Everything below `hoodfi.eth`, which the card renders against its own fixed
    // suffix — so a nested name draws as `jack.aaron` + `.hoodfi.eth` and its layout
    // is sized from the whole path, not from one label of it.
    label: path,
    name,
    owner: getAddress(owner as Hex),
    address: addrBytes && addrBytes !== '0x' ? getAddress(addrBytes as Hex) : '',
    avatar: avatar ?? '',
    description: description ?? '',
    twitter: twitter ?? '',
  }
}

/**
 * Our own Pinata gateway — the one `postAvatar` pins to, so it can serve an upload the
 * moment it finishes rather than waiting for the network to find the bytes.
 */
const PINNED_GATEWAY = 'https://ipfs.onchain-id.id/ipfs/'
/** For CIDs we didn't pin, which the dedicated gateway refuses outright. */
const PUBLIC_GATEWAY = 'https://ipfs.io/ipfs/'

/**
 * Where an avatar record can be fetched from, best first — `ipfs://` avatars need a
 * gateway before any renderer or crawler can fetch them.
 *
 * Two of them, because neither covers both cases: the dedicated gateway holds the pin
 * for anything uploaded here and answers immediately, but serves only this account's
 * CIDs and 403s the rest, and the record accepts any URI its owner types. Anything that
 * isn't http(s) after that is dropped — a card renderer should not be handed a `data:`
 * or `file:` URI out of a text record.
 */
export function avatarUrls(value: string, maxPx?: number): string[] {
  if (!value) return []
  if (value.startsWith('ipfs://')) {
    const cid = value.slice('ipfs://'.length)
    return [`${PINNED_GATEWAY}${cid}${resizeQuery(maxPx)}`, `${PUBLIC_GATEWAY}${cid}`]
  }
  if (!/^https?:\/\//i.test(value)) return []
  return [value]
}

/**
 * Ask the pinned gateway for the avatar at the size it will actually be drawn.
 *
 * Pinata's gateway resizes on the way out, and the difference is not a tuning detail: a
 * real 480KB avatar came back as 54KB and 0.38s against 480KB and 0.78s cold — and the
 * card renderer then has to base64 and decode whatever it was handed. A share card was
 * measured at 3.57s cold for a name with an avatar against 0.83s for one without, which
 * is the wrong side of the ~3s a crawler will wait: X fetched the card, gave up, and
 * unfurled the link with no image at all. The full-size file was never wanted — the
 * avatar is drawn into a box a few hundred pixels wide.
 *
 * Only on the pinned gateway. `ipfs.io` has no such parameter and the fallback exists for
 * CIDs Pinata refuses anyway, so there is nothing there to ask.
 *
 * `img-fit=cover` is doing separate work: satori stretches a non-square avatar to the box
 * it is given, so a wide image arrived visibly squashed. Cropping to a square on the way
 * out is what makes it arrive already the right shape.
 */
function resizeQuery(maxPx?: number): string {
  if (!maxPx) return ''
  return `?img-width=${maxPx}&img-height=${maxPx}&img-fit=cover&img-format=png`
}
