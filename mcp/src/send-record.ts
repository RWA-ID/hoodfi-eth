/**
 * Which address record a send pays, and when it refuses. Pure, so send-record.test.mjs
 * can pin it without a chain.
 *
 * The rule: a send on chain X reads chain X's own record and nothing else. On Robinhood
 * Chain that is ENSIP-11 coinType 2147488311 (0x80000000 | 4663), never the
 * single-argument `addr(node)`, which returns coinType 60 even on Robinhood Chain.
 *
 * There is deliberately no fallback from an empty Robinhood record to coinType 60 (or
 * to ENSIP-11's default EVM record): the mainnet address can be a contract wallet such
 * as a Safe that does not exist on Robinhood Chain, and ETH sent to it there is gone.
 * The registrar writes both records at mint and /manage writes them together, so an
 * empty one only happens when someone wrote to the registry directly. That is exactly
 * when the recipient should be asked.
 */

type Hex0 = `0x${string}`

const ZERO = '0x0000000000000000000000000000000000000000'

export type RecordPick =
  | { ok: true; address: string; warnings: string[] }
  | { ok: false; error: string }

export type PickInput = {
  name: string
  /** Where the send goes, e.g. "Robinhood Chain". */
  chainLabel: string
  /** The coin being sent, e.g. "ETH". */
  symbol: string
  /** The record's name, e.g. "Ethereum". */
  recordLabel: string
  /** The raw record for this chain, as `addr(node, coinType)` returned it. */
  stored: Hex0 | null | undefined
  decode: (stored: Hex0) => string | null
  /** The other EVM chain's record, read alongside to catch the two disagreeing. */
  sibling?: { chainLabel: string; stored: Hex0 | null | undefined; decode: (stored: Hex0) => string | null }
}

const present = (v: Hex0 | null | undefined): v is Hex0 => !!v && v !== '0x'

export function pickRecord(input: PickInput): RecordPick {
  const { name, chainLabel, symbol, recordLabel, stored, decode, sibling } = input

  const address = present(stored) ? decode(stored) : null
  if (present(stored) && !address)
    return { ok: false, error: `${name}'s ${recordLabel} record isn't a valid ${symbol} address, so it can't be paid on ${chainLabel}.` }

  const otherRaw = sibling && present(sibling.stored) ? sibling.decode(sibling.stored) : null
  const other = otherRaw && otherRaw !== ZERO ? otherRaw : null

  if (!address || address === ZERO)
    return {
      ok: false,
      error:
        `${name} has no ${chainLabel} address set, so it can't be paid there. Don't send it to any of its other addresses instead.` +
        (other ? ` It does have an address for ${sibling!.chainLabel}; the owner should set both.` : ''),
    }

  const warnings: string[] = []
  if (other && other !== address)
    warnings.push(
      `${name}'s two ETH records disagree: ${chainLabel} → ${address}, ${sibling!.chainLabel} → ${other}. This send uses the ${chainLabel} one; confirm it with the recipient.`
    )
  return { ok: true, address, warnings }
}
