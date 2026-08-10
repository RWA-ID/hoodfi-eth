import { sha256 } from "viem";

/**
 * Client half of the avatar upload protocol.
 *
 * ENS stores an avatar as a URL, which quietly makes "set an avatar" a task only people
 * who already host images can complete. The gateway hosts the file; this module gets it
 * into a shape worth hosting and proves the caller is allowed to.
 */

/** Square edge we store. Big enough for any avatar slot, small enough to stay cheap. */
const EDGE = 512;

/** Refuse absurd input before spending memory decoding it. */
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

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
 * Re-encodes a picked file as a square 512px data URL.
 *
 * Cover-cropped from the centre rather than squashed, because every surface that reads
 * an avatar renders it in a circle — a letterboxed image would just show background.
 *
 * WebP is asked for first: it keeps alpha, which JPEG would flatten to black inside
 * that circle, and it lands far smaller than PNG. Browsers that can't encode it return
 * a PNG from `toDataURL` instead of failing, and the gateway accepts both, so there is
 * nothing to detect or branch on.
 */
export async function prepareAvatar(file: File): Promise<string> {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("That image is too large — pick one under 20MB.");
  }

  // `from-image` applies the EXIF rotation phone cameras write, which is otherwise
  // ignored on canvas and turns portrait photos on their side.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  const canvas = document.createElement("canvas");
  canvas.width = EDGE;
  canvas.height = EDGE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't read that image.");

  const side = Math.min(bitmap.width, bitmap.height);
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    EDGE,
    EDGE
  );
  bitmap.close();

  return canvas.toDataURL("image/webp", 0.9);
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
