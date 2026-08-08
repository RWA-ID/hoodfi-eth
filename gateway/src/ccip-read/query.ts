import {
  BaseError,
  HttpRequestError,
  RpcRequestError,
  TimeoutError,
  type Hex,
} from 'viem'

import { ROBINHOOD_CHAIN_ID } from '../chains'
import { type Env } from '../env'
import { robinhoodClient } from '../rpc'
import { dnsDecodeName, resolverAbi } from './utils'

type HandleQueryArgs = {
  dnsEncodedName: Hex
  encodedResolveCall: Hex
  targetChainId: bigint
  targetRegistryAddress: Hex
  env: Env
}

/**
 * A record lookup either has an answer — including the empty answer that means
 * "this name has no such record" — or it could not be performed at all. Those two
 * outcomes must never be collapsed: the caller signs answers, and a signed empty
 * is indistinguishable from the truth to every client that receives it.
 */
export type QueryResult =
  | { ok: true; data: Hex }
  | { ok: false; reason: string }

/**
 * True when an error means "we never got an answer" rather than "the contract
 * answered, negatively". A revert is a real answer about a name; a 429, a timeout
 * or a dead socket is not an answer about anything.
 */
function isTransportFailure(error: unknown): boolean {
  if (!(error instanceof BaseError)) return true
  const transportError = error.walk(
    (e) =>
      e instanceof HttpRequestError ||
      e instanceof RpcRequestError ||
      e instanceof TimeoutError
  )
  return transportError !== null
}

/**
 * Forwards the inner record call (addr/text/contenthash/...) to the L2Registry's
 * own onchain `resolve(bytes,bytes)` on Robinhood Chain.
 *
 * A reverting call is answered as empty bytes — that is how an unregistered name or
 * an unsupported record type reads, and clients are entitled to a signed "nothing
 * here". Anything that stops us reaching the chain is reported as a failure so the
 * caller can refuse to sign it.
 */
export async function handleQuery({
  dnsEncodedName,
  encodedResolveCall,
  targetChainId,
  targetRegistryAddress,
  env,
}: HandleQueryArgs): Promise<QueryResult> {
  const name = dnsDecodeName(dnsEncodedName)

  if (targetChainId !== BigInt(ROBINHOOD_CHAIN_ID)) {
    console.error(`Unsupported chain ${targetChainId} for ${name}`)
    return { ok: false, reason: `Unsupported target chain ${targetChainId}` }
  }

  try {
    const data = await robinhoodClient(env).readContract({
      address: targetRegistryAddress,
      abi: [resolverAbi[1]],
      functionName: 'resolve',
      args: [dnsEncodedName, encodedResolveCall],
    })
    return { ok: true, data }
  } catch (error) {
    if (isTransportFailure(error)) {
      // Never signed. The client retries against a gateway that can actually read.
      console.error(`RPC unreachable resolving ${name}:`, error)
      return { ok: false, reason: 'Upstream RPC unavailable' }
    }
    // The chain answered, and the answer is "no record".
    console.warn(`resolve reverted for ${name} — answering empty:`, error)
    return { ok: true, data: '0x' }
  }
}
