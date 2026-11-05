/**
 * Decoding the address records a name can carry.
 *
 * ENSIP-9 stores an address as its chain's own bytes, not the text people copy (Bitcoin
 * keeps its scriptPubKey, Solana its raw ed25519 key), so each record is re-derived
 * through a per-chain codec rather than echoed. Same codecs as mcp/src/coins.ts and
 * frontend/lib/ens.ts: `@ensdomains/address-encoder`.
 */

import { encodeBtcAddress, encodeSolAddress } from '@ensdomains/address-encoder/coders'
import { type Hex, getAddress, hexToBytes } from 'viem'

import { BTC_COIN_TYPE, ETH_COIN_TYPE, ROBINHOOD_COIN_TYPE, SOL_COIN_TYPE, XRP_COIN_TYPE } from './constants.js'
import { encodeXrpRecord } from './xrp.js'

/** Where a payment goes. `robinhood` and `ethereum` are separate records on purpose. */
export type SendChain = 'robinhood' | 'ethereum' | 'bitcoin' | 'solana' | 'xrp'

export type Verification = 'checksummed' | 'if-mixed-case' | 'length-only'

interface Chain {
  label: string
  symbol: string
  coinType: bigint
  /**
   * How much a well-formed record proves. Bitcoin and XRP carry a checksum. An EVM
   * record is checksummed when written in EIP-55 case, which this SDK always returns.
   * Solana has none: any 32 bytes is a valid-looking key, so a typo at write time is
   * undetectable at read time.
   */
  verification: Verification
  decode(stored: Hex): string | null
}

const ZERO = '0x0000000000000000000000000000000000000000'

function evm(stored: Hex): string | null {
  if (!stored || stored.length !== 42) return null
  const address = getAddress(stored)
  return address === ZERO ? null : address
}

function via(toText: (bytes: Uint8Array) => string) {
  return (stored: Hex): string | null => {
    if (!stored || stored === '0x') return null
    try {
      return toText(hexToBytes(stored))
    } catch {
      return null
    }
  }
}

// The library names directions from the address text's side: `encode…` turns stored
// bytes INTO text, which is the only direction a reader needs.
export const CHAINS: Record<SendChain, Chain> = {
  robinhood: { label: 'Robinhood Chain', symbol: 'ETH', coinType: ROBINHOOD_COIN_TYPE, verification: 'if-mixed-case', decode: evm },
  ethereum: { label: 'Ethereum', symbol: 'ETH', coinType: ETH_COIN_TYPE, verification: 'if-mixed-case', decode: evm },
  bitcoin: { label: 'Bitcoin', symbol: 'BTC', coinType: BTC_COIN_TYPE, verification: 'checksummed', decode: via(encodeBtcAddress) },
  solana: { label: 'Solana', symbol: 'SOL', coinType: SOL_COIN_TYPE, verification: 'length-only', decode: via(encodeSolAddress) },
  xrp: { label: 'XRP Ledger', symbol: 'XRP', coinType: XRP_COIN_TYPE, verification: 'checksummed', decode: via(encodeXrpRecord) },
}

export const SEND_CHAINS = Object.keys(CHAINS) as SendChain[]

/**
 * What to tell a user before they pay this address, or null when the record itself
 * proves it is well-formed. Relay it; don't report the address as "validated".
 */
export function paymentCaveat(chain: SendChain, address: string): string | null {
  if (chain === 'xrp' && address.startsWith('r'))
    return 'Classic XRP Ledger address (r…): it carries no destination tag. Fine for a personal wallet; an exchange deposit sent without its tag can be lost.'
  if (chain === 'solana')
    return 'Solana addresses carry no checksum, so a mistyped record looks exactly like a valid one. Confirm it with the recipient before a large payment.'
  return null
}
