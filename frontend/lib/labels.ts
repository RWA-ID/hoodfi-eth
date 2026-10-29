/**
 * Client-side mirror of LabelUtils.sol. The contracts enforce the same rules —
 * this exists so the UI can explain problems before a transaction is attempted.
 */
export const MAX_LABEL_LENGTH = 32;

/** Shortest label that was always on public sale; shorter ones open with `shortsOpen`. */
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

/** How deep a name may be looked up. Mirrors MAX_DEPTH in the gateway. */
export const MAX_NAME_DEPTH = 5;

export type PathCheck =
  | { ok: true; path: string; depth: number }
  | { ok: false; reason: string };

/**
 * Validates everything below `hoodfi.eth` — one label, or a dotted path.
 *
 * Names nest: the holder of `gm.hoodfi.eth` can create `crypto.gm.hoodfi.eth`, and
 * that name is looked up by its whole path. `checkLabel` rejects the dot, so using it
 * on a lookup told the owner of a perfectly good name that it contained illegal
 * characters. Each segment still has to satisfy `checkLabel`, so nothing is admitted
 * here that would have been refused at the top level.
 */
export function checkNamePath(input: string): PathCheck {
  const raw = input.trim().toLowerCase().replace(/\.hoodfi\.eth$/, "").replace(/\.eth$/, "");
  if (!raw) return { ok: false, reason: "Type a name" };

  const segments = raw.split(".");
  if (segments.length > MAX_NAME_DEPTH)
    return { ok: false, reason: `At most ${MAX_NAME_DEPTH} levels` };

  const clean: string[] = [];
  for (const segment of segments) {
    const check = checkLabel(segment);
    if (!check.ok) return { ok: false, reason: check.reason };
    clean.push(check.label);
  }

  return { ok: true, path: clean.join("."), depth: clean.length };
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
 * Tiers 0–2 are 1–3 character names. They sell at these prices once the registrar's
 * `shortsOpen` is true; until then they mint only with a short-name credit.
 */
export const TIER_USD = [15, 10, 5, 3];

/** Mirrors HoodfiRegistrar.status(). */
export const MINT_STATUS = {
  AVAILABLE: 0,
  TAKEN: 1,
  LOCKED: 2,
  INVALID: 3,
  BLOCKED: 4,
} as const;
