/**
 * Canonical origin for absolute URLs (OG images, canonical tags).
 *
 * The site ships to two places: IPFS behind hoodfi.eth.limo, and a conventional host.
 * Crawlers and X's card fetcher need absolute image URLs, so whichever origin a build
 * is destined for has to be baked in — a card that points at the other host either
 * 404s or splits the canonical signal. Set NEXT_PUBLIC_SITE_URL per deployment.
 */
export const SITE = {
  name: "HoodFi.eth",
  description:
    "Lifetime names on Robinhood Chain. Mint yours in one transaction from $3 — no renewals, ever. Donate a year to hoodfi.eth's expiry to unlock a premium 1–3 character name.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://hoodfi.eth.limo").replace(/\/$/, ""),
};

/**
 * Where `rel=canonical` points, on every deployment.
 *
 * Both origins serve identical content, so without a single canonical they compete as
 * duplicates and split whatever search signal the site earns. This deliberately does
 * NOT follow SITE.url: og:image has to be same-origin to be fetchable, but the
 * canonical should be the one address we want indexed.
 */
export const CANONICAL_URL = (
  process.env.NEXT_PUBLIC_CANONICAL_URL ?? SITE.url
).replace(/\/$/, "");

/** Years of expiry that unlock public minting of 1–3 character names. */
export const GOAL_YEARS = 100;

/** hoodfi.eth's expiry at launch was 2027-07-08; the goal carries it a century past. */
export const START_YEAR = 2026;
export const GOAL_YEAR_LABEL = 2127;

/** Gateway route that signs short-name credit vouchers. */
export const VOUCHER_URL =
  process.env.NEXT_PUBLIC_VOUCHER_URL ??
  "https://hoodfi-gateway.dmpay.workers.dev/voucher";
