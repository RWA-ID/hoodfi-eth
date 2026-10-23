// hoodfi_prepare_send against live Robinhood Chain, through the Worker as bundled for Node.
// Read-only: it prepares PayBox request_transfer arguments and never sends anything.
//
//   node_modules/.bin/esbuild src/index.ts --bundle --platform=node --format=esm --outfile=/tmp/hoodfi-node/index.mjs
//   BUNDLE=/tmp/hoodfi-node/index.mjs node test/send.live.mjs
import assert from 'node:assert/strict'

const worker = (await import(process.env.BUNDLE)).default
const env = {
  REGISTRAR_ADDRESS: '0x56be5565acc823f4195c2cf3b9046C083633209a',
  L2_REGISTRY_ADDRESS: '0xf2bABA012244bdD7445129597350054E1B3aEe5C',
  USDG_ADDRESS: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
}
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

const { tools } = await rpc('tools/list', {})
const send = tools.find((t) => t.name === 'hoodfi_prepare_send')
assert.ok(send, 'hoodfi_prepare_send is listed')
assert.equal(send._meta?.ui?.resourceUri, 'ui://hoodfi/action-card.html')
ok(`listed with the card (${tools.length} tools)`)

const resolved = (await call('hoodfi_resolve_name', { name: 'founder' })).data
const eth = await call('hoodfi_prepare_send', { name: 'founder', chain: 'ethereum', amount: '0.01' })
assert.ok(!eth.isError, eth.text)
assert.deepEqual(eth.data.paybox_request_transfer, { chain: 'eip155:1', to: resolved.addresses.mainnet, amount: '10000000000000000', token: null })
assert.equal(eth.data.card.action, 'send')
ok(`ETH on mainnet to founder.hoodfi.eth → ${eth.data.address}, in wei, same address hoodfi_resolve_name reports`)

const rh = await call('hoodfi_prepare_send', { name: 'founder.hoodfi.eth', chain: 'robinhood', amount: '0.5' })
assert.ok(!rh.isError, rh.text)
assert.equal(rh.data.paybox_request_transfer.chain, 'eip155:4663')
assert.equal(rh.data.paybox_request_transfer.to, resolved.addresses.robinhoodChain)
ok('ETH on Robinhood Chain uses its own coinType record')

if (resolved.addresses.solana) {
  const sol = await call('hoodfi_prepare_send', { name: 'founder', chain: 'solana', amount: '1.5' })
  assert.ok(!sol.isError && sol.data.paybox_request_transfer.amount === '1500000000', sol.text)
  ok('SOL in lamports')
} else {
  const sol = await call('hoodfi_prepare_send', { name: 'founder', chain: 'solana', amount: '1' })
  assert.ok(sol.isError && /no Solana address/.test(sol.text), sol.text)
  ok('no Solana record: refused, never falls back to the ETH address')
}

const btc = await call('hoodfi_prepare_send', { name: 'founder', chain: 'bitcoin', amount: '0.001' })
assert.ok(resolved.addresses.bitcoin ? !btc.isError && btc.data.sendable_with_paybox === false && btc.data.paybox_request_transfer === null : btc.isError, btc.text)
ok(resolved.addresses.bitcoin ? 'BTC: looked up, not sendable with PayBox' : 'no Bitcoin record: refused')

const unminted = await call('hoodfi_prepare_send', { name: `zq${Date.now().toString(36)}x`, chain: 'ethereum', amount: '0.01' })
assert.ok(unminted.isError && /not been minted/.test(unminted.text), unminted.text)
ok('an unminted name is refused')

const fine = await call('hoodfi_prepare_send', { name: 'founder', chain: 'solana', amount: '0.0000000001' })
assert.ok(fine.isError, fine.text)
const badChain = await call('hoodfi_prepare_send', { name: 'founder', chain: 'base', amount: '1' })
assert.ok(badChain.isError, badChain.text)
ok('too many decimals and an unknown chain are refused')

const self = await call('hoodfi_prepare_send', { name: 'founder', chain: 'ethereum', amount: '0.01', from: resolved.addresses.mainnet.toLowerCase() })
assert.ok(/yourself/.test(self.data.warnings[0] ?? ''), JSON.stringify(self.data.warnings))
ok('a send to yourself is warned')

console.log('\nall good')
