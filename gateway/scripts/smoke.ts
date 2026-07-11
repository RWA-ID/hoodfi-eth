/**
 * Local smoke test: starts nothing itself — run the worker first:
 *   SIGNER_PRIVATE_KEY=0x... L2_REGISTRY_ADDRESS=0x... bun src/index.ts
 * Then: bun scripts/smoke.ts
 *
 * Exercises all three wire shapes and verifies the signature recovers to the signer.
 */
import {
  concatHex,
  createWalletClient,
  decodeAbiParameters,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  http,
  keccak256,
  parseAbi,
  toHex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { recoverAddress } from 'viem/utils'

const BASE = process.env.GATEWAY_URL ?? 'http://localhost:3000'
const SENDER = '0x1111111111111111111111111111111111111111'
const SIGNER_KEY = (process.env.SIGNER_PRIVATE_KEY ??
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d') as `0x${string}`

const abi = parseAbi([
  'function stuffedResolveCall(bytes name, bytes data, uint64 targetChainId, address targetRegistryAddress) view returns (bytes)',
  'function resolve(bytes name, bytes data) view returns (bytes)',
  'function addr(bytes32 node) view returns (address)',
])

function dnsEncode(name: string): `0x${string}` {
  const parts = name.split('.')
  const bytes: number[] = []
  for (const part of parts) {
    bytes.push(part.length)
    for (const ch of new TextEncoder().encode(part)) bytes.push(ch)
  }
  bytes.push(0)
  return toHex(new Uint8Array(bytes))
}

const name = dnsEncode('blake.hoodfi.eth')
const inner = encodeFunctionData({
  abi,
  functionName: 'addr',
  args: ['0x' + '11'.repeat(32) as `0x${string}`],
})

async function verifyResponse(label: string, request: `0x${string}`, res: Response) {
  if (res.status !== 200) {
    console.error(`✗ ${label}: HTTP ${res.status}: ${await res.text()}`)
    process.exitCode = 1
    return
  }
  const { data } = (await res.json()) as { data: `0x${string}` }
  const [result, expires, sig] = decodeAbiParameters(
    [{ type: 'bytes' }, { type: 'uint64' }, { type: 'bytes' }],
    data
  )
  const digest = keccak256(
    encodePacked(
      ['bytes', 'address', 'uint64', 'bytes32', 'bytes32'],
      ['0x1900', SENDER, expires as bigint, keccak256(request), keccak256(result as `0x${string}`)]
    )
  )
  const recovered = await recoverAddress({ hash: digest, signature: sig as `0x${string}` })
  const expected = privateKeyToAccount(SIGNER_KEY).address
  const ok = recovered.toLowerCase() === expected.toLowerCase()
  console.log(
    `${ok ? '✓' : '✗'} ${label}: result=${result} expires=${expires} signer ${ok ? 'verified' : `MISMATCH ${recovered} != ${expected}`}`
  )
  if (!ok) process.exitCode = 1
}

// Shape A: stuffedResolveCall (what the resolver emits)
const stuffed = encodeFunctionData({
  abi,
  functionName: 'stuffedResolveCall',
  args: [name, inner, 4663n, '0x2222222222222222222222222222222222222222'],
})
await verifyResponse(
  'GET stuffed shape (.json)',
  stuffed,
  await fetch(`${BASE}/v1/${SENDER}/${stuffed}.json`)
)

// Shape B: resolve(bytes,bytes)-wrapped (ezccip/NameStone tooling)
const wrapped = encodeFunctionData({ abi, functionName: 'resolve', args: [name, inner] })
await verifyResponse(
  'GET resolve-wrapped shape',
  wrapped,
  await fetch(`${BASE}/v1/${SENDER}/${wrapped}`)
)

// Shape C: raw abi.encode(name, data) tuple
const raw = encodeAbiParameters([{ type: 'bytes' }, { type: 'bytes' }], [name, inner])
await verifyResponse('POST raw tuple shape', raw, await fetch(`${BASE}/v1`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ sender: SENDER, data: raw }),
}))

const health = await (await fetch(`${BASE}/health`)).json()
console.log('health:', JSON.stringify(health))
