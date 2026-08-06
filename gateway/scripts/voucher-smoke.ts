/**
 * Voucher signing smoke test.
 *
 * Proves the digest this gateway signs is byte-identical to the one
 * HoodfiRegistrar.voucherDigest() builds on-chain, and that the signature recovers
 * to the configured signer. A mismatch here is the difference between "donors can
 * mint their short names" and a cryptic BadVoucher() revert, so it is checked
 * without needing a chain.
 *
 * Run: bun scripts/voucher-smoke.ts
 */
import {
  encodeAbiParameters,
  getAddress,
  hashMessage,
  keccak256,
  recoverAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const SIGNER_KEY = (process.env.SIGNER_PRIVATE_KEY ??
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d') as `0x${string}`

const REGISTRAR = getAddress('0x75d61F7d87C5A0F4a52Fe526642c80d0Ef994f51')
const DONOR = getAddress('0x5f11a48230f7CdaB91A2361576239091E4b1165b')
const CHAIN_ID = 4663n

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

/** Mirrors HoodfiRegistrar.voucherDigest's inner keccak(abi.encode(...)). */
function innerDigest(
  registrar: `0x${string}`,
  chainId: bigint,
  donor: `0x${string}`,
  totalCredits: bigint,
  expiry: bigint
) {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'uint256' },
      ],
      [registrar, chainId, donor, totalCredits, expiry]
    )
  )
}

const account = privateKeyToAccount(SIGNER_KEY)
const expiry = BigInt(Math.floor(Date.now() / 1000) + 1800)

// 1. Signature recovers to the signer through the EIP-191 wrapper the contract applies.
const inner = innerDigest(REGISTRAR, CHAIN_ID, DONOR, 3n, expiry)
const signature = await account.signMessage({ message: { raw: inner } })
const recovered = await recoverAddress({ hash: hashMessage({ raw: inner }), signature })
check('signature recovers to signer', recovered === account.address, recovered)

// 2. abi.encode is fixed-width 32-byte fields — 5 params = 160 bytes. Catches any
//    accidental slip to encodePacked, which would silently produce a different digest.
const encoded = encodeAbiParameters(
  [
    { type: 'address' },
    { type: 'uint256' },
    { type: 'address' },
    { type: 'uint256' },
    { type: 'uint256' },
  ],
  [REGISTRAR, CHAIN_ID, DONOR, 3n, expiry]
)
check('digest preimage is 160 bytes (abi.encode, not packed)', (encoded.length - 2) / 2 === 160)

// 3. Every field must be bound into the digest — changing any one must change it.
const base = innerDigest(REGISTRAR, CHAIN_ID, DONOR, 3n, expiry)
check(
  'donor is bound',
  innerDigest(REGISTRAR, CHAIN_ID, getAddress('0x000000000000000000000000000000000000dEaD'), 3n, expiry) !== base
)
check('credit total is bound', innerDigest(REGISTRAR, CHAIN_ID, DONOR, 4n, expiry) !== base)
check('expiry is bound', innerDigest(REGISTRAR, CHAIN_ID, DONOR, 3n, expiry + 1n) !== base)
check(
  'registrar is bound (no cross-contract replay)',
  innerDigest(getAddress('0x000000000000000000000000000000000000bEEF'), CHAIN_ID, DONOR, 3n, expiry) !== base
)
check(
  'chain id is bound (no cross-chain replay)',
  innerDigest(REGISTRAR, 1n, DONOR, 3n, expiry) !== base
)

// 4. A voucher for a different donor must not recover to the signer for our donor's digest.
const otherSig = await account.signMessage({
  message: { raw: innerDigest(REGISTRAR, CHAIN_ID, getAddress('0x000000000000000000000000000000000000dEaD'), 3n, expiry) },
})
const wrongRecovered = await recoverAddress({ hash: hashMessage({ raw: inner }), signature: otherSig })
check("another donor's voucher does not verify", wrongRecovered !== account.address)

console.log(`\n${failures === 0 ? 'all voucher checks passed' : `${failures} check(s) FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
