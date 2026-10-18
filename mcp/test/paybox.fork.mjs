// The PayBox path, against an anvil fork of Robinhood Chain, through the Worker exactly as
// wrangler bundles it. A signing-only wallet signs each step's `transaction` AS GIVEN —
// nothing looked up or filled in — and hoodfi_send_transaction broadcasts it.
//
//   anvil --fork-url https://rpc.mainnet.chain.robinhood.com --chain-id 4663 --port 8547
//   node_modules/.bin/esbuild src/index.ts --bundle --platform=node --format=esm --outfile=/tmp/hoodfi-node/index.mjs
//   BUNDLE=/tmp/hoodfi-node/index.mjs node test/paybox.fork.mjs
//
// (Not wrangler's --dry-run output: that bundle targets workerd and never finishes
// importing under Node.)
//
// Anvil has no ArbOS, so gas here omits the L1 component a real Robinhood estimate
// includes; this proves the transaction is complete and well-formed, not the gas price.
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

// What PayBox does with {op: "transaction", transaction}: sign the object as given.
const signAsGiven = (account, t) =>
  account.signTransaction({
    chainId: Number(t.chainId), type: 'eip1559', to: t.to, data: t.data, value: BigInt(t.value),
    nonce: Number(t.nonce), gas: BigInt(t.gas), maxFeePerGas: BigInt(t.maxFeePerGas), maxPriorityFeePerGas: BigInt(t.maxPriorityFeePerGas),
  })
async function runSteps(account, steps) {
  for (const s of steps) {
    const r = await call('hoodfi_send_transaction', { signed_transaction: await signAsGiven(account, s.transaction) })
    assert.equal(r.data?.status, 'success', r.text)
  }
}

const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } })
assert.ok(init.capabilities.resources && init.serverInfo.icons?.length && init.instructions.includes('hoodfi_send_transaction'))
const { tools } = await rpc('tools/list', {})
assert.equal(tools.length, 11, tools.map((t) => t.name).join())
assert.equal(tools.filter((t) => t._meta?.ui?.resourceUri === 'ui://hoodfi/action-card.html').length, 7)
const card = (await rpc('resources/read', { uri: 'ui://hoodfi/action-card.html' })).contents[0]
assert.equal(card.mimeType, 'text/html;profile=mcp-app')
ok('initialize has icons + resources; 11 tools, 7 with the HoodFi card; card is an MCP App')

const me = privateKeyToAccount(generatePrivateKey())
const friend = privateKeyToAccount(generatePrivateKey())
await anvil.setBalance({ address: me.address, value: 10n ** 18n })
const label = `pbx${Date.now().toString(36)}`

let r = await call('hoodfi_build_registration_tx', { name: label, address: me.address })
assert.ok(!r.isError, r.text)
assert.equal(r.data.steps[0].transaction.nonce, '0x0')
assert.equal(r.data.steps[0].transaction.chainId, '0x1237')
assert.equal(r.data.card.action, 'register')
await runSteps(me, r.data.steps)
ok(`register ${label}.hoodfi.eth: signed as given (nonce 0, chain 4663), relayed, mined`)

r = await call('hoodfi_build_set_text_tx', { name: label, address: me.address, records: { description: 'signed as given', 'com.twitter': 'hoodfiname' } })
assert.ok(!r.isError, r.text)
assert.equal(r.data.steps[0].transaction.nonce, '0x1')
await runSteps(me, r.data.steps)
r = await call('hoodfi_resolve_name', { name: label })
assert.equal(r.data.records?.description ?? JSON.parse(r.text).records.description, 'signed as given')
ok('set_text: two records in one transaction, nonce 1, mined; resolve reads them back')

r = await call('hoodfi_build_create_subnames_tx', { parent: label, address: me.address, subnames: [{ label: 'keep' }, { label: 'gift', recipient: friend.address }] })
assert.ok(!r.isError, r.text)
await runSteps(me, r.data.steps)
r = await call('hoodfi_build_transfer_tx', { name: `keep.${label}`, address: me.address, to: friend.address })
assert.ok(!r.isError, r.text)
ok('create_subnames: keep + gift (minted, pointed, transferred) in one transaction, mined; keep.<name> is ours to transfer')

r = await call('hoodfi_build_transfer_tx', { name: `gift.${label}`, address: me.address, to: friend.address })
assert.ok(r.isError && /owned by/.test(r.text), r.text)
ok('the gifted subname belongs to the recipient: a transfer from us is refused')

r = await call('hoodfi_build_transfer_tx', { name: label, address: me.address, to: friend.address })
assert.ok(!r.isError && r.data.warnings.some((w) => /irreversible/i.test(w)), r.text)
await runSteps(me, r.data.steps)
r = await call('hoodfi_build_set_text_tx', { name: label, address: me.address, records: { url: 'https://x.y' } })
assert.ok(r.isError && /owned by/.test(r.text))
ok('transfer: warned irreversible, mined; the old owner can no longer set records')

const stale = await signAsGiven(me, { chainId: '0x1237', to: env.L2_REGISTRY_ADDRESS, data: '0x', value: '0x0', nonce: '0x0', gas: '0x5208', maxFeePerGas: '0x3b9aca00', maxPriorityFeePerGas: '0x0' })
r = await call('hoodfi_send_transaction', { signed_transaction: stale })
assert.ok(r.isError && /stale/.test(r.text), r.text)
const stray = await signAsGiven(me, { chainId: '0x1237', to: friend.address, data: '0x', value: '0x1', nonce: '0x9', gas: '0x5208', maxFeePerGas: '0x3b9aca00', maxPriorityFeePerGas: '0x0' })
r = await call('hoodfi_send_transaction', { signed_transaction: stray })
assert.ok(r.isError && /only broadcasts/.test(r.text), r.text)
ok('relay: a used nonce is reported stale; a transfer to a stranger is refused')

console.log(`\nHoodFi PayBox fork OK (${label}.hoodfi.eth)`)
