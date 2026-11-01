// Send and buy, against an anvil fork of Robinhood Chain and the real OpenSea API. A
// throwaway wallet is handed a real NFT, sends it on, then buys a real live listing; a
// signing-only wallet signs AS GIVEN and hoodfi_send_transaction relays. Nothing reaches
// the live chain.
//
//   anvil --fork-url https://rpc.mainnet.chain.robinhood.com --chain-id 4663 --port 8547
//   node_modules/.bin/esbuild src/index.ts --bundle --platform=node --format=esm --outfile=$OUT/index.mjs
//   OPENSEA_API_KEY=… BUNDLE=$OUT/index.mjs node test/nft.fork.mjs
import assert from 'node:assert/strict'
import { createPublicClient, createTestClient, createWalletClient, http, parseAbi } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

const worker = (await import(process.env.BUNDLE)).default
const realFetch = globalThis.fetch
globalThis.fetch = async (u, o) => {
  const r = await realFetch(u, o)
  if (!r.ok && String(u).includes('opensea')) console.log(`  note OpenSea ${r.status} ${String(u).split('?')[0].slice(29)}`)
  return r
}
const FORK = 'http://127.0.0.1:8547'
const env = {
  ROBINHOOD_RPC_URL: FORK,
  OPENSEA_API_KEY: process.env.OPENSEA_API_KEY,
  REGISTRAR_ADDRESS: '0x56be5565acc823f4195c2cf3b9046C083633209a',
  L2_REGISTRY_ADDRESS: '0xf2bABA012244bdD7445129597350054E1B3aEe5C',
  USDG_ADDRESS: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
}
const PAYBOX = '0x8044D1135010220aDa8a0F1A1d387Dd910948575'
const chain = { id: 4663, name: 'rh', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [FORK] } } }
const transport = http(FORK)
const anvil = createTestClient({ mode: 'anvil', chain, transport })
const pub = createPublicClient({ chain, transport })
const erc721 = parseAbi(['function ownerOf(uint256) view returns (address)', 'function transferFrom(address,address,uint256)', 'function setApprovalForAll(address,bool)'])

const ctx = { waitUntil() {}, passThroughOnException() {} }
let id = 0
async function call(name, args) {
  const res = await worker.fetch(new Request('https://hoodfi-mcp.com/mcp', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args } }),
  }), env, ctx)
  const r = (await res.json()).result
  return { isError: r.isError, data: r.structuredContent, text: r.content[0].text }
}
const get = async (path) => {
  const res = await worker.fetch(new Request(`https://hoodfi-mcp.com${path}`), env, ctx)
  return { status: res.status, body: await res.json() }
}
const sign = (a, t) => a.signTransaction({ chainId: Number(t.chainId), type: 'eip1559', to: t.to, data: t.data, value: BigInt(t.value), nonce: Number(t.nonce), gas: BigInt(t.gas), maxFeePerGas: BigInt(t.maxFeePerGas), maxPriorityFeePerGas: BigInt(t.maxPriorityFeePerGas) })
const ok = (m) => console.log(`  ok   ${m}`)

// The index: real NFTs in the PayBox wallet.
const listed = await call('hoodfi_list_nfts', { address: PAYBOX })
assert.ok(!listed.isError, listed.text)
assert.ok(listed.data.nfts.length >= 4, `expected 4+ NFTs, got ${listed.data.nfts.length}`)
assert.ok(!/seadn|image_url|"image"|"description"|"name"|"collection"/.test(listed.text), 'no art or free text in what the model reads')
const panel = await get(`/nfts/${PAYBOX}`)
assert.equal(panel.status, 200)
assert.ok(panel.body.nfts.every((n) => n.image === null || new URL(n.image).hostname.endsWith('.seadn.io')))
ok(`list: ${listed.data.nfts.length} NFTs for the model (ids only), ${panel.body.nfts.filter((n) => n.image).length} with art for the iframe`)
const nameLeak = panel.body.nfts.filter((n) => n.name && !n.name.endsWith('.hoodfi.eth')).find((n) => listed.text.includes(n.name))
assert.equal(nameLeak, undefined, 'a token name reached the tool result')
ok('no non-hoodfi token name appears in the tool result')

// Send: a throwaway wallet receives a real ERC-721 from the PayBox wallet, then sends it.
const me = privateKeyToAccount(generatePrivateKey())
const friend = privateKeyToAccount(generatePrivateKey())
await anvil.setBalance({ address: me.address, value: 10n ** 18n })
await anvil.setBalance({ address: PAYBOX, value: 10n ** 18n })
const target = listed.data.nfts.find((n) => n.standard === 'erc721' && !n.hoodfi_name) ?? listed.data.nfts[0]
await anvil.impersonateAccount({ address: PAYBOX })
const hash = await createWalletClient({ chain, transport }).writeContract({ account: PAYBOX, address: target.contract, abi: erc721, functionName: 'transferFrom', args: [PAYBOX, me.address, BigInt(target.token_id)] })
await pub.waitForTransactionReceipt({ hash })

let r = await call('hoodfi_build_nft_transfer_tx', { address: friend.address, contract: target.contract, token_id: target.token_id, to: me.address })
assert.ok(r.isError && /held by/.test(r.text), r.text)
ok('build refuses a wallet that does not hold the token')
r = await call('hoodfi_build_nft_transfer_tx', { address: me.address, contract: target.contract, token_id: target.token_id, to: 'vitalik.eth' })
assert.ok(r.isError, r.text)
ok('build refuses a non-hoodfi .eth name')
r = await call('hoodfi_build_nft_transfer_tx', { address: me.address, contract: target.contract, token_id: target.token_id, to: 'founder', from_picker: true })
assert.ok(!r.isError, r.text)
assert.equal(r.data.to, PAYBOX)
assert.equal(r.data.card.handoff, true)
ok('founder resolves to the PayBox wallet via its Robinhood Chain record; picker card has no second button')
r = await call('hoodfi_build_nft_transfer_tx', { address: me.address, contract: target.contract, token_id: target.token_id, to: friend.address })
assert.ok(!r.isError, r.text)
let sent = await call('hoodfi_send_transaction', { signed_transaction: await sign(me, r.data.steps[0].transaction) })
assert.equal(sent.data?.status, 'success', sent.text)
assert.equal(sent.data.what, 'send NFT')
assert.equal((await pub.readContract({ address: target.contract, abi: erc721, functionName: 'ownerOf', args: [BigInt(target.token_id)] })).toLowerCase(), friend.address.toLowerCase())
ok(`send: ${target.contract} #${target.token_id} signed as given, relayed, and ownerOf is the recipient`)

// The relay still refuses what a drainer would want.
const approve = await me.signTransaction({ chainId: 4663, type: 'eip1559', to: target.contract, data: '0xa22cb4650000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000100', value: 0n, nonce: 9, gas: 100000n, maxFeePerGas: 10n ** 9n, maxPriorityFeePerGas: 0n })
sent = await call('hoodfi_send_transaction', { signed_transaction: approve })
assert.ok(sent.isError && /only broadcasts/.test(sent.text), sent.text)
ok('relay refuses setApprovalForAll')

// Buy: a real live listing, found through OpenSea.
const key = process.env.OPENSEA_API_KEY
const best = await (await fetch('https://api.opensea.io/api/v2/listings/collection/robinhood-lil-pengs/best?limit=20', { headers: { 'x-api-key': key } })).json()
const candidate = best.listings.find((l) => l.type === 'basic' && l.price.current.currency === 'ETH')
assert.ok(candidate, 'no basic ETH listing to test with')
const { contract, identifier } = candidate.asset ?? {}
const url = `https://opensea.io/item/robinhood/${contract}/${identifier}`
const look = await get(`/listing?url=${encodeURIComponent(url)}`)
assert.equal(look.status, 200, JSON.stringify(look.body))
assert.equal(look.body.listed, true, JSON.stringify(look.body))
ok(`lookup: ${look.body.collection} #${identifier} at ${look.body.priceEth} ETH, verified=${look.body.verified}`)
for (const bad of ['https://opensea.io/item/ethereum/0x1234567890123456789012345678901234567890/1', 'https://evil.example/item/robinhood/0x1234567890123456789012345678901234567890/1']) {
  const res = await get(`/listing?url=${encodeURIComponent(bad)}`)
  assert.equal(res.status, 502)
}
ok('lookup refuses another chain and another host')

const base = { address: me.address, contract: look.body.contract, token_id: look.body.tokenId, order_hash: look.body.orderHash }
r = await call('hoodfi_build_nft_purchase_tx', { ...base, max_price_wei: (BigInt(look.body.priceWei) - 1n).toString() })
assert.ok(r.isError && /above/.test(r.text), r.text)
ok('build refuses a price above what was confirmed')
r = await call('hoodfi_build_nft_purchase_tx', { ...base, token_id: (BigInt(look.body.tokenId) + 1n).toString(), max_price_wei: look.body.priceWei })
assert.ok(r.isError && /different NFT/.test(r.text), r.text)
ok('build refuses an order for a different token')
r = await call('hoodfi_build_nft_purchase_tx', { ...base, max_price_wei: look.body.priceWei, from_panel: true })
assert.ok(!r.isError, r.text)
const tx = r.data.steps[0].transaction
assert.equal(BigInt(tx.value), BigInt(look.body.priceWei))
sent = await call('hoodfi_send_transaction', { signed_transaction: await sign(me, tx) })
assert.equal(sent.data?.status, 'success', sent.text)
assert.equal(sent.data.what, 'buy NFT')
assert.equal((await pub.readContract({ address: look.body.contract, abi: erc721, functionName: 'ownerOf', args: [BigInt(look.body.tokenId)] })).toLowerCase(), me.address.toLowerCase())
ok(`buy: real listing filled on the fork, signed as given, ownerOf is the buyer, paid ${look.body.priceEth} ETH`)
console.log('\nHoodFi NFT fork OK')
