// Offline tests: a stub viem client stands in for Robinhood Chain, so these pin the
// SDK's decisions (what is an error, what is "not registered", no record fallback)
// without a network. `npm run test:live` checks the same calls against the real chain.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decodeFunctionData, encodeFunctionData, namehash } from 'viem'

import {
  CONTRACTS,
  HoodfiError,
  ROBINHOOD_COIN_TYPE,
  checkHoodfiName,
  checkLabel,
  createHoodfiClient,
  registrarAbi,
  tierOf,
} from '../dist/index.js'

const OWNER = '0x837Fa2d033f1F7275452D780a5E54Eda903C1330'
const OTHER = '0x2D037f66b9e0EDE90c2080558a7d3FF7BE36E9A1'
const ok = (result) => ({ status: 'success', result })
const fail = () => ({ status: 'failure', error: new Error('reverted') })

/** A stub publicClient. `answer(call)` returns a result entry for each multicall read. */
function stub({ answer, balance = 10n ** 18n, throws = false }) {
  const calls = []
  return {
    calls,
    client: {
      async multicall({ contracts, allowFailure }) {
        calls.push(contracts)
        if (throws) throw new Error('HTTP 429')
        const entries = contracts.map(answer)
        return allowFailure === false ? entries.map((e) => e.result) : entries
      },
      async getBalance() {
        return balance
      },
    },
  }
}

/** Registry answers for one minted name, keyed by coinType. */
function registry(records = {}) {
  return (c) => {
    if (c.functionName === 'ownerOf') return records.owner ? ok(records.owner) : fail()
    if (c.functionName === 'addr') return ok(records[c.args[1].toString()] ?? '0x')
    if (c.functionName === 'text') return ok(records[c.args[1]] ?? '')
    if (c.functionName === 'contenthash') return ok(records.contenthash ?? '0x')
    throw new Error(`unexpected ${c.functionName}`)
  }
}

test('labels: hyphens, case, length and tiers', () => {
  assert.deepEqual(checkLabel('GM.hoodfi.eth'), { ok: true, label: 'gm' })
  assert.equal(checkLabel('-gm').ok, false)
  assert.equal(checkLabel('a'.repeat(33)).ok, false)
  assert.equal(checkLabel('gm!').ok, false)
  assert.deepEqual([1, 2, 3, 4, 9].map((n) => tierOf('a'.repeat(n))), [0, 1, 2, 3, 3])
})

test('checkHoodfiName never rewrites another .eth name into a hoodfi one', () => {
  assert.equal(checkHoodfiName('vitalik.eth').ok, false)
  assert.equal(checkHoodfiName('jesse.base.eth').ok, false)
  assert.equal(checkHoodfiName('hoodfi.eth').ok, false)
  assert.deepEqual(checkHoodfiName('jack.gm.hoodfi.eth'), { ok: true, labels: ['jack', 'gm'], name: 'jack.gm.hoodfi.eth' })
  assert.deepEqual(checkHoodfiName('GM'), { ok: true, labels: ['gm'], name: 'gm.hoodfi.eth' })
})

test('the Robinhood coinType is the unsigned literal', () => {
  assert.equal(ROBINHOOD_COIN_TYPE, 2147488311n)
  assert.ok((0x80000000 | 4663) < 0, 'the JS bitwise form really is negative')
})

test('resolve: a never-minted name is null, not an error', async () => {
  const { client } = stub({ answer: registry({}) })
  assert.equal(await createHoodfiClient({ publicClient: client }).resolve('nobody'), null)
})

test('resolve: a batch where everything failed is UNREADABLE, never null', async () => {
  const { client } = stub({ answer: () => fail() })
  await assert.rejects(createHoodfiClient({ publicClient: client }).resolve('gm'), { code: 'UNREADABLE' })
})

test('resolve: a thrown transport error is UNREADABLE', async () => {
  const { client } = stub({ answer: () => ok('0x'), throws: true })
  await assert.rejects(createHoodfiClient({ publicClient: client }).resolve('gm'), { code: 'UNREADABLE' })
})

test('resolve: reads the right node in ONE multicall and decodes records', async () => {
  const s = stub({
    answer: registry({
      owner: OWNER,
      [ROBINHOOD_COIN_TYPE.toString()]: OWNER.toLowerCase(),
      60: OWNER.toLowerCase(),
      // bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq
      0: '0x0014e8df018c7e326cc253faac7e46cdc51e68542c42',
      avatar: 'ipfs://bafy',
      // ipfs dag-pb CID
      contenthash: '0xe30101701220e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    }),
  })
  const p = await createHoodfiClient({ publicClient: s.client }).resolve('GM.hoodfi.eth')
  assert.equal(s.calls.length, 1)
  assert.equal(s.calls[0][1].args[0], namehash('gm.hoodfi.eth'))
  assert.equal(p.owner, OWNER)
  assert.equal(p.addresses.robinhood, OWNER, 'EVM records come back EIP-55 checksummed')
  assert.equal(p.addresses.bitcoin, 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')
  assert.equal(p.addresses.solana, null)
  assert.deepEqual(p.records, { avatar: 'ipfs://bafy' })
  assert.equal(p.website.protocol, 'ipfs')
  assert.equal(p.website.url, 'https://gm.hoodfi.eth.link/')
})

test('getSendAddress: no fallback from an empty Robinhood record to the Ethereum one', async () => {
  const { client } = stub({ answer: registry({ owner: OWNER, 60: OWNER }) })
  const hoodfi = createHoodfiClient({ publicClient: client })
  await assert.rejects(hoodfi.getSendAddress('gm', 'robinhood'), (e) => {
    assert.ok(e instanceof HoodfiError)
    assert.equal(e.code, 'NO_RECORD')
    assert.match(e.message, /Ethereum address/)
    return true
  })
  assert.equal((await hoodfi.getSendAddress('gm', 'ethereum')).address, OWNER)
})

test('getSendAddress: disagreeing EVM records warn, and unregistered is NOT_REGISTERED', async () => {
  const { client } = stub({ answer: registry({ owner: OWNER, [ROBINHOOD_COIN_TYPE.toString()]: OWNER, 60: OTHER }) })
  const send = await createHoodfiClient({ publicClient: client }).getSendAddress('gm', 'robinhood')
  assert.equal(send.address, OWNER)
  assert.equal(send.warnings.length, 1)

  const empty = stub({ answer: registry({}) })
  await assert.rejects(createHoodfiClient({ publicClient: empty.client }).getSendAddress('gm', 'ethereum'), {
    code: 'NOT_REGISTERED',
  })
})

test('getSendAddress refuses a non-hoodfi .eth name before reading anything', async () => {
  const s = stub({ answer: registry({ owner: OWNER }) })
  await assert.rejects(createHoodfiClient({ publicClient: s.client }).getSendAddress('vitalik.eth', 'ethereum'), {
    code: 'INVALID_NAME',
  })
  assert.equal(s.calls.length, 0)
})

const registrarAnswer = ({ status = 0, paused = false, allowance = 0n, balance = 10n ** 9n } = {}) => (c) => {
  if (c.functionName === 'status') return ok(status)
  if (c.functionName === 'priceOf') return ok([1_000_000_000_000_000n, 3_000_000n])
  if (c.functionName === 'paused') return ok(paused)
  if (c.functionName === 'allowance') return ok(allowance)
  if (c.functionName === 'balanceOf') return ok(balance)
  throw new Error(`unexpected ${c.functionName}`)
}

test('checkName: available, taken and paused', async () => {
  const free = await createHoodfiClient({ publicClient: stub({ answer: registrarAnswer() }).client }).checkName('gmgm')
  assert.equal(free.available, true)
  assert.equal(free.price.usdg, 3_000_000n)
  assert.equal(free.reason, undefined)

  const taken = await createHoodfiClient({ publicClient: stub({ answer: registrarAnswer({ status: 1 }) }).client }).checkName('gm')
  assert.equal(taken.status, 'taken')
  assert.equal(taken.available, false)

  const paused = await createHoodfiClient({ publicClient: stub({ answer: registrarAnswer({ paused: true }) }).client }).checkName('gmgm')
  assert.equal(paused.available, false)
  assert.match(paused.reason, /paused/)
})

test('buildRegistration (ETH): one register step with a 1% refundable buffer', async () => {
  const { client } = stub({ answer: registrarAnswer() })
  const reg = await createHoodfiClient({ publicClient: client }).buildRegistration({ name: 'gmgm', account: OWNER.toLowerCase() })
  assert.equal(reg.steps.length, 1)
  const [step] = reg.steps
  assert.equal(step.to, CONTRACTS.registrar)
  assert.equal(step.value, 1_010_000_000_000_000n)
  assert.equal(step.chainId, 4663)
  assert.deepEqual(decodeFunctionData({ abi: registrarAbi, data: step.data }).args, ['gmgm'])
  assert.equal(reg.warnings.length, 0)
})

test('buildRegistration (USDG): approve only when the allowance is short', async () => {
  const short = await createHoodfiClient({ publicClient: stub({ answer: registrarAnswer() }).client }).buildRegistration({
    name: 'gmgm',
    account: OWNER,
    payWith: 'usdg',
  })
  assert.deepEqual(short.steps.map((s) => s.to), [CONTRACTS.usdg, CONTRACTS.registrar])
  assert.equal(
    short.steps[1].data,
    encodeFunctionData({ abi: registrarAbi, functionName: 'registerWithUsdc', args: ['gmgm'] })
  )

  const enough = await createHoodfiClient({
    publicClient: stub({ answer: registrarAnswer({ allowance: 10n ** 9n }) }).client,
  }).buildRegistration({ name: 'gmgm', account: OWNER, payWith: 'usdg' })
  assert.equal(enough.steps.length, 1)
})

test('buildRegistration refuses a taken name and warns on a short balance', async () => {
  await assert.rejects(
    createHoodfiClient({ publicClient: stub({ answer: registrarAnswer({ status: 1 }) }).client }).buildRegistration({
      name: 'gm',
      account: OWNER,
    }),
    { code: 'UNAVAILABLE' }
  )
  const poor = await createHoodfiClient({ publicClient: stub({ answer: registrarAnswer(), balance: 0n }).client }).buildRegistration({
    name: 'gmgm',
    account: OWNER,
  })
  assert.equal(poor.warnings.length, 1)
})

test('lookupAddress: a 502 is UNREADABLE, never an empty list', async () => {
  const hoodfi = createHoodfiClient({
    publicClient: stub({ answer: () => ok('0x') }).client,
    fetch: async () => new Response('{"message":"x"}', { status: 502 }),
  })
  await assert.rejects(hoodfi.lookupAddress(OWNER), { code: 'UNREADABLE' })
})

test('lookupAddress: hits /owner/{checksummed}/names on the configured API', async () => {
  let url
  const body = { address: OWNER, primary: null, primarySource: null, names: [] }
  const hoodfi = createHoodfiClient({
    publicClient: stub({ answer: () => ok('0x') }).client,
    apiUrl: 'https://example.test/',
    fetch: async (u) => {
      url = u
      return Response.json(body)
    },
  })
  assert.deepEqual(await hoodfi.lookupAddress(OWNER.toLowerCase()), body)
  assert.equal(url, `https://example.test/owner/${OWNER}/names`)
})
