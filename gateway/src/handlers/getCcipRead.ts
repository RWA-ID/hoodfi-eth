import { type Hex, serializeSignature } from 'viem'
import { privateKeyToAccount, sign } from 'viem/accounts'
import {
  decodeAbiParameters,
  decodeFunctionData,
  encodeAbiParameters,
  encodePacked,
  isAddress,
  isHex,
  keccak256,
} from 'viem/utils'

import { handleQuery } from '../ccip-read/query'
import { resolverAbi } from '../ccip-read/utils'
import { ROBINHOOD_CHAIN_ID } from '../chains'
import { type Env, envVar, envVarOptional } from '../env'

const STUFFED_RESOLVE_SELECTOR = '0x21759430' // stuffedResolveCall(bytes,bytes,uint64,address)
const RESOLVE_SELECTOR = '0x9061b923' // resolve(bytes,bytes)

type DecodedRequest = {
  dnsEncodedName: Hex
  encodedResolveCall: Hex
  targetChainId: bigint
  targetRegistryAddress: Hex
}

/**
 * Accepts every wire shape a client might send (hard-won lesson — gateways that
 * only handle one shape pass manual tests and fail real tooling):
 *  A) stuffedResolveCall(name, data, chainId, registry) — what HoodfiL1Resolver emits;
 *     wallets re-send it verbatim.
 *  B) resolve(name, data) with the 0x9061b923 selector — what ezccip/NameStone
 *     validation tools construct independently.
 *  C) raw abi.encode(name, data) tuple with no selector — legacy offchain-resolver shape.
 * B and C carry no L2 target, so the env-configured defaults fill in.
 */
function decodeRequest(data: Hex, env: Env): DecodedRequest {
  const selector = data.slice(0, 10).toLowerCase()

  if (selector === STUFFED_RESOLVE_SELECTOR) {
    const decoded = decodeFunctionData({ abi: [resolverAbi[0]], data })
    return {
      dnsEncodedName: decoded.args[0] as Hex,
      encodedResolveCall: decoded.args[1] as Hex,
      targetChainId: decoded.args[2] as bigint,
      targetRegistryAddress: decoded.args[3] as Hex,
    }
  }

  const defaultRegistry = envVarOptional('L2_REGISTRY_ADDRESS', env)
  if (!defaultRegistry) {
    throw new Error('Request has no L2 target and L2_REGISTRY_ADDRESS is not set')
  }

  let name: Hex
  let call: Hex
  if (selector === RESOLVE_SELECTOR) {
    const decoded = decodeFunctionData({ abi: [resolverAbi[1]], data })
    ;[name, call] = decoded.args as [Hex, Hex]
  } else {
    ;[name, call] = decodeAbiParameters(
      [{ type: 'bytes' }, { type: 'bytes' }],
      data
    ) as [Hex, Hex]
  }

  return {
    dnsEncodedName: name,
    encodedResolveCall: call,
    targetChainId: BigInt(ROBINHOOD_CHAIN_ID),
    targetRegistryAddress: defaultRegistry,
  }
}

// Implements EIP-3668
export const getCcipRead = async (
  senderParam: string,
  dataParam: string,
  env: Env
): Promise<Response> => {
  // Templated GET urls conventionally end in `.json` — tolerate both forms
  const sender = senderParam
  const data = dataParam.replace(/\.json$/, '')

  if (!isAddress(sender) || !isHex(data)) {
    return Response.json({ message: 'Invalid request' }, { status: 400 })
  }

  let decoded: DecodedRequest
  try {
    decoded = decodeRequest(data as Hex, env)
  } catch (error) {
    console.error('Failed to decode request:', error)
    return Response.json({ message: 'Unable to decode request payload' }, { status: 400 })
  }

  const result = await handleQuery({ ...decoded, env })

  const ttl = 300
  const validUntil = Math.floor(Date.now() / 1000 + ttl)

  // Matches SignatureVerifier.makeSignatureHash: raw digest (NOT EIP-191) over
  // 0x1900 ‖ resolver ‖ expires ‖ keccak(request) ‖ keccak(result)
  const messageHash = keccak256(
    encodePacked(
      ['bytes', 'address', 'uint64', 'bytes32', 'bytes32'],
      [
        '0x1900',
        sender,
        BigInt(validUntil),
        keccak256(data as Hex),
        keccak256(result),
      ]
    )
  )

  const sig = await sign({
    hash: messageHash,
    privateKey: envVar('SIGNER_PRIVATE_KEY', env),
  })

  // ABI-encoded (bytes result, uint64 expires, bytes sig) — what resolveWithProof expects
  const encodedResponse = encodeAbiParameters(
    [
      { name: 'result', type: 'bytes' },
      { name: 'expires', type: 'uint64' },
      { name: 'sig', type: 'bytes' },
    ],
    [result, BigInt(validUntil), serializeSignature(sig)]
  )

  return Response.json({ data: encodedResponse }, { status: 200 })
}

export const getHealth = (env: Env): Response => {
  let signer: string | null = null
  try {
    signer = privateKeyToAccount(envVar('SIGNER_PRIVATE_KEY', env)).address
  } catch {
    // leave null — surfaces a misconfigured worker without leaking why
  }
  return Response.json({
    status: 'ok',
    service: 'hoodfi-gateway',
    signer,
    chainId: ROBINHOOD_CHAIN_ID,
    defaultRegistry: envVarOptional('L2_REGISTRY_ADDRESS', env) ?? null,
  })
}
