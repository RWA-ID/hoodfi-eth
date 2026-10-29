// Short names through the agent path, after the HoodFi Safe called openShorts()
// (2026-10-29). Same harness as paybox.fork.mjs: an anvil fork of Robinhood Chain, the
// Worker bundled for Node, a signing-only wallet that signs each step AS GIVEN.
//
//   anvil --fork-url https://rpc.mainnet.chain.robinhood.com --chain-id 4663 --port 8547
//   node_modules/.bin/esbuild src/index.ts --bundle --platform=node --format=esm --outfile=/tmp/hoodfi-node/index.mjs
//   BUNDLE=/tmp/hoodfi-node/index.mjs node test/shortnames.fork.mjs
import assert from 'node:assert/strict'
import { createTestClient, http } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

const worker = (await import(process.env.BUNDLE)).default
const FORK = 'http://127.0.0.1:8547'
const env = {
  ROBINHOOD_RPC_URL: FORK,
  REGISTRAR_ADDRESS: '0x56be5565acc823f4195c2cf3b9046C083633209a',
  L2_REGISTRY_ADDRESS: '0xf2bABA012244bdD7445129597350054E1B3aEe5C',
  USDG_ADDRESS: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
}
const chain = { id: 4663, name: 'rh', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [FORK] } } }
const anvil = createTestClient({ mode: 'anvil', chain, transport: http(FORK) })

let id = 0
async function rpc(method, params) {
  const res = await worker.fetch(
    new Request('https://hoodfi-mcp.com/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
    }),
    env,
    { waitUntil() {}, passThroughOnException() {} }
  )
  return (await res.json()).result
}
const call = async (name, args) => {
  const r = await rpc('tools/call', { name, arguments: args })
  return { isError: r.isError, data: r.structuredContent, text: r.content[0].text }
}
const ok = (m) => console.log(`  ok   ${m}`)
const signAsGiven = (account, t) =>
  account.signTransaction({
    chainId: Number(t.chainId), type: 'eip1559', to: t.to, data: t.data, value: BigInt(t.value),
    nonce: Number(t.nonce), gas: BigInt(t.gas), maxFeePerGas: BigInt(t.maxFeePerGas), maxPriorityFeePerGas: BigInt(t.maxPriorityFeePerGas),
  })

const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } })
assert.ok(!/100-year/.test(init.instructions) && /1-3 characters are premium/.test(init.instructions))
ok('server instructions describe short names as priced, not locked')

// A short label nobody holds yet on the fork. Picked at run time: mainnet keeps moving.
const me = privateKeyToAccount(generatePrivateKey())
await anvil.setBalance({ address: me.address, value: 10n ** 18n })
let label
for (const candidate of ['og', 'q7', 'z9', 'k3x', 'w8z']) {
  const r = await call('hoodfi_check_name', { name: candidate })
  if (r.data?.available) { label = candidate; break }
}
assert.ok(label, 'no free short label among the candidates')

let r = await call('hoodfi_check_name', { name: label })
assert.equal(r.data.registerableByAgents, true, r.text)
assert.equal(r.data.price.usdg, label.length === 2 ? '10' : '5', r.text)
ok(`check_name ${label}: registerable by agents at $${r.data.price.usdg} USDG / ${r.data.price.eth} ETH`)

r = await call('hoodfi_build_registration_tx', { name: label, address: me.address })
assert.ok(!r.isError, r.text)
for (const s of r.data.steps) {
  const sent = await call('hoodfi_send_transaction', { signed_transaction: await signAsGiven(me, s.transaction) })
  assert.equal(sent.data?.status, 'success', sent.text)
}
r = await call('hoodfi_check_name', { name: label })
assert.equal(r.data.available, false)
assert.match(r.data.reason, /already registered/)
ok(`register ${label}.hoodfi.eth: built, signed as given, mined; now reads as registered`)

r = await call('hoodfi_build_registration_tx', { name: 'mcp', address: me.address })
assert.ok(r.isError && /reserved list/.test(r.text), r.text)
r = await call('hoodfi_check_name', { name: 'rpc' })
assert.equal(r.data.registerableByAgents, false)
ok('blocklisted short labels (mcp, rpc) are still refused')

console.log(`\nHoodFi short names fork OK (${label}.hoodfi.eth)`)
