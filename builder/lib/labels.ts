/**
 * Prices as displayed.
 *
 * One place, because the same two figures appear in the stat bar, the pricing cards and
 * two FAQ answers — and the site already learned this lesson the expensive way, where a
 * tier grid advertised prices that no longer matched what the contract charged.
 *
 * These are the *headline* figures. What a wallet is actually asked for comes from
 * HoodfiSites on-chain, in wei or USDG units, and is owner-settable — `PublishPanel`
 * reads `quote()` and shows that, never these constants. Anything quoting a price at the
 * point of payment must do the same.
 *
 * `FIRST_USD` is "Free" because `firstPriceWei` and `firstPriceUsdg` are currently zero
 * on the contract while only the two republish prices are set — the switch is
 * `publishes[node] == 0`, so free means *per name*. That is a deliberate staging step,
 * NOT the final price: when the first publish is priced, this constant and the three
 * places that read it (the stat bar, the pricing card and the first FAQ answer, all in
 * `app/page.tsx`) have to move back to a dollar figure together. The card copy and the
 * FAQ question are written as prose about being free, so changing only this string would
 * leave the page contradicting itself.
 */
export const FIRST_USD = "Free";
export const REBUILD_USD = "$9.99";

/**
 * What a price can be paid in. Both currencies buy the same publish, at prices the
 * contract holds separately — so this is a statement about accepted payment, never a
 * conversion between the two.
 */
export const CURRENCIES = "ETH or USDG";
