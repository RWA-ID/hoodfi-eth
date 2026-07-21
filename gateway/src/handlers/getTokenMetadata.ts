import { http, type Hex, createPublicClient, parseAbi, toHex } from 'viem'

import { robinhoodChain, DEFAULT_ROBINHOOD_RPC } from '../chains'
import { type Env, envVar, envVarOptional } from '../env'
import { dnsDecodeName } from '../ccip-read/utils'

/** Collection art, shared by every name. Pinned on IPFS so metadata art outlives the worker. */
const IMAGE_CID = 'QmTCk5fENM4LNeT3BxVMHd3rHpnibDW8ZSDrrRTNsWybgZ'
const IMAGE_URI = `ipfs://${IMAGE_CID}`

const registryAbi = parseAbi(['function names(bytes32) view returns (bytes)'])

/**
 * ERC-721 metadata for a hoodfi.eth subname.
 *
 * OpenSea requests `baseURI + tokenId` with tokenId in decimal, so we take the
 * decimal uint256, convert back to the bytes32 ENS node, and read the registry's
 * DNS-encoded name. An unminted or unknown id has no name — 404 rather than a
 * placeholder, so marketplaces don't cache a phantom token.
 */
export async function getTokenMetadata(tokenId: string, env: Env) {
  let node: Hex
  try {
    node = toHex(BigInt(tokenId), { size: 32 })
  } catch {
    return Response.json({ message: 'Invalid token id' }, { status: 400 })
  }

  const client = createPublicClient({
    chain: robinhoodChain,
    transport: http(envVarOptional('ROBINHOOD_RPC_URL', env) ?? DEFAULT_ROBINHOOD_RPC),
  })

  let dnsEncodedName: Hex
  try {
    dnsEncodedName = await client.readContract({
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
  const label = name.split('.')[0] ?? name

  return Response.json(
    {
      name,
      description:
        `${name} — an ENS name on Robinhood Chain, issued by HoodFi. ` +
        `Resolves onchain across Ethereum via CCIP-Read.`,
      image: IMAGE_URI,
      external_url: `https://hoodfi.eth.limo/?name=${encodeURIComponent(label)}`,
      attributes: [
        { trait_type: 'Length', value: label.length },
        { trait_type: 'Character Set', value: characterSet(label) },
        { trait_type: 'Parent', value: 'hoodfi.eth' },
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
