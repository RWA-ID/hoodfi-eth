import { ROBINHOOD_CHAIN_ID } from "./chains";

/** ENSIP-11 coinType for Robinhood Chain — the forward address record a name resolves to. */
export const ROBINHOOD_COIN_TYPE = BigInt(0x80000000 | ROBINHOOD_CHAIN_ID);

/** Mainnet ETH, per SLIP-44. Set alongside the chain-specific record on every mint. */
export const ETH_COIN_TYPE = 60n;

/**
 * Decodes a DNS-wire-format name (as the registry stores it) back to dot notation.
 * Each label is length-prefixed and the sequence ends with a zero byte.
 */
export function dnsDecodeName(encoded: string): string {
  const hex = encoded.startsWith("0x") ? encoded.slice(2) : encoded;
  const bytes = new Uint8Array(
    hex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? []
  );

  const labels: string[] = [];
  let i = 0;
  while (i < bytes.length) {
    const len = bytes[i];
    if (len === 0) break;
    i += 1;
    if (i + len > bytes.length) break;
    labels.push(new TextDecoder().decode(bytes.slice(i, i + len)));
    i += len;
  }
  return labels.join(".");
}

/** First label of a decoded name — "blake" from "blake.hoodfi.eth". */
export function labelFromName(name: string): string {
  return name.split(".")[0] ?? "";
}

/**
 * Renders an avatar record for display. Handles the ipfs:// form the ENS avatar
 * spec uses; anything else (https, data:) is passed through untouched.
 */
export function avatarToUrl(value: string): string {
  if (!value) return "";
  if (value.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${value.slice("ipfs://".length)}`;
  }
  return value;
}

/** Strips a leading @ and any x.com/twitter.com URL wrapper down to the handle. */
export function normalizeXHandle(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const urlMatch = trimmed.match(
    /^(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/@?([A-Za-z0-9_]{1,15})\/?$/i
  );
  if (urlMatch) return urlMatch[1];
  return trimmed.replace(/^@/, "");
}
