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

/**
 * Share link for a single name.
 *
 * Deliberately built from CANONICAL_URL, not SITE.url. This export ships to IPFS too,
 * and a share pointing at hoodfi.eth.limo asks X's crawler to fetch through an IPFS
 * gateway inside its own short timeout — which is how a share ends up with no card at
 * all. It also has to be /n/, not /search/?q=: a static export serves byte-identical
 * HTML for every query string, so only a route that renders per name can describe it.
 */
export function nameShareUrl(label: string): string {
  // Bare `/<label>` — the shape the profile card advertises, and the one worth putting
  // on a name service. A vercel.json rewrite maps it to the gateway's share page, and
  // `/n/<label>` still resolves so links shared before this keep working.
  //
  // Trailing slash is load-bearing: `trailingSlash: true` 308s the slashless form, and
  // a redirect hop is one more thing a crawler can time out on.
  return `${CANONICAL_URL}/${encodeURIComponent(label)}/`;
}

/**
 * Gateway route that pins an uploaded avatar image.
 *
 * Server-side because the pinning credential can't be published: anything the browser
 * can send, anyone reading the bundle can send too. The worker holds the JWT and only
 * accepts an upload signed by the name's owner.
 */
export const AVATAR_UPLOAD_URL =
  process.env.NEXT_PUBLIC_AVATAR_UPLOAD_URL ??
  "https://hoodfi-gateway.dmpay.workers.dev/avatar";

/**
 * Gateway route the partner form posts to.
 *
 * Absolute, not a relative `/partner` path, for the same reason the avatar upload is:
 * `vercel.json` can rewrite a path on the hosted domain, but the identical export also
 * runs from an IPFS gateway where no rewrite exists and a relative POST would hit the
 * gateway's own 404. One absolute URL works from both.
 */
export const PARTNER_URL =
  process.env.NEXT_PUBLIC_PARTNER_URL ??
  "https://hoodfi-gateway.dmpay.workers.dev/partner";

/** Gateway route that signs short-name credit vouchers. */
export const VOUCHER_URL =
  process.env.NEXT_PUBLIC_VOUCHER_URL ??
  "https://hoodfi-gateway.dmpay.workers.dev/voucher";

/**
 * The MCP endpoint agents connect to.
 *
 * Its own worker, not a gateway route: the gateway's URL is baked into
 * HoodfiL1Resolver on mainnet and answers every CCIP-Read lookup for the domain, so a
 * publicly listed agent endpoint sharing it could degrade resolution under load.
 */
export const MCP_URL =
  process.env.NEXT_PUBLIC_MCP_URL ?? "https://hoodfi-mcp.dmpay.workers.dev/mcp";

/**
 * Gateway route serving the donation ledger.
 *
 * Read server-side because a wide `eth_getLogs` needs an archive-capable RPC, and any
 * key reachable from the browser has to be inlined into the bundle to get there.
 */
export const DONATIONS_URL =
  process.env.NEXT_PUBLIC_DONATIONS_URL ??
  "https://hoodfi-gateway.dmpay.workers.dev/donations";
