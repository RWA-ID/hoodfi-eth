import { type Hex, getAddress, namehash, parseAbi, recoverMessageAddress, sha256 } from 'viem'

import { type Env, envVar } from '../env'
import { normalizeLabel } from '../name-profile'
import { robinhoodClient } from '../rpc'

const ownerAbi = parseAbi(['function ownerOf(uint256 tokenId) view returns (address)'])

/** What a browser can produce from a canvas, plus the two it may hand us untouched. */
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

/**
 * Hard ceiling on a stored avatar.
 *
 * The client downscales to 512px before it ever asks for a signature, which lands
 * around 60–120KB. This is the backstop for a client that didn't, and it is what keeps
 * a name owner from using the pinning account as free bulk storage.
 */
const MAX_BYTES = 512 * 1024

/** How far ahead a signature may be dated. Long enough to sign, short enough to expire. */
const MAX_LIFETIME_MS = 10 * 60 * 1000

/**
 * The exact text the owner signs.
 *
 * Every field is load-bearing. The name scopes the signature to one identity, so a
 * signature harvested by one site can't rewrite another name. The image hash binds it
 * to these bytes, so a captured signature can't be replayed with different content.
 * The expiry stops it being valid forever.
 *
 * MUST match `avatarUploadMessage` in frontend/lib/avatar.ts byte for byte — the two
 * are one protocol and a whitespace change on either side rejects every upload.
 */
export function avatarUploadMessage(name: string, hash: Hex, expiry: number): string {
  return [
    'HoodFi avatar upload',
    '',
    `Name: ${name}`,
    `Image: ${hash}`,
    `Expires: ${new Date(expiry).toISOString()}`,
  ].join('\n')
}

/** Splits a data URL into its media type and bytes, or null if it isn't one. */
function decodeDataUrl(value: string): { type: string; bytes: Uint8Array } | null {
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,(.+)$/i.exec(value)
  if (!match) return null
  try {
    const binary = atob(match[2])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return { type: match[1].toLowerCase(), bytes }
  } catch {
    return null
  }
}

function fail(message: string, status: number): Response {
  return Response.json({ message }, { status })
}

type Body = { dataUrl?: string; signature?: Hex; expiry?: number }

/**
 * Pins an avatar image for a name whose owner asked for it.
 *
 * ENS stores an avatar as a URL, not an image, so a name service that only offers a
 * text box quietly excludes everyone without somewhere to host a picture — which is
 * most people. This is the missing half: the browser hands over the image, this pins
 * it, and the owner writes the returned `ipfs://` URI to the record themselves.
 *
 * The endpoint is open to the internet, so authorisation is the whole design. The
 * caller proves they control the name's owner address by signing a message bound to
 * the name, to these exact bytes and to a ten-minute window; the pinning credential
 * never leaves the worker. Note that this deliberately does NOT write anything on
 * chain — the record change stays the owner's transaction to sign.
 */
export async function postAvatar(
  rawLabel: string,
  request: Request,
  env: Env
): Promise<Response> {
  const label = normalizeLabel(rawLabel)
  if (!label) return fail('Invalid name', 400)

  const jwt = (() => {
    try {
      return envVar('PINATA_JWT', env)
    } catch {
      return null
    }
  })()
  if (!jwt) return fail('Avatar uploads are not configured', 503)

  const body = (await request.json().catch(() => null)) as Body | null
  if (!body?.dataUrl || !body.signature || !body.expiry) {
    return fail('Expected JSON body with dataUrl, signature and expiry', 400)
  }

  const now = Date.now()
  if (body.expiry <= now) return fail('Signature has expired', 401)
  if (body.expiry > now + MAX_LIFETIME_MS) return fail('Signature expiry is too far ahead', 400)

  const image = decodeDataUrl(body.dataUrl)
  if (!image) return fail('dataUrl is not a base64 data URL', 400)
  if (!ALLOWED_TYPES.has(image.type)) return fail(`Unsupported image type ${image.type}`, 415)
  if (image.bytes.byteLength > MAX_BYTES) {
    return fail(`Image is larger than ${Math.floor(MAX_BYTES / 1024)}KB`, 413)
  }

  const name = `${label}.hoodfi.eth`
  const message = avatarUploadMessage(name, sha256(image.bytes), body.expiry)

  let signer: string
  try {
    signer = await recoverMessageAddress({ message, signature: body.signature })
  } catch {
    return fail('Signature could not be read', 401)
  }

  let owner: string
  try {
    owner = await robinhoodClient(env).readContract({
      address: envVar('L2_REGISTRY_ADDRESS', env),
      abi: ownerAbi,
      functionName: 'ownerOf',
      args: [BigInt(namehash(name))],
    })
  } catch {
    // ownerOf reverts on a token that was never minted, which is the same answer.
    return fail('Name is not registered', 404)
  }

  if (getAddress(owner as Hex) !== getAddress(signer as Hex)) {
    return fail('Signer does not own this name', 403)
  }

  const extension = image.type.split('/')[1].replace('jpeg', 'jpg')
  const form = new FormData()
  form.append('file', new Blob([image.bytes], { type: image.type }), `${label}.${extension}`)
  form.append('pinataMetadata', JSON.stringify({ name: `hoodfi-avatar-${label}` }))

  const pinned = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  }).catch(() => null)

  if (!pinned?.ok) {
    // Never echo the upstream body — a Pinata error can quote the credential back.
    return fail('Could not pin the image', 502)
  }

  const result = (await pinned.json().catch(() => null)) as { IpfsHash?: string } | null
  if (!result?.IpfsHash) return fail('Pinning service returned no CID', 502)

  return Response.json({ cid: result.IpfsHash, uri: `ipfs://${result.IpfsHash}` })
}
