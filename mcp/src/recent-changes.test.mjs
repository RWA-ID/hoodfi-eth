/**
 * hoodfi_prepare_send's "changed recently" warnings. Run with `npm test` from `mcp/`.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { recentChange } from './recent-changes.ts'

const ZERO = '0x0000000000000000000000000000000000000000'
const BUYER = '0x1111111111111111111111111111111111111111'
const SELLER = '0x3333333333333333333333333333333333333333'
const ROUTER = '0xb7Bd5F2c7C445ddC5D55ebD9b8f6A20C2E6e4b5D'
const MINT = `0x${'aa'.repeat(32)}`
const LATER = `0x${'bb'.repeat(32)}`
const ETH = 60n

const transfer = (from, to, transactionHash) => ({ transactionHash, args: { from, to } })
const addr = (coinType, transactionHash) => ({ transactionHash, args: { coinType } })

test('a mint on its own is no change', () => {
  assert.equal(recentChange([transfer(ZERO, BUYER, MINT)], [addr(ETH, MINT), addr(2147488311n, MINT)], ETH), null)
})

test('an address changed after a mint in the same window is still a change', () => {
  assert.equal(recentChange([transfer(ZERO, BUYER, MINT)], [addr(ETH, MINT), addr(ETH, LATER)], ETH), 'address-changed')
})

test('a partner-router sale mints to the router and hands over in one transaction', () => {
  const moved = [transfer(ZERO, ROUTER, MINT), transfer(ROUTER, BUYER, MINT)]
  assert.equal(recentChange(moved, [addr(ETH, MINT)], ETH), null)
})

test('a transfer in a later transaction is a change of hands', () => {
  assert.equal(recentChange([transfer(SELLER, BUYER, LATER)], [], ETH), 'changed-hands')
  assert.equal(recentChange([transfer(ZERO, SELLER, MINT), transfer(SELLER, BUYER, LATER)], [], ETH), 'changed-hands')
})

test('only the chain being paid counts', () => {
  assert.equal(recentChange([], [addr(2147488311n, LATER)], ETH), null)
  assert.equal(recentChange([], [addr(ETH, LATER)], ETH), 'address-changed')
})
