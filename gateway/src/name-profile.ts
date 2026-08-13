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

/** Only a–z, 0–9 and hyphens are mintable, so anything else can't name a real token. */
export function normalizeLabel(raw: string): string | null {
  const label = raw.trim().toLowerCase().replace(/\.hoodfi\.eth$/, '').replace(/\.eth$/, '')
  if (!label || label.length > 32) return null
  if (!/^[a-z0-9-]+$/.test(label)) return null
  if (label.startsWith('-') || label.endsWith('-')) return null
  return label
}

/**
 * The public profile behind a name, or null if nobody owns it.
 *
 * Shared by the share page and the card renderer so a link and the image it embeds
 * can never disagree about what a name says.
 */
export async function readNameProfile(
  label: string,
  env: Env
): Promise<NameProfile | null> {
  const registry = envVar('L2_REGISTRY_ADDRESS', env)
  const name = `${label}.hoodfi.eth`
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
    label,
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
export function avatarUrls(value: string): string[] {
  if (!value) return []
  if (value.startsWith('ipfs://')) {
    const cid = value.slice('ipfs://'.length)
    return [`${PINNED_GATEWAY}${cid}`, `${PUBLIC_GATEWAY}${cid}`]
  }
  if (!/^https?:\/\//i.test(value)) return []
  return [value]
}
