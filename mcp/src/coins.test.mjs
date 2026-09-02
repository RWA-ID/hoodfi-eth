/**
 * Vectors for the address codecs in coins.ts.
 *
 * Run with `npm test` from `mcp/`. Unlike `shared/contenthash.test.mjs`, this one needs
 * `node_modules` — the codecs are a package here rather than hand-rolled, and that is
 * the point: see the header of coins.ts for why this one is allowed a dependency.
 *
 * What is actually being pinned:
 *
 * 1. The bytes. A contenthash off by one byte resolves to nothing and the owner can
 *    tell. An address record off by one byte resolves to *someone*, and nobody can
 *    tell until funds are gone. So the two Bitcoin script forms are checked against
 *    published vectors rather than against themselves.
 *
 * 2. **How much a successful decode proves**, which differs per chain and is the thing
 *    the tool description promises. If a future version of the encoder starts or stops
 *    rejecting typos, the `verification` field in coins.ts is wrong and the tool is
 *    telling agents something untrue about a payment address. That is what the third
 *    block below is for.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  decodeBtcAddress,
  decodeSolAddress,
  encodeBtcAddress,
  encodeSolAddress,
} from '@ensdomains/address-encoder/coders'
import { bytesToHex, isAddress } from 'viem'

const hex = (address) => bytesToHex(decodeBtcAddress(address))

test('bitcoin encodes to the scriptPubKey, not the address text', () => {
  // Genesis coinbase address. P2PKH: OP_DUP OP_HASH160 <20> OP_EQUALVERIFY OP_CHECKSIG
  assert.equal(
    hex('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'),
    '0x76a91462e907b15cbf27d5425399ebf6f0fb50ebb88f1888ac'
  )
  // P2SH: OP_HASH160 <20> OP_EQUAL. hash160 confirmed by base58check decode.
  assert.equal(
    hex('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy'),
    '0xa914b472a266d0bd89c13706a4132ccfb16f7c3b9fcb87'
  )
  // BIP-173 vector. P2WPKH: OP_0 <20>
  assert.equal(
    hex('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'),
    '0x0014751e76e8199196d454941c45d1b3a323f1433bd6'
  )
})

test('every accepted address survives a round trip', () => {
  for (const address of [
    '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',
    'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    // Taproot, so a name minted today still resolves for a v1 witness holder.
    'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0',
  ])
    assert.equal(encodeBtcAddress(decodeBtcAddress(address)), address)

  for (const address of [
    '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    // 43 characters rather than 44 — a leading zero byte, and still valid. Length in
    // characters is not the check; length in bytes is.
    'So11111111111111111111111111111111111111112',
  ])
    assert.equal(encodeSolAddress(decodeSolAddress(address)), address)

  assert.equal(
    decodeSolAddress('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM').length,
    32
  )
})

test('the wrong chain’s address is refused everywhere', () => {
  const ethereum = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
  assert.throws(() => decodeBtcAddress(ethereum))
  assert.throws(() => decodeSolAddress(ethereum))
  assert.throws(() => decodeBtcAddress('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'))
})

/**
 * The claims the tool description makes to agents about a payment address. Each is a
 * property of the chain's format, not of this code, and each is asserted in the
 * direction that would be dangerous if it changed.
 */
test('verification: bitcoin catches a typo', () => {
  const address = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
  assert.throws(
    () => decodeBtcAddress(address.slice(0, 20) + 'X' + address.slice(21)),
    'base58check must reject a mutated character'
  )
  assert.throws(() =>
    decodeBtcAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5')
  )
})

test('verification: ethereum catches a typo only when EIP-55 capitalised', () => {
  const checksummed = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
  assert.equal(isAddress(checksummed), true)
  // Flipping the case of the final character breaks the EIP-55 checksum.
  assert.equal(isAddress(checksummed.slice(0, -1) + 'D'), false)
  // All-lowercase carries no checksum, so a mutated character is indistinguishable
  // from a real address. This is why coins.ts marks ethereum `if-mixed-case`.
  const lowercase = checksummed.toLowerCase()
  assert.equal(isAddress(lowercase), true)
  assert.equal(isAddress(lowercase.slice(0, -1) + '0'), true)
})

test('verification: solana catches nothing but the length', () => {
  const address = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
  // A one-character typo is a different, perfectly valid address. Nothing in the
  // format can detect it — this is the caveat the tool must relay, not a bug to fix.
  const typo = address.slice(0, 20) + 'X' + address.slice(21)
  assert.notEqual(typo, address)
  assert.equal(decodeSolAddress(typo).length, 32)
  assert.equal(encodeSolAddress(decodeSolAddress(typo)), typo)
  // Only a wrong byte length is rejected.
  assert.throws(() => decodeSolAddress(address.slice(0, 42)))
  assert.throws(() => decodeSolAddress(address + 'x'))
})

test('the Robinhood coinType is computed in BigInt', () => {
  assert.equal(0x80000000n | 4663n, 2147488311n)
  // The trap this guards: JS bitwise operators coerce to signed 32-bit.
  assert.equal(0x80000000 | 4663, -2147478985)
})
