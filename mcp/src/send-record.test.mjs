/**
 * Which record hoodfi_prepare_send pays. Run with `npm test` from `mcp/`.
 *
 * The first two cases come from blockhash-xyz/mancer-sdk#2: the two EVM records holding
 * different addresses, and an empty Robinhood record next to a set coin-60 one. The
 * second must refuse, not fall back: see the header of send-record.ts.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getAddress } from 'viem'

import { pickRecord } from './send-record.ts'

const ZERO = '0x0000000000000000000000000000000000000000'
const A = getAddress('0x1111111111111111111111111111111111111111')
const B = getAddress('0x2222222222222222222222222222222222222222')
// Same decode as COINS.ethereum in coins.ts: exactly 20 bytes, checksummed.
const decode = (s) => (s && s.length === 42 ? getAddress(s) : null)

const robinhood = (stored, mainnet) => ({
  name: 'crypto.hoodfi.eth',
  chainLabel: 'Robinhood Chain',
  symbol: 'ETH',
  recordLabel: 'Ethereum',
  stored,
  decode,
  sibling: { chainLabel: 'Ethereum mainnet', stored: mainnet, decode },
})

test('records that disagree: pays the Robinhood one and warns with both', () => {
  const r = pickRecord(robinhood(A.toLowerCase(), B.toLowerCase()))
  assert.equal(r.ok, true)
  assert.equal(r.address, A)
  assert.equal(r.warnings.length, 1)
  assert.match(r.warnings[0], /disagree/)
  assert.ok(r.warnings[0].includes(A) && r.warnings[0].includes(B))
})

test('empty Robinhood record, coin 60 set: refuses, never falls back', () => {
  for (const empty of ['0x', null, undefined, ZERO]) {
    const r = pickRecord(robinhood(empty, A))
    assert.equal(r.ok, false, `stored = ${empty}`)
    assert.match(r.error, /no Robinhood Chain address/)
    assert.match(r.error, /Don't send it to any of its other addresses/)
    assert.match(r.error, /does have an address for Ethereum mainnet/)
    assert.ok(!r.error.includes(A), 'the refusal must not hand out the mainnet address')
  }
})

test('matching records: pays it, no warning', () => {
  const r = pickRecord(robinhood(A, A))
  assert.deepEqual(r, { ok: true, address: A, warnings: [] })
})

test('casing does not make equal records disagree', () => {
  const r = pickRecord(robinhood(A.toLowerCase(), A.toUpperCase().replace('0X', '0x')))
  assert.deepEqual(r.warnings, [])
})

test('a record that is not 20 bytes is refused, not truncated', () => {
  for (const bad of [`0x${'11'.repeat(19)}`, `0x${'11'.repeat(21)}`, `0x${'11'.repeat(32)}`]) {
    const r = pickRecord(robinhood(bad, A))
    assert.equal(r.ok, false)
    assert.match(r.error, /isn't a valid ETH address/)
  }
})

test('both empty: refuses without claiming another address exists', () => {
  const r = pickRecord(robinhood('0x', '0x'))
  assert.equal(r.ok, false)
  assert.doesNotMatch(r.error, /does have an address/)
})

test('a zero coin-60 record is not "another address", nor a disagreement', () => {
  assert.doesNotMatch(pickRecord(robinhood('0x', ZERO)).error, /does have an address/)
  assert.deepEqual(pickRecord(robinhood(A, ZERO)).warnings, [])
})

test('a mainnet send reads coin 60 and mirrors the Robinhood one', () => {
  const r = pickRecord({
    ...robinhood(B, A),
    chainLabel: 'Ethereum mainnet',
    sibling: { chainLabel: 'Robinhood Chain', stored: A, decode },
  })
  assert.equal(r.address, B)
  assert.match(r.warnings[0], /Ethereum mainnet → .*Robinhood Chain → /)
})

test('a non-EVM chain has no sibling', () => {
  const r = pickRecord({ name: 'x.hoodfi.eth', chainLabel: 'Solana', symbol: 'SOL', recordLabel: 'Solana', stored: '0x01', decode: () => 'SoLaddr' })
  assert.deepEqual(r, { ok: true, address: 'SoLaddr', warnings: [] })
})
