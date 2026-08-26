import { type Hex, parseAbi, toHex } from 'viem'

import { type Env, envVar } from '../env'
import { robinhoodClient } from '../rpc'
import { dnsDecodeName } from '../ccip-read/utils'

const registryAbi = parseAbi(['function names(bytes32) view returns (bytes)'])

/**
 * ERC-721 metadata for a hoodfi.eth subname.
 *
 * OpenSea requests `baseURI + tokenId` with tokenId in decimal, so we take the
 * decimal uint256, convert back to the bytes32 ENS node, and read the registry's
 * DNS-encoded name. An unminted or unknown id has no name — 404 rather than a
 * placeholder, so marketplaces don't cache a phantom token.
 *
 * `requestUrl` supplies the origin the art is served from. It comes from the request
 * rather than a configured constant on purpose: the registry's baseURI is the address a
 * marketplace actually reached us on, and an image URL built from anything else would
 * point somewhere the collection isn't.
 */
export async function getTokenMetadata(tokenId: string, requestUrl: string, env: Env) {
  let node: Hex
  try {
    node = toHex(BigInt(tokenId), { size: 32 })
  } catch {
    return Response.json({ message: 'Invalid token id' }, { status: 400 })
  }

  let dnsEncodedName: Hex
  try {
    dnsEncodedName = await robinhoodClient(env).readContract({
      address: envVar('L2_REGISTRY_ADDRESS', env),
      abi: registryAbi,
      functionName: 'names',
      args: [node],
    })
  } catch (error) {
    console.error(`names() failed for ${tokenId}:`, error)
    return Response.json({ message: 'Registry unavailable' }, { status: 502 })
  }

  if (dnsEncodedName === '0x' || dnsEncodedName.length <= 2) {
    return Response.json({ message: 'Token not found' }, { status: 404 })
  }

  const name = dnsDecodeName(dnsEncodedName)
  const segments = name.split('.')
  const label = segments[0] ?? name
  const origin = new URL(requestUrl).origin

  /**
   * The name's actual parent, not the collection's root.
   *
   * `hoodfi.eth` was hardcoded here, which is right for the names HoodFi sells and wrong
   * for every subname a holder creates: `crypto.gm.hoodfi.eth` was listing a parent of
   * `hoodfi.eth`, telling a marketplace it sits alongside the names issued directly rather
   * than under `gm.hoodfi.eth`. That trait is the one place a buyer could have checked, so
   * it has to be read off the name.
   */
  const parent = segments.slice(1).join('.')
  /** Subnames nest to any depth; anything below a name HoodFi issued was created by a holder. */
  const isSubname = segments.length > 3
  /** The whole path below the root — `crypto.gm`, not `crypto`, which names a different token. */
  const path = name.endsWith('.hoodfi.eth')
    ? name.slice(0, -'.hoodfi.eth'.length)
    : label

  return Response.json(
    {
      name,
      // "issued by HoodFi" is a claim, and for a subname it is a false one — `crypto.gm.hoodfi.eth`
      // was created by whoever holds `gm.hoodfi.eth`. Both still resolve identically, which is
      // why the sentence has to distinguish them: the resolution is the part that is the same.
      description: isSubname
        ? `${name} — an ENS subname of ${parent} on Robinhood Chain, created by its holder. ` +
          `Resolves onchain across Ethereum via CCIP-Read.`
        : `${name} — an ENS name on Robinhood Chain, issued by HoodFi. ` +
          `Resolves onchain across Ethereum via CCIP-Read.`,
      // The name itself, set on the house lime. Every token used to share one piece of
      // collection art, which left a marketplace grid unable to say which name was which.
      // The whole name, not the label: the registry's root token is `hoodfi.eth`, which
      // a label plus a fixed parent would draw as `hoodfi.hoodfi.eth`.
      image: `${origin}/art/${encodeURIComponent(name)}.png`,
      external_url: `https://hoodfi.eth.limo/?name=${encodeURIComponent(path)}`,
      attributes: [
        { trait_type: 'Length', value: label.length },
        { trait_type: 'Character Set', value: characterSet(label) },
        { trait_type: 'Parent', value: parent },
        // Stated outright rather than left to be inferred from Parent, because a filter is
        // how a marketplace grid actually gets read. The art carries the same distinction
        // as a ground colour; this is the half a buyer can sort on.
        { trait_type: 'Type', value: isSubname ? 'Subname' : 'Issued' },
        { trait_type: 'Chain', value: 'Robinhood Chain' },
      ],
    },
    {
      // Names are immutable once minted; cache hard but let marketplaces revalidate.
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' },
    }
  )
}

function characterSet(label: string): string {
  if (/^\d+$/.test(label)) return 'Number'
  if (/^[a-z]+$/.test(label)) return 'Letter'
  if (/^[a-z0-9]+$/.test(label)) return 'Alphanumeric'
  return 'Mixed'
}
