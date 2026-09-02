/**
 * The address records a name can carry, and the encodings they are stored in.
 *
 * ENSIP-9 stores an address as the bytes its own chain uses, not as the text people
 * copy: Bitcoin keeps its scriptPubKey, Solana its raw ed25519 public key. So a record
 * cannot be written from a string without a per-chain codec, and a record read back is
 * *re-derived* rather than echoed — which is also what makes a malformed address
 * impossible to store here.
 *
 * ## Why this imports a library rather than living in `frontend/shared/`
 *
 * `shared/contenthash.ts` is hand-rolled and dependency-free on purpose, and its header
 * explains why: whoever bundles a shared file resolves `node_modules` by walking up from
 * that file, which would tie this worker to whatever the site happens to have installed.
 * That rule is what keeps the codec out of `shared/` — base58check and bech32m are not
 * something to hand-roll twice, and the version of them worth trusting is a package.
 *
 * The hazard `shared/` exists to prevent is two *implementations* of a byte format. That
 * is not the situation here: the site (`frontend/lib/ens.ts`) and this worker both call
 * `@ensdomains/address-encoder`, so the format has one definition and each package
 * depends on it explicitly. What is duplicated is policy — which coins, and the rule
 * below about Ethereum writing two records — and that is deliberately small enough to
 * read side by side.
 */

import {
  decodeBtcAddress,
  decodeSolAddress,
  encodeBtcAddress,
  encodeSolAddress,
} from '@ensdomains/address-encoder/coders'
import {
  type Hex,
  bytesToHex,
  getAddress,
  hexToBytes,
  isAddress,
} from 'viem'

import { ETH_COIN_TYPE, ROBINHOOD_COIN_TYPE } from './chain'

/** SLIP-44 coinType for Bitcoin. */
export const BTC_COIN_TYPE = 0n
/** SLIP-44 coinType for Solana. */
export const SOL_COIN_TYPE = 501n

export type CoinKey = 'ethereum' | 'bitcoin' | 'solana'

interface Coin {
  key: CoinKey
  label: string
  /**
   * Every coinType this one record writes to, in the order they are written.
   *
   * Only Ethereum has more than one, and it is the trap this whole module exists to
   * make impossible to fall into — see COINS below.
   */
  coinTypes: bigint[]
  /** Whether the owner is allowed to empty it. */
  clearable: boolean
  /** What a valid value looks like, for the sentence a bad one gets back. */
  hint: string
  /**
   * How much a successful `encode` actually proves — verified against the coders in
   * `coins.test.mjs`, because the three chains differ and the difference matters.
   *
   * `checksummed`   a mistyped character is rejected. Bitcoin: base58check and bech32
   *                 both carry a mandatory checksum.
   * `if-mixed-case` rejected only when the input carries EIP-55 case information. An
   *                 all-lowercase Ethereum address has no checksum to verify, so a
   *                 typo in one is accepted.
   * `length-only`   nothing is verified but the length. A Solana address is a bare
   *                 ed25519 public key with no checksum of any kind, so any 32 bytes
   *                 of base58 is a well-formed address — a one-character typo yields a
   *                 different, entirely valid-looking key.
   */
  verification: 'checksummed' | 'if-mixed-case' | 'length-only'
  /** Address text -> stored bytes. null when the text is not valid for this chain. */
  encode(value: string): Hex | null
  /** Stored bytes -> address text. null when unset or undecodable. */
  decode(stored: Hex): string | null
}

/** Wraps a coder pair so a throw from either side reads as "not a valid address". */
function coder(
  toBytes: (value: string) => Uint8Array,
  toText: (bytes: Uint8Array) => string
): Pick<Coin, 'encode' | 'decode'> {
  return {
    encode(value) {
      try {
        return bytesToHex(toBytes(value.trim()))
      } catch {
        return null
      }
    },
    decode(stored) {
      if (!stored || stored === '0x') return null
      try {
        return toText(hexToBytes(stored))
      } catch {
        return null
      }
    },
  }
}

export const COINS: Record<CoinKey, Coin> = {
  /**
   * One address, two records — and getting this wrong is silent.
   *
   * A name's EVM address is written to both the Robinhood Chain coinType and mainnet
   * ETH (60), because they answer different questions: coinType 60 is what mainnet ENS
   * clients read, and the chain-specific record is what resolution on Robinhood Chain
   * itself keys on. `HoodfiRegistrar._register` sets both at mint for exactly this
   * reason, and `/manage` keeps them in step.
   *
   * Writing only 60 would leave the name resolving on mainnet while quietly going dead
   * on its own chain — no revert, no error, just a record that disagrees with itself.
   * So this is a list, and the caller never chooses a coinType.
   */
  ethereum: {
    key: 'ethereum',
    label: 'Ethereum',
    coinTypes: [ROBINHOOD_COIN_TYPE, ETH_COIN_TYPE],
    // The name would stop resolving anywhere, which is never what an agent means to
    // ask for. `/manage` refuses it too.
    clearable: false,
    hint: 'a 0x-prefixed 20-byte address',
    verification: 'if-mixed-case',
    encode: (value) => {
      const trimmed = value.trim()
      // Checksum rather than store as typed: every read and comparison downstream
      // then agrees regardless of the casing it arrived in.
      return isAddress(trimmed) ? getAddress(trimmed) : null
    },
    decode: (stored) =>
      stored && stored.length === 42 ? getAddress(stored) : null,
  },
  bitcoin: {
    key: 'bitcoin',
    label: 'Bitcoin',
    coinTypes: [BTC_COIN_TYPE],
    clearable: true,
    hint: 'a legacy (1…), P2SH (3…) or bech32 (bc1…) address',
    verification: 'checksummed',
    ...coder(decodeBtcAddress, encodeBtcAddress),
  },
  solana: {
    key: 'solana',
    label: 'Solana',
    coinTypes: [SOL_COIN_TYPE],
    clearable: true,
    hint: 'a base58 ed25519 address',
    verification: 'length-only',
    ...coder(decodeSolAddress, encodeSolAddress),
  },
}

/**
 * The sentence to hand back when a record was accepted on weaker evidence than the
 * caller probably assumes — null when passing the codec really did prove the address
 * is well-formed.
 *
 * Worth saying out loud rather than leaving implicit: an agent that got calldata back
 * without complaint will reasonably report "the address was validated". For Solana
 * that is close to meaningless, and this is a payment record. Better the agent relays
 * the caveat than a user discovers it by sending funds.
 */
export function verificationCaveat(coin: Coin, value: string): string | null {
  if (coin.verification === 'checksummed') return null
  if (coin.verification === 'length-only')
    return `The ${coin.label} address was checked for length and base58 only. ${coin.label} addresses carry no checksum, so a mistyped character produces a different address that is equally well-formed and cannot be detected here. Confirm it against the source before signing.`
  // if-mixed-case
  return value === value.toLowerCase() || value === value.toUpperCase()
    ? `The ${coin.label} address was given without EIP-55 capitalisation, so it has no checksum to verify and only its length was checked. A mixed-case address would have been checked properly. Confirm it against the source before signing.`
    : null
}

export const COIN_KEYS = Object.keys(COINS) as CoinKey[]
