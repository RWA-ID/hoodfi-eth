import { getAddress, namehash, sha256, toBytes } from 'viem'
import type { Hex } from 'viem'
import { recoverMessageAddress } from 'viem/utils'

import { type Env, envVar, envVarOptional } from '../env'
import { robinhoodClient } from '../rpc'
import { normalizeSitePath } from '../site-path'

/**
 * Pinning a website for a name, and keeping it only if it was paid for.
 *
 * Two phases, because the thing being sold is identified by its CID and a CID does not
 * exist until the bytes are pinned. So: pin first and mark it unpaid, let the owner pay
 * for that exact CID on HoodfiSites, then confirm — which is a plain on-chain read, not
 * a favour we do. Anything still unpaid after a day is swept.
 *
 * The alternative was charging before pinning, which would have meant metering credits
 * and trusting somebody to mark them spent. This way the receipt IS the CID.
 */

/** Ten minutes, matching the avatar upload window. */
const MAX_LIFETIME_MS = 10 * 60 * 1000

/** A rendered template is tens of KB. A megabyte is somebody doing something else. */
const MAX_BYTES = 1024 * 1024

const ownerAbi = [
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
] as const

const sitesAbi = [
  {
    type: 'function',
    name: 'isPaid',
    stateMutability: 'view',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'cid', type: 'string' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

function fail(message: string, status: number): Response {
  return Response.json({ message }, { status })
}



/**
 * The exact text the owner signs.
 *
 * MUST match `sitePublishMessage` in builder/lib/publish.ts byte for byte — the two
 * halves are one protocol. Bound to the name, to the hash of these exact bytes, and to
 * an expiry, so a captured signature cannot be replayed against different content.
 */
export function sitePublishMessage(name: string, hash: Hex, expiry: number): string {
  return [
    'HoodFi site publish',
    '',
    `Name: ${name}`,
    `Site: ${hash}`,
    `Expires: ${new Date(expiry).toISOString()}`,
  ].join('\n')
}

type PinBody = { html?: string; signature?: Hex; expiry?: number; templateId?: string }

async function ownerOfName(name: string, env: Env): Promise<string | null> {
  try {
    return (await robinhoodClient(env).readContract({
      address: envVar('L2_REGISTRY_ADDRESS', env),
      abi: ownerAbi,
      functionName: 'ownerOf',
      args: [BigInt(namehash(name))],
    })) as string
  } catch {
    // ownerOf reverts for a token that was never minted, which is the same answer.
    return null
  }
}

/**
 * Phase one: pin the rendered site, unpaid.
 *
 * Requires an owner signature even though nothing is charged yet. Without it this is an
 * open pinning service on our Pinata account, and the sweeper would spend its life
 * cleaning up after strangers.
 */
export async function postSite(rawPath: string, request: Request, env: Env): Promise<Response> {
  const path = normalizeSitePath(rawPath)
  if (!path) return fail('Invalid name', 400)

  const jwt = envVarOptional('PINATA_JWT', env)
  if (!jwt) return fail('Publishing is not configured', 503)

  const body = (await request.json().catch(() => null)) as PinBody | null
  if (!body?.html || !body.signature || !body.expiry) {
    return fail('Expected JSON body with html, signature and expiry', 400)
  }

  const now = Date.now()
  if (body.expiry <= now) return fail('Signature has expired', 401)
  if (body.expiry > now + MAX_LIFETIME_MS) return fail('Signature expiry is too far ahead', 400)

  const bytes = new TextEncoder().encode(body.html)
  if (bytes.byteLength > MAX_BYTES) {
    return fail(`Site is larger than ${Math.floor(MAX_BYTES / 1024)}KB`, 413)
  }

  const name = `${path}.hoodfi.eth`
  const message = sitePublishMessage(name, sha256(bytes), body.expiry)

  let signer: string
  try {
    signer = await recoverMessageAddress({ message, signature: body.signature })
  } catch {
    return fail('Signature could not be read', 401)
  }

  const owner = await ownerOfName(name, env)
  if (!owner) return fail('Name is not registered', 404)
  if (getAddress(owner as Hex) !== getAddress(signer as Hex)) {
    return fail('Signer does not own this name', 403)
  }

  const form = new FormData()
  // The filename carries a FOLDER, and that is what makes the CID a directory.
  //
  // `pinataOptions: { wrapWithDirectory: true }` was tried first and silently did
  // nothing — the first real publish produced a bare file CID, and
  // /ipfs/<cid>/index.html answered "no link". A contenthash has to point at a directory
  // holding index.html or a gateway has no root document to serve. Giving the part a
  // path makes Pinata build the directory, and the returned hash is that directory, so
  // index.html sits at its root. Same shape BuildSite pins with.
  form.append('file', new Blob([bytes], { type: 'text/html' }), 'site/index.html')
  form.append(
    'pinataMetadata',
    JSON.stringify({
      name: `hoodfi-site-${path}`,
      keyvalues: {
        // `node` is what lets the sweeper ask the chain about this pin later. `paid` is
        // only a cheap pre-filter for the pinList query — the chain is what decides.
        node: namehash(name),
        // Informational only — the sweeper works off `node`, which is derived from the
        // whole path, so a subname sweeps correctly whatever this says.
        path,
        paid: 'false',
        template: typeof body.templateId === 'string' ? body.templateId.slice(0, 32) : '',
        pinnedAt: String(now),
      },
    })
  )

  const pinned = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  }).catch(() => null)

  // Never echo the upstream body — a Pinata error can quote the credential back.
  if (!pinned?.ok) return fail('Could not pin the site', 502)

  const result = (await pinned.json().catch(() => null)) as { IpfsHash?: string } | null
  if (!result?.IpfsHash) return fail('Pinning service returned no CID', 502)

  return Response.json({
    cid: result.IpfsHash,
    uri: `ipfs://${result.IpfsHash}`,
    node: namehash(name),
  })
}

type ConfirmBody = { cid?: string }

/**
 * Phase two: keep it, because the chain says it was paid for.
 *
 * Deliberately unauthenticated. It grants nothing that `isPaid` does not already say in
 * public, and requiring a signature here would mean a payment that landed while someone
 * closed their laptop could never be confirmed. Anyone may call it; it can only ever
 * promote a pin the chain has already been paid for.
 */
export async function postSiteConfirm(
  rawPath: string,
  request: Request,
  env: Env
): Promise<Response> {
  const path = normalizeSitePath(rawPath)
  if (!path) return fail('Invalid name', 400)

  const jwt = envVarOptional('PINATA_JWT', env)
  if (!jwt) return fail('Publishing is not configured', 503)

  const sites = envVarOptional('SITES_ADDRESS', env)
  if (!sites) return fail('Publishing is not configured', 503)

  const body = (await request.json().catch(() => null)) as ConfirmBody | null
  const cid = typeof body?.cid === 'string' ? body.cid.trim() : ''
  if (!cid || cid.length > 128 || !/^[A-Za-z0-9]+$/.test(cid)) {
    return fail('Expected a JSON body with a valid cid', 400)
  }

  const node = namehash(`${path}.hoodfi.eth`)

  let paid: boolean
  try {
    paid = (await robinhoodClient(env).readContract({
      address: sites as Hex,
      abi: sitesAbi,
      functionName: 'isPaid',
      args: [node, cid],
    })) as boolean
  } catch {
    // A read that did not happen is not a read that returned no. Saying "unpaid" here
    // would tell someone who just paid that their transaction did not count.
    return fail('Could not reach the chain to check payment. Try again.', 502)
  }

  if (!paid) return fail('No payment found on chain for this site yet.', 402)

  // Nothing is written back to Pinata. The metadata flag existed only so the sweeper
  // could tell a paid pin from an abandoned one — but isPaid() already says that, on
  // chain, authoritatively, to anyone who asks. Writing it twice added a second source
  // of truth AND a dependency on the pinning credential having metadata scope, which
  // the shared upload-only key does not. That is what failed here, after the money had
  // already moved: "payment confirmed but the pin could not be marked".
  //
  // The sweeper reads the chain instead. One source of truth, no write, no scope.
  return Response.json({ ok: true, cid, node })
}

/**
 * Removes pins that were never paid for.
 *
 * Runs on a schedule because phase one is free by necessity: someone has to be able to
 * see their finished site before deciding to buy it. Without this, every abandoned draft
 * would sit on our Pinata account permanently.
 *
 * Deliberately conservative — it only ever removes pins this worker created (they carry
 * our metadata), only ones explicitly marked unpaid, and only after a full day.
 */
export async function sweepUnpaidSites(env: Env): Promise<{ checked: number; removed: number }> {
  const jwt = envVarOptional('PINATA_JWT', env)
  if (!jwt) return { checked: 0, removed: 0 }
  const sites = envVarOptional('SITES_ADDRESS', env)
  // Without the contract there is no way to tell paid from abandoned, and deleting on a
  // guess would remove sites people paid for. Do nothing instead.
  if (!sites) return { checked: 0, removed: 0 }

  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  const query = new URLSearchParams({
    status: 'pinned',
    'metadata[keyvalues]': JSON.stringify({ paid: { value: 'false', op: 'eq' } }),
    pageLimit: '100',
  })

  const listed = await fetch(`https://api.pinata.cloud/data/pinList?${query}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  }).catch(() => null)
  if (!listed?.ok) return { checked: 0, removed: 0 }

  const data = (await listed.json().catch(() => null)) as {
    rows?: { ipfs_pin_hash: string; metadata?: { name?: string; keyvalues?: Record<string, string> } }[]
  } | null

  const rows = data?.rows ?? []
  let removed = 0

  for (const row of rows) {
    // Only our own site pins. A name check as well as the keyvalue, so a stray pin from
    // another tool on the same account can never be caught by this.
    if (!row.metadata?.name?.startsWith('hoodfi-site-')) continue
    const pinnedAt = Number(row.metadata?.keyvalues?.pinnedAt ?? '0')
    if (!pinnedAt || pinnedAt > cutoff) continue

    const node = row.metadata?.keyvalues?.node
    if (!node || !/^0x[0-9a-fA-F]{64}$/.test(node)) continue

    // The chain decides. A read that fails leaves the pin alone — never unpin on a
    // question we could not get an answer to.
    let paid: boolean
    try {
      paid = (await robinhoodClient(env).readContract({
        address: sites as Hex,
        abi: sitesAbi,
        functionName: 'isPaid',
        args: [node as Hex, row.ipfs_pin_hash],
      })) as boolean
    } catch {
      continue
    }
    if (paid) continue

    const gone = await fetch(`https://api.pinata.cloud/pinning/unpin/${row.ipfs_pin_hash}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${jwt}` },
    }).catch(() => null)
    if (gone?.ok) removed += 1
  }

  return { checked: rows.length, removed }
}
