/**
 * A reverting record call must be classified as a chain answer, not a transport
 * failure — otherwise the CCIP route answers 502 where it should sign the empty
 * "nothing here" response, and every unsupported record type (and any batched
 * resolve that contains one) fails resolution instead of resolving to "unset".
 *
 * viem reports an on-chain revert as a JSON-RPC `{ code: 3 }` error wrapped in an
 * `RpcRequestError` inside the `ContractFunctionExecutionError` cause chain, so the
 * transport-class walk matches a revert too. These synthetic errors reproduce that
 * exact shape so the check can be exercised without a live chain.
 *
 * Run: `bun scripts/revert-classification.test.ts`
 */
import assert from 'node:assert/strict'

import {
  ContractFunctionRevertedError,
  ExecutionRevertedError,
  HttpRequestError,
  RpcRequestError,
  TimeoutError,
} from 'viem'

import { isTransportFailure } from '../src/ccip-read/query'

// A genuine on-chain revert, shaped the way viem nests it: a ContractFunctionRevertedError
// whose cause chain reaches an ExecutionRevertedError wrapping the JSON-RPC code-3 error.
const revert = new ContractFunctionRevertedError({
  abi: [],
  functionName: 'resolve',
  message: 'execution reverted',
} as never)
;(revert as { cause: unknown }).cause = new ExecutionRevertedError({
  cause: new RpcRequestError({
    body: {},
    error: { code: 3, message: 'execution reverted' },
    url: 'http://rpc.invalid',
  }),
} as never)

// Real transport failures: an RPC that answered with a server error, and a timeout.
const http503 = new HttpRequestError({ url: 'http://rpc.invalid', status: 503 } as never)
const timeout = new TimeoutError({ body: {}, url: 'http://rpc.invalid' } as never)

// A revert is an answer about the name — it must be signed as empty, never 502'd.
assert.equal(
  isTransportFailure(revert),
  false,
  'a genuine on-chain revert must NOT be treated as a transport failure'
)

// Anything that stopped us reaching the chain must still fail closed — never signed.
assert.equal(isTransportFailure(http503), true, 'an HTTP 5xx is a transport failure')
assert.equal(isTransportFailure(timeout), true, 'a timeout is a transport failure')
assert.equal(isTransportFailure(new Error('socket hang up')), true, 'a non-viem error fails closed')

console.log('ok  revert classified as a chain answer, transport failures still fail closed')
