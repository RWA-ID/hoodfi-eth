/**
 * Prices as displayed.
 *
 * One place, because the same two figures appear in the stat bar, the pricing cards and
 * two FAQ answers — and the site already learned this lesson the expensive way, where a
 * tier grid advertised prices that no longer matched what the contract charged.
 *
 * These are the *headline* USD figures. What a wallet is actually asked for comes from
 * HoodfiSites on-chain, in wei or USDG units, and is owner-settable. During testing both
 * are set to zero on the contract while these still read $19.99 / $9.99 — so anything
 * quoting a price to a user at the point of payment must read the contract, never this
 * file.
 */
export const FIRST_USD = "$19.99";
export const REBUILD_USD = "$9.99";
