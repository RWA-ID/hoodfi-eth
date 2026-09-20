/**
 * Pre-flight for pointing HoodfiL1Resolver.url() at a new hostname.
 *
 * Run this BEFORE `setUrl`. The resolver holds one URL, so a flip to a hostname that
 * isn't serving yet — cert still issuing, route not propagated — takes every
 * *.hoodfi.eth name down until a second mainnet transaction confirms. There is no
 * rollback that isn't another onchain write.
 *
 * What it does NOT do is diff the two response bodies. The gateway signs over
 * `validUntil`, a wall-clock timestamp, so two hosts answering the same question a
 * second apart produce different bytes by design. Comparing them would fail on a
 * perfectly healthy deploy. Instead each response is pushed back through the mainnet
 * resolver's own resolveWithProof, which is the only check that matters: it verifies
 * the signature against the onchain `signer` and returns the decoded record. If both
 * hosts survive that and agree on the value, the new one is safe to point at.
 *
 *   bun scripts/preflight-custom-domain.ts [name]
 */
import { decodeAbiParameters, decodeErrorResult, encodeFunctionData, namehash, parseAbi } from 'viem'
import type { Hex } from 'viem'

const RPC = 'https://ethereum-rpc.publicnode.com'
const RESOLVER = '0x37215Dd89D0Fd4ea0Dbce690bDe58490fB7f7cF2'
const NAME = process.argv[2] ?? 'test1000.hoodfi.eth'

// The live URL first — it is the control. Without one, a failure here reads as "the new
// host is broken" when the real cause is a down L2 RPC or a name with no records.
const HOSTS = ['https://hoodfi-gateway.dmpay.workers.dev', 'https://ccip.hoodfi-mcp.com']

const abi = parseAbi([
  'function resolve(bytes name, bytes data) view returns (bytes)',
  'function resolveWithProof(bytes response, bytes extraData) view returns (bytes)',
  'function addr(bytes32 node) view returns (address)',
  'function signer() view returns (address)',
  'error OffchainLookup(address sender, string[] urls, bytes callData, bytes4 callbackFunction, bytes extraData)',
])

/** DNS wire format: each label length-prefixed, terminated by a zero byte. */
function dnsEncode(name: string): Hex {
  const out: number[] = []
  for (const label of name.split('.')) {
    const bytes = new TextEncoder().encode(label)
    out.push(bytes.length, ...bytes)
  }
  out.push(0)
  return `0x${Buffer.from(out).toString('hex')}`
}

/**
 * Raw JSON-RPC rather than viem's `call`. viem follows CCIP-Read automatically and would
 * resolve the name for us — which is the opposite of what this needs. We want the
 * OffchainLookup revert itself, unswallowed, to read the exact callData the resolver
 * asks the gateway for.
 */
async function ethCall(data: Hex): Promise<{ ok: boolean; data: Hex }> {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: RESOLVER, data }, 'latest'],
    }),
  })
  const json = (await res.json()) as {
    result?: Hex
    error?: { data?: Hex | { data?: Hex }; message?: string }
  }
  if (json.error) {
    const raw = json.error.data
    const hex = typeof raw === 'string' ? raw : (raw?.data ?? '0x')
    return { ok: false, data: hex as Hex }
  }
  return { ok: true, data: json.result as Hex }
}

// ── 1. Ask the resolver what it wants, by letting it revert ──────────────────────────
const resolveCall = encodeFunctionData({
  abi,
  functionName: 'resolve',
  args: [dnsEncode(NAME), encodeFunctionData({ abi, functionName: 'addr', args: [namehash(NAME)] })],
})

const lookup = await ethCall(resolveCall)
if (lookup.ok) {
  console.error(`✗ ${NAME} resolved onchain without an OffchainLookup — not a wildcard subname?`)
  process.exit(1)
}

const decoded = decodeErrorResult({ abi, data: lookup.data })
if (decoded.errorName !== 'OffchainLookup') {
  console.error(`✗ expected OffchainLookup, got ${decoded.errorName}`)
  process.exit(1)
}
const [sender, urls, callData, , extraData] = decoded.args as [Hex, string[], Hex, Hex, Hex]

console.log(`name:        ${NAME}`)
console.log(`onchain url: ${urls[0]}`)

// The path template lives onchain and the new host has to honour it exactly — the route
// is /v1/:sender/:data and the handler strips the .json suffix.
const template = urls[0].replace(/^https:\/\/[^/]+/, '')

// ── 2. Check the onchain signer against what each host reports ───────────────────────
const signerCall = await ethCall(encodeFunctionData({ abi, functionName: 'signer', args: [] }))
const onchainSigner = decodeAbiParameters([{ type: 'address' }], signerCall.data)[0] as string
console.log(`onchain signer: ${onchainSigner}\n`)

// ── 3. Query every host and verify its answer through the resolver ───────────────────
const results = new Map<string, string>()
let failed = false

for (const host of HOSTS) {
  console.log(`── ${host}`)

  try {
    const health = (await (await fetch(`${host}/health`)).json()) as { signer?: string }
    const match = health.signer?.toLowerCase() === onchainSigner.toLowerCase()
    console.log(`   signer:   ${health.signer} ${match ? '✓' : '✗ DOES NOT MATCH ONCHAIN'}`)
    if (!match) failed = true
  } catch (err) {
    console.error(`   health:   ✗ unreachable — ${(err as Error).message}`)
    failed = true
    continue
  }

  const url = host + template.replace('{sender}', sender).replace('{data}', callData)

  let response: Hex
  try {
    const res = await fetch(url)
    if (!res.ok) {
      // A 502 here is the gateway refusing to sign because it could not read the L2 —
      // deliberate, and not a fault of the hostname under test.
      console.error(`   ccip:     ✗ HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`)
      failed = true
      continue
    }
    response = ((await res.json()) as { data: Hex }).data
  } catch (err) {
    console.error(`   ccip:     ✗ ${(err as Error).message}`)
    failed = true
    continue
  }

  // The real test: would mainnet accept this answer?
  const proof = await ethCall(
    encodeFunctionData({ abi, functionName: 'resolveWithProof', args: [response, extraData] })
  )
  if (!proof.ok) {
    console.error(`   verify:   ✗ resolver rejected the signature (wrong signer key?)`)
    failed = true
    continue
  }

  const record = decodeAbiParameters([{ type: 'bytes' }], proof.data)[0] as Hex
  const address = decodeAbiParameters([{ type: 'address' }], record)[0] as string
  console.log(`   verify:   ✓ accepted by resolveWithProof`)
  console.log(`   addr:     ${address}`)
  results.set(host, address.toLowerCase())
}

// ── 4. Every host must agree ─────────────────────────────────────────────────────────
const values = new Set(results.values())
console.log()
if (failed || results.size !== HOSTS.length) {
  console.error('✗ NOT SAFE TO setUrl — a host failed above')
  process.exit(1)
}
if (values.size !== 1) {
  console.error(`✗ NOT SAFE TO setUrl — hosts disagree: ${[...results].map(([h, v]) => `${h}=${v}`).join(', ')}`)
  process.exit(1)
}
console.log('✓ all hosts verify against the mainnet resolver and agree — safe to setUrl')
