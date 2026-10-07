import {
  type Address,
  type Hex,
  getAddress,
  isAddress,
  parseAbi,
  parseAbiItem,
  toHex,
} from 'viem'

import { type Env, envVar } from '../env'
import { getLogsInWindows } from '../logs'
import { robinhoodClient } from '../rpc'
import { dnsDecodeName } from '../ccip-read/utils'

/** The L2Registry's deploy block on Robinhood Chain — no Transfer can predate it. */
const REGISTRY_DEPLOY_BLOCK = 15164296n

/** Multicall3, at its canonical address — verified deployed on Robinhood Chain. */
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const

/** Short: names change hands, and a buyer must not be labelled with the seller's name for long. */
const CACHE_SECONDS = 60

const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
)

const registryAbi = parseAbi([
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function names(bytes32 node) view returns (bytes)',
  'function addr(bytes32 node) view returns (address)',
  'function text(bytes32 node, string key) view returns (string)',
])

type OwnedName = {
  name: string
  node: Hex
  /** The name's ETH address record, or null when unset. */
  addr: Address | null
  /** True when the name's address record points back at the owner. */
  resolves: boolean
  avatar: string | null
}

/**
 * Reverse lookup: the *.hoodfi.eth names an address holds.
 *
 * ENS reverse resolution (`getEnsName`, `useEnsName`) returns null for every hoodfi holder:
 * a primary name lives in the mainnet ReverseRegistrar, which an L2 name cannot write to.
 * So an app that starts from an address — a launchpad's "created by", a chat sender —
 * has no standard way to find the name. This is that way.
 *
 * The registry is a plain ERC-721, not Enumerable, and token ids are namehashes, so a
 * wallet's names cannot be walked. The one log indexed by recipient is Transfer: collect
 * every Transfer *to* the address, then re-check `ownerOf` for each, because receiving a
 * name once is not holding it now.
 *
 * `primary` follows the rule ENS applies to a primary name — the name must resolve
 * forward to the same address — so a buyer whose record still points at the seller is
 * never labelled with it, and neither is the seller. Among the names that pass, the one
 * picked is the shallowest, then shortest, then alphabetical: deterministic, and it
 * prefers `gm.hoodfi.eth` to a subname the owner created beneath it.
 *
 * Failure is a 502, never an empty list. "This wallet has no name" and "the RPC was
 * throttled" must not look the same to the caller, or a throttle quietly strips every
 * name off a page.
 */
export async function getOwnerNames(
  rawAddress: string,
  request: Request,
  env: Env
): Promise<Response> {
  if (!isAddress(rawAddress, { strict: false })) {
    return Response.json({ message: 'Not an address' }, { status: 400 })
  }
  const owner = getAddress(rawAddress)

  // Keyed on the checksummed address, so `0xabc…` and `0xABC…` share one entry.
  // `caches` only exists on Workers; local Bun runs go straight to the chain.
  const cache =
    typeof caches === 'undefined'
      ? null
      : (caches as unknown as { default: Cache }).default
  const cacheKey = new Request(new URL(`/owner/${owner}/names`, request.url).toString())
  const hit = await cache?.match(cacheKey)
  if (hit) return hit

  const registry = envVar('L2_REGISTRY_ADDRESS', env) as Address
  const client = robinhoodClient(env)

  let names: OwnedName[]
  try {
    // Windowed: the RPC caps a log query at 10M blocks. See ../logs.ts.
    const logs = await getLogsInWindows(client, REGISTRY_DEPLOY_BLOCK, (fromBlock, toBlock) =>
      client.getLogs({
        address: registry,
        event: transferEvent,
        args: { to: owner },
        fromBlock,
        toBlock,
      })
    )
    const tokenIds = [
      ...new Set(
        logs
          .map((log) => log.args.tokenId)
          .filter((id): id is bigint => id !== undefined)
      ),
    ]
    names = await readOwned(client, registry, owner, tokenIds)
  } catch (error) {
    console.error('owner names read failed:', error)
    return Response.json(
      { message: 'Could not read names from Robinhood Chain' },
      { status: 502 }
    )
  }

  names.sort(
    (a, b) =>
      Number(b.resolves) - Number(a.resolves) ||
      a.name.split('.').length - b.name.split('.').length ||
      a.name.length - b.name.length ||
      a.name.localeCompare(b.name)
  )
  const primary = names.find((n) => n.resolves)?.name ?? null

  const response = Response.json(
    { address: owner, primary, names },
    { headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` } }
  )
  // Only successes are cached — a 502 must be retried, not remembered.
  await cache?.put(cacheKey, response.clone())
  return response
}

/**
 * ownerOf + names + addr + avatar for every candidate, in one multicall.
 *
 * `allowFailure` per call, because a single call failing *inside* a multicall is a
 * genuine revert executed on chain (a burned token's ownerOf) and only that name is
 * dropped. A throttled or failed request throws as a whole and becomes the 502 above —
 * the distinction a per-call `catch {}` cannot make.
 */
async function readOwned(
  client: ReturnType<typeof robinhoodClient>,
  registry: Address,
  owner: Address,
  tokenIds: bigint[]
): Promise<OwnedName[]> {
  if (tokenIds.length === 0) return []

  const results = await client.multicall({
    multicallAddress: MULTICALL3,
    allowFailure: true,
    contracts: tokenIds.flatMap((tokenId) => {
      const node = toHex(tokenId, { size: 32 })
      return [
        { address: registry, abi: registryAbi, functionName: 'ownerOf', args: [tokenId] },
        { address: registry, abi: registryAbi, functionName: 'names', args: [node] },
        { address: registry, abi: registryAbi, functionName: 'addr', args: [node] },
        { address: registry, abi: registryAbi, functionName: 'text', args: [node, 'avatar'] },
      ] as const
    }),
  })

  const owned: OwnedName[] = []
  tokenIds.forEach((tokenId, i) => {
    const [ownerOf, encoded, addr, avatar] = results.slice(i * 4, i * 4 + 4)
    if (ownerOf.status !== 'success' || encoded.status !== 'success') return
    if (getAddress(ownerOf.result as Address) !== owner) return

    const name = dnsDecodeName(encoded.result as Hex)
    if (!name) return

    const record =
      addr.status === 'success' &&
      (addr.result as Address) !== '0x0000000000000000000000000000000000000000'
        ? getAddress(addr.result as Address)
        : null

    owned.push({
      name,
      node: toHex(tokenId, { size: 32 }),
      addr: record,
      resolves: record === owner,
      avatar: avatar.status === 'success' && avatar.result ? (avatar.result as string) : null,
    })
  })
  return owned
}
