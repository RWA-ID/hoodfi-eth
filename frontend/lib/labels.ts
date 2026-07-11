/**
 * Client-side mirror of LabelUtils.sol. The contracts enforce the same rules —
 * this exists so the UI can explain problems before a transaction is attempted.
 */
export const MAX_LABEL_LENGTH = 32;
export const MIN_RESERVABLE_LENGTH = 4;

export type LabelCheck =
  | { ok: true; label: string }
  | { ok: false; reason: string };

export function normalizeLabel(input: string): string {
  return input.trim().toLowerCase().replace(/\.hoodfi\.eth$/, "").replace(/\.eth$/, "");
}

export function checkLabel(input: string, forReservation: boolean): LabelCheck {
  const label = normalizeLabel(input);
  if (label.length === 0) return { ok: false, reason: "Type a name" };
  if (forReservation && label.length < MIN_RESERVABLE_LENGTH)
    return {
      ok: false,
      reason: "Reservations need 4+ characters — short names go on sale at launch",
    };
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

export const TIER_USD = [15, 10, 5, 3];
