/**
 * The two shapes ENSIP-9 stores for the XRP Ledger, and nothing else.
 *
 * The library's coder is base58check over the XRP alphabet and checks the checksum but
 * not the payload, and the XRPL uses that same encoding for its *secrets*: a family
 * seed (`s…`, version 0x21) and an ed25519 seed (`sEd…`) decode just as cleanly as an
 * address. Without this, someone pasting the wrong line from their wallet export would
 * publish their seed in a public record. Testnet X-addresses (`T…`) are refused too —
 * a payment record that resolves to a testnet account loses whatever is sent to it.
 *
 * - r-address: version 0x00 + 20-byte account ID = 21 bytes.
 * - X-address (mainnet): 0x05 0x44 + account ID + tag flag (0/1) + 4-byte tag + 4
 *   reserved zero bytes = 31 bytes. It carries the destination tag inside it.
 *
 * Its own module, with no imports of ours, so `xrp.test.mjs` can load it directly.
 * `frontend/lib/ens.ts` applies the same rule — see the header of coins.ts for why the
 * policy is duplicated rather than shared.
 */

import {
  decodeXrpAddress,
  encodeXrpAddress,
} from '@ensdomains/address-encoder/coders'

export function isXrpRecord(bytes: Uint8Array): boolean {
  if (bytes.length === 21) return bytes[0] === 0x00
  if (bytes.length !== 31 || bytes[0] !== 0x05 || bytes[1] !== 0x44) return false
  const flag = bytes[22]
  if (flag !== 0 && flag !== 1) return false
  return bytes.slice(27).every((b) => b === 0)
}

/** Address text -> stored bytes. Throws on anything but a mainnet r- or X-address. */
export function decodeXrpRecord(value: string): Uint8Array {
  const bytes = decodeXrpAddress(value)
  if (!isXrpRecord(bytes)) throw new Error('not an XRP Ledger address')
  return bytes
}

/** Stored bytes -> address text. Throws on bytes that are not one of the two shapes. */
export function encodeXrpRecord(bytes: Uint8Array): string {
  if (!isXrpRecord(bytes)) throw new Error('not an XRP Ledger address')
  return encodeXrpAddress(bytes)
}
