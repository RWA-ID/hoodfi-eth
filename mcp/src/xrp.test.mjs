/**
 * Vectors for the XRP Ledger record rule in xrp.ts.
 *
 * The address vectors are ENSIP-9's own test table. The rest is the reason xrp.ts
 * exists: the library coder accepts XRPL *secrets*, because they share the address
 * encoding. Each of those is asserted against the bare coder first, so if a future
 * encoder starts refusing them itself the test says so instead of passing vacuously.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { decodeXrpAddress } from '@ensdomains/address-encoder/coders'
import { bytesToHex } from 'viem'

import { decodeXrpRecord, encodeXrpRecord } from './xrp.ts'

const R_ADDRESS = 'rf1BiGeXwwQoi8Z2ueFYTEXSwuJYfV2Jpn'
const X_ADDRESS = 'X7qvLs7gSnNoKvZzNWUT2e8st17QPY64PPe7zriLNuJszeg'

test('xrp encodes to the ENSIP-9 vectors, version byte included', () => {
  assert.equal(
    bytesToHex(decodeXrpRecord(R_ADDRESS)),
    '0x004b4e9c06f24296074f7bc48f92a97916c6dc5ea9'
  )
  assert.equal(
    bytesToHex(decodeXrpRecord(X_ADDRESS)),
    '0x05444b4e9c06f24296074f7bc48f92a97916c6dc5ea9000000000000000000'
  )
})

test('xrp: both forms survive a round trip', () => {
  for (const address of [R_ADDRESS, X_ADDRESS])
    assert.equal(encodeXrpRecord(decodeXrpRecord(address)), address)
})

test('xrp: secrets and testnet addresses are refused, though the coder takes them', () => {
  for (const notAnAddress of [
    'snoPBrXtMeMyMHUVTgbuqAfg1SUTb', // secp256k1 family seed
    'sEdTM1uX8pu2do5XvTnutH6HsouMaM2', // ed25519 seed
    'T7oKJ3q7s94kDH6tpkBowhetT1JKfcfdSCmAXbS75iATyLD', // testnet X-address
  ]) {
    assert.doesNotThrow(() => decodeXrpAddress(notAnAddress), notAnAddress)
    assert.throws(() => decodeXrpRecord(notAnAddress), notAnAddress)
  }
})

test('xrp: stored bytes of the wrong shape do not display as an address', () => {
  // A seed's bytes written by some other tool must not come back out as text.
  assert.throws(() => encodeXrpRecord(decodeXrpAddress('snoPBrXtMeMyMHUVTgbuqAfg1SUTb')))
})

test('verification: xrp catches a typo', () => {
  assert.throws(() => decodeXrpRecord(R_ADDRESS.slice(0, -1) + 'm'))
  assert.throws(() => decodeXrpRecord('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'))
})
