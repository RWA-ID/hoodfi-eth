/**
 * Which RPC errors the CCIP route signs as an empty answer, and which it refuses.
 *   bun scripts/revert-classification.test.ts
 *
 * The errors come from a real viem client talking to a local mock RPC, not from error
 * objects built by hand: what matters is how viem wraps each response. A hand-built
 * revert passes a check that also signs -32603 "Internal error" as "no records".
 *
 * Finally one live read: pubkey(), which the L2 resolver doesn't implement, reverts on
 * Robinhood Chain and must come back as a signed empty, not a 502.
 */
import assert from 'node:assert/strict'
import { type BaseError, createPublicClient, http, parseAbi } from 'viem'

import { handleQuery, isTransportFailure } from '../src/ccip-read/query'

const REGISTRY = '0xf2bABA012244bdD7445129597350054E1B3aEe5C'
const abi = parseAbi(['function resolve(bytes,bytes) view returns (bytes)'])

async function errorFor(rpcError: object): Promise<BaseError> {
  const server = Bun.serve({
    port: 0,
    fetch: async (req) =>
      Response.json({ jsonrpc: '2.0', id: ((await req.json()) as { id: number }).id, error: rpcError }),
  })
  try {
    const client = createPublicClient({ transport: http(`http://localhost:${server.port}`, { retryCount: 0 }) })
    await client.readContract({ address: REGISTRY, abi, functionName: 'resolve', args: ['0x00', '0x'] })
    throw new Error('mock RPC answered')
  } catch (error) {
    return error as BaseError
  } finally {
    server.stop(true)
  }
}

const cases: [string, object, boolean][] = [
  ['execution reverted (code 3)', { code: 3, message: 'execution reverted', data: '0x' }, false],
  ['internal error (-32603)', { code: -32603, message: 'Internal error' }, true],
  ['gas cap', { code: -32000, message: 'gas required exceeds allowance (50000000)' }, true],
  ['limit exceeded (-32005)', { code: -32005, message: 'limit exceeded' }, true],
]
for (const [label, rpcError, refuse] of cases) {
  assert.equal(isTransportFailure(await errorFor(rpcError)), refuse, label)
  console.log(`ok  ${label} -> ${refuse ? 'refused (502)' : 'signed empty'}`)
}
assert.equal(isTransportFailure(new Error('socket hang up')), true, 'a non-viem error')
console.log('ok  non-viem error -> refused (502)')

const node = '1'.padStart(64, '0')
const live = await handleQuery({
  dnsEncodedName: '0x02676d06686f6f6466690365746800', // gm.hoodfi.eth
  encodedResolveCall: `0xc8690233${node}`, // pubkey(bytes32)
  targetChainId: 4663n,
  targetRegistryAddress: REGISTRY,
  env: {} as never,
})
assert.deepEqual(live, { ok: true, data: '0x' }, 'live pubkey revert')
console.log('ok  live pubkey revert on gm.hoodfi.eth -> signed empty')
