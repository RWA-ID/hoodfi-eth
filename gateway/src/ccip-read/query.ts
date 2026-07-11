import { http, type Hex, createPublicClient } from 'viem'

import { robinhoodChain, DEFAULT_ROBINHOOD_RPC, ROBINHOOD_CHAIN_ID } from '../chains'
import { type Env, envVarOptional } from '../env'
import { dnsDecodeName, resolverAbi } from './utils'

type HandleQueryArgs = {
  dnsEncodedName: Hex
  encodedResolveCall: Hex
  targetChainId: bigint
  targetRegistryAddress: Hex
  env: Env
}

/**
 * Forwards the inner record call (addr/text/contenthash/...) to the L2Registry's
 * own onchain `resolve(bytes,bytes)` on Robinhood Chain. Unknown record types and
 * unregistered names return empty bytes — a CCIP gateway must answer, never crash.
 */
export async function handleQuery({
  dnsEncodedName,
  encodedResolveCall,
  targetChainId,
  targetRegistryAddress,
  env,
}: HandleQueryArgs): Promise<Hex> {
  const name = dnsDecodeName(dnsEncodedName)

  if (targetChainId !== BigInt(ROBINHOOD_CHAIN_ID)) {
    console.error(`Unsupported chain ${targetChainId} for ${name}`)
    return '0x'
  }

  const l2Client = createPublicClient({
    chain: robinhoodChain,
    transport: http(envVarOptional('ROBINHOOD_RPC_URL', env) ?? DEFAULT_ROBINHOOD_RPC),
  })

  console.log({ targetChainId, targetRegistryAddress, name })

  try {
    return await l2Client.readContract({
      address: targetRegistryAddress,
      abi: [resolverAbi[1]],
      functionName: 'resolve',
      args: [dnsEncodedName, encodedResolveCall],
    })
  } catch (error) {
    // Unregistered name / unsupported record — answer empty rather than 500 so
    // clients get a clean "no record" instead of a cryptic HTTP failure.
    console.error(`resolve failed for ${name}:`, error)
    return '0x'
  }
}
