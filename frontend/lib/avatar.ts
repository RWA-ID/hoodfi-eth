import { sha256 } from "viem";

/**
 * Client half of the avatar upload protocol.
 *
 * ENS stores an avatar as a URL, which quietly makes "set an avatar" a task only people
 * who already host images can complete. The gateway hosts the file; this module gets it
 * into a shape worth hosting and proves the caller is allowed to.
 */

/** Square edge we store. Big enough for any avatar slot, small enough to stay cheap. */
export const AVATAR_EDGE = 512;

/** Refuse absurd input before spending memory decoding it. */
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

/** Must match MAX_BYTES in gateway/src/handlers/postAvatar.ts, which rejects above it. */
const MAX_UPLOAD_BYTES = 512 * 1024;

/** Bytes behind a base64 data URL, without building a Blob to ask. */
function dataUrlBytes(url: string): number {
  const b64 = url.slice(url.indexOf(",") + 1);
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

/**
 * Encodes a finished square canvas as the data URL we upload.
 *
 * This used to ask for WebP, which is the right answer on every axis but the one that
 * matters: it keeps alpha, it lands far smaller than PNG — and satori cannot decode it.
 * The share card is rendered by satori, so a WebP avatar produced a card with an empty
 * box where the picture should be. An avatar nobody can see on a share card is not an
 * avatar; the format has to be one the card can draw.
 *
 * PNG first, because it keeps alpha and every browser encodes it. It is also much
 * larger, and a photographic 512px square can land over the gateway's 512KB cap, so
 * anything that big falls back to JPEG. That flattens transparency onto black, which is
 * the ink the avatar sits on anyway — and it only happens to photographs, which have no
 * transparency to lose.
 */
export function encodeAvatar(canvas: HTMLCanvasElement): string {
  const png = canvas.toDataURL("image/png");
  if (dataUrlBytes(png) <= MAX_UPLOAD_BYTES) return png;
  return canvas.toDataURL("image/jpeg", 0.9);
}

/**
 * The exact text the owner signs.
 *
 * MUST match `avatarUploadMessage` in gateway/src/handlers/postAvatar.ts byte for byte.
 * The two halves are one protocol: the gateway rebuilds this string from the name, the
 * hash of the bytes it received and the expiry, then recovers the signer from it. A
 * stray space on either side rejects every upload.
 */
export function avatarUploadMessage(
  name: string,
  hash: `0x${string}`,
  expiry: number
): string {
  return [
    "HoodFi avatar upload",
    "",
    `Name: ${name}`,
    `Image: ${hash}`,
    `Expires: ${new Date(expiry).toISOString()}`,
  ].join("\n");
}

/**
 * A pinned-but-unsaved avatar, remembered across reloads.
 *
 * Uploading is only half the job — the record still has to be written, and until it is,
 * the returned URI lives nowhere but an unsaved form field. That is fine on a desktop
 * and lossy on a phone: signing hands off to the wallet app, and coming back can reload
 * the page, so the upload completes server-side while the state holding its CID is
 * gone. The image is pinned and the owner has no way to find it again.
 *
 * Scoped per name and cleared as soon as the chain agrees, so it can't outlive its
 * purpose or leak onto a different name.
 */
const STASH_PREFIX = "hoodfi.avatar.pending.";

export function stashAvatar(label: string, uri: string): void {
  try {
    sessionStorage.setItem(STASH_PREFIX + label, uri);
  } catch {
    // Private mode and sandboxed frames throw. Losing the safety net is survivable;
    // failing the upload that just succeeded is not.
  }
}

export function readStashedAvatar(label: string): string | null {
  try {
    return sessionStorage.getItem(STASH_PREFIX + label);
  } catch {
    return null;
  }
}

export function clearStashedAvatar(label: string): void {
  try {
    sessionStorage.removeItem(STASH_PREFIX + label);
  } catch {
    // Nothing to do — a stale entry clears itself once the record matches.
  }
}

/** Raw bytes behind a base64 data URL, for hashing. */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** How long the signature the user is about to produce stays usable. */
const SIGNATURE_LIFETIME_MS = 5 * 60 * 1000;

/**
 * Uploads a prepared avatar and returns the `ipfs://` URI to store in the record.
 *
 * Deliberately stops there. Writing the record is a transaction the owner signs from
 * the editor along with whatever else they changed, so an upload costs no gas and a
 * change of mind before saving costs nothing at all.
 */
export async function uploadAvatar(opts: {
  endpoint: string;
  label: string;
  dataUrl: string;
  signMessage: (message: string) => Promise<`0x${string}`>;
}): Promise<string> {
  const { endpoint, label, dataUrl, signMessage } = opts;

  const expiry = Date.now() + SIGNATURE_LIFETIME_MS;
  const hash = sha256(dataUrlToBytes(dataUrl));
  const signature = await signMessage(
    avatarUploadMessage(`${label}.hoodfi.eth`, hash, expiry)
  );

  const response = await fetch(`${endpoint}/${label}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl, signature, expiry }),
  });

  const body = (await response.json().catch(() => null)) as {
    uri?: string;
    message?: string;
  } | null;

  if (!response.ok || !body?.uri) {
    throw new Error(body?.message ?? "Upload failed — try again.");
  }
  return body.uri;
}
