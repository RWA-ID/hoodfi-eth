/**
 * Client-side mirror of LabelUtils.sol. The contracts enforce the same rules —
 * this exists so the UI can explain problems before a transaction is attempted.
 */
export const MAX_LABEL_LENGTH = 32;

/** Shortest label anyone can mint without spending a donation credit. */
export const PUBLIC_MIN_LENGTH = 4;

export type LabelCheck = { ok: true; label: string } | { ok: false; reason: string };

export function normalizeLabel(input: string): string {
  return input.trim().toLowerCase().replace(/\.hoodfi\.eth$/, "").replace(/\.eth$/, "");
}

export function checkLabel(input: string): LabelCheck {
  const label = normalizeLabel(input);
  if (label.length === 0) return { ok: false, reason: "Type a name" };
  if (label.length > MAX_LABEL_LENGTH)
    return { ok: false, reason: `Max ${MAX_LABEL_LENGTH} characters` };
  if (!/^[a-z0-9-]+$/.test(label))
    return { ok: false, reason: "Only a–z, 0–9 and hyphens" };
  if (label.startsWith("-") || label.endsWith("-"))
    return { ok: false, reason: "Can't start or end with a hyphen" };
  return { ok: true, label };
}

/** Tier index 0–3 (1 char, 2 chars, 3 chars, 4+). Mirrors LabelUtils.tierOf. */
export function tierOf(label: string): number {
  return label.length >= 4 ? 3 : label.length - 1;
}

/** True for 1–3 character names — premium inventory gated behind credits. */
export function isShort(label: string): boolean {
  return label.length > 0 && label.length < PUBLIC_MIN_LENGTH;
}

/**
 * Public sale price per tier, in USD — and specifically the USDG price, which is the
 * only leg the registrar charges to the cent. Mirrors HoodfiRegistrar.priceUsdc.
 *
 * The ETH leg is NOT this number. The contract stores a fixed quantity of ETH per
 * tier, pinned by hand whenever prices are set, so it only equals the dollar figure
 * on the day it was pinned and drifts from then on. Never render this as the price of
 * an ETH mint: read priceWei from the registrar and convert it through the live feed
 * (see lib/ethUsd.ts). Doing exactly that — printing $3 while charging 0.0016 ETH,
 * which had quietly become $3.66 — is why this warning is here.
 *
 * Tiers 0–2 are 1–3 character names, which are not on public sale until the 100-year
 * goal is reached, so those three figures describe what a short name *will* cost, not
 * what anyone pays for one today. See CREDIT_USD.
 */
export const TIER_USD = [15, 10, 5, 3];

/**
 * What a short-name credit actually costs today, in USD, plus Ethereum gas.
 *
 * A credit is one year added to hoodfi.eth's ENS expiry, and hoodfi.eth is six
 * characters — so ENS charges its 5-and-over rate of $5/year, paid in ETH at the
 * oracle rate. That is the only price on the site that isn't a tier price, and it
 * undercuts all three locked tiers, so anywhere a locked tier shows its number this
 * has to show beside it.
 */
export const CREDIT_USD = 5;

/** Mirrors HoodfiRegistrar.status(). */
export const MINT_STATUS = {
  AVAILABLE: 0,
  TAKEN: 1,
  LOCKED: 2,
  INVALID: 3,
  BLOCKED: 4,
} as const;
