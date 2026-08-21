import type { Hex } from "viem";

/**
 * The client half of the publish protocol.
 *
 * Three steps, in this order, and the order is the design:
 *
 *   1. pin   — the gateway pins the rendered site, marked unpaid, on an owner signature
 *   2. pay   — the owner calls publish(node, templateId, cid) on HoodfiSites
 *   3. keep  — the gateway checks isPaid(node, cid) on chain and marks the pin paid
 *
 * Then the owner writes the contenthash themselves. We never hold a key to their name.
 *
 * Every step names the name by its whole path below `hoodfi.eth` — `crypto.gm`, not
 * `crypto`. The three steps derive the same node from that string independently, so a
 * step that abbreviates it addresses a different name than the one being paid for.
 *
 * A CID cannot be paid for before it exists, which is why pinning comes first and why
 * step one is free. Anything pinned and never paid for is swept after a day.
 */

export const SITE_UPLOAD_URL =
  process.env.NEXT_PUBLIC_SITE_UPLOAD_URL ??
  "https://hoodfi-gateway.dmpay.workers.dev/site";

/** How long a publish signature is good for. Matches the worker's window. */
export const SIGNATURE_LIFETIME_MS = 10 * 60 * 1000;

/**
 * The exact text the owner signs.
 *
 * MUST match `sitePublishMessage` in gateway/src/handlers/postSite.ts byte for byte.
 * The two halves are one protocol: the gateway rebuilds this string from the name, the
 * hash of the bytes it received and the expiry, then recovers the signer. A stray space
 * on either side rejects every publish.
 */
export function sitePublishMessage(name: string, hash: Hex, expiry: number): string {
  return [
    "HoodFi site publish",
    "",
    `Name: ${name}`,
    `Site: ${hash}`,
    `Expires: ${new Date(expiry).toISOString()}`,
  ].join("\n");
}

export type PinResult = { cid: string; uri: string; node: Hex };

/** Step one. Returns the CID the payment will name. */
export async function pinSite(args: {
  /** The whole path below `hoodfi.eth` — `crypto.gm`, never `crypto`. */
  path: string;
  html: string;
  templateId: string;
  signature: Hex;
  expiry: number;
}): Promise<PinResult> {
  const response = await fetch(`${SITE_UPLOAD_URL}/${encodeURIComponent(args.path)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      html: args.html,
      templateId: args.templateId,
      signature: args.signature,
      expiry: args.expiry,
    }),
  });

  if (!response.ok) {
    // The worker's 4xx bodies are written for the person reading them.
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "Could not pin your site. Try again.");
  }
  return (await response.json()) as PinResult;
}

/**
 * Step three. Idempotent, and safe to retry.
 *
 * Worth retrying rather than failing loudly on the first attempt: the payment
 * transaction has to be mined before `isPaid` can see it, and a wallet returns from
 * `writeContract` before that happens. Retrying here is the difference between "your
 * site is live" and "it says unpaid but the money left".
 */
export async function confirmSite(path: string, cid: string): Promise<void> {
  const response = await fetch(`${SITE_UPLOAD_URL}/${encodeURIComponent(path)}/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cid }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "Could not confirm the payment.");
  }
}

/** Where the finished site answers. `.link`, not `.limo` — both are eth.limo. */
export function publishedUrl(path: string): string {
  return `https://${path}.hoodfi.eth.link/`;
}
