/**
 * What happened to a name recently, judged per transaction rather than per window.
 *
 * A mint is a Transfer from zero, and the same transaction writes the name's address
 * (`HoodfiRegistrar._register`, `createSubnode`'s records). A sale through
 * HoodfiPartnerRouter, and a subname gifted by `hoodfi_build_create_subnames_tx`, also
 * hand the NFT over inside that transaction. None of that is the name changing hands
 * or its address changing; anything in a later transaction is, even when the name was
 * minted inside the same window.
 *
 * No imports but types, so `recent-changes.test.mjs` can load it with plain node.
 */

const ZERO = '0x0000000000000000000000000000000000000000'

type Log = { transactionHash: string | null }
export type TransferLog = Log & { args: { from?: string } }
export type AddressChangedLog = Log & { args: { coinType?: bigint } }

export type RecentChange = 'changed-hands' | 'address-changed' | null

export function recentChange(
  moved: readonly TransferLog[],
  changed: readonly AddressChangedLog[],
  coinType: bigint
): RecentChange {
  const mintTxs = new Set(
    moved.filter((l) => l.args.from?.toLowerCase() === ZERO).map((l) => l.transactionHash)
  )
  const afterMint = (l: Log) => l.transactionHash === null || !mintTxs.has(l.transactionHash)
  if (moved.some((l) => l.args.from?.toLowerCase() !== ZERO && afterMint(l))) return 'changed-hands'
  if (changed.some((l) => l.args.coinType === coinType && afterMint(l))) return 'address-changed'
  return null
}
