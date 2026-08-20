import { bytesToHex, hexToBytes } from "viem";
import {
  decodeBtcAddress,
  decodeSolAddress,
  encodeBtcAddress,
  encodeSolAddress,
} from "@ensdomains/address-encoder/coders";
import { ROBINHOOD_CHAIN_ID } from "./chains";

/**
 * ENSIP-11 coinType for Robinhood Chain — the forward address record a name resolves to.
 *
 * Done in BigInt on purpose. JS bitwise operators coerce to *signed* 32-bit, so the
 * obvious `0x80000000 | chainId` comes back negative (-2147478985 for chain 4663) and
 * every encode against a uint256 throws.
 */
export const ROBINHOOD_COIN_TYPE = 0x80000000n | BigInt(ROBINHOOD_CHAIN_ID);

/** Mainnet ETH, per SLIP-44. Set alongside the chain-specific record on every mint. */
export const ETH_COIN_TYPE = 60n;

/** SLIP-44 coinTypes for the non-EVM chains a name can also carry an address for. */
export const BTC_COIN_TYPE = 0n;
export const SOL_COIN_TYPE = 501n;

/** Per-chain codecs, imported one at a time so the other 240 coins stay out of the bundle. */
const CODERS: Record<
  string,
  { decode: (value: string) => Uint8Array; encode: (bytes: Uint8Array) => string }
> = {
  [BTC_COIN_TYPE.toString()]: {
    decode: decodeBtcAddress,
    encode: encodeBtcAddress,
  },
  [SOL_COIN_TYPE.toString()]: {
    decode: decodeSolAddress,
    encode: encodeSolAddress,
  },
};

/**
 * Address text -> the binary form ENSIP-9 stores. Bitcoin keeps its scriptPubKey and
 * Solana its raw ed25519 pubkey, so neither can be written as the string the user typed.
 * Returns null when the input doesn't parse for that chain — which is also our validation.
 */
export function encodeChainAddress(
  coinType: bigint,
  value: string
): `0x${string}` | null {
  const trimmed = value.trim();
  const coder = CODERS[coinType.toString()];
  if (!trimmed || !coder) return null;
  try {
    return bytesToHex(coder.decode(trimmed));
  } catch {
    return null;
  }
}

/** Stored bytes -> the address text a user recognises. Empty when unset or undecodable. */
export function decodeChainAddress(
  coinType: bigint,
  stored: string | undefined
): string {
  const coder = CODERS[coinType.toString()];
  if (!stored || stored === "0x" || !coder) return "";
  try {
    return coder.encode(hexToBytes(stored as `0x${string}`));
  } catch {
    return "";
  }
}

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
 * Everything below `hoodfi.eth` — `jack` for `jack.hoodfi.eth`, `jack.aaron` for
 * `jack.aaron.hoodfi.eth`.
 *
 * Anywhere a name is addressed by its label rather than its node, this is what has to
 * be sent. `labelFromName` returns only the leftmost segment, which for a nested name
 * identifies a *different* name — `jack.aaron.hoodfi.eth` would be addressed as
 * `jack.hoodfi.eth`, quite possibly somebody else's.
 */
export function pathBelowRoot(name: string): string {
  return name.replace(/\.hoodfi\.eth$/, "");
}

/**
 * Our own Pinata gateway — the one the uploader pins to. It serves a CID the moment
 * the upload completes, because it is the account holding the pin rather than a
 * stranger that has to find the bytes on the network first.
 */
const PINNED_GATEWAY = "https://ipfs.onchain-id.id/ipfs/";
/** For CIDs we didn't pin, which the dedicated gateway refuses outright. */
const PUBLIC_GATEWAY = "https://ipfs.io/ipfs/";

/**
 * Where an avatar record can be fetched from, best first.
 *
 * Handles the ipfs:// form the ENS avatar spec uses; anything else (https, data:) is
 * passed through untouched, as a single candidate.
 *
 * There are two gateways because neither one covers both cases. A freshly uploaded
 * avatar is pinned on our account and available from our gateway immediately, while a
 * public gateway may take minutes to find it — that delay is the whole reason a new
 * picture used to seem not to have saved. But the dedicated gateway serves *only* what
 * this account pinned and 403s everything else, and the avatar field accepts any URI
 * an owner types, so a CID pinned somewhere else has to fall through to the public one.
 */
export function avatarUrls(value: string): string[] {
  if (!value) return [];
  if (value.startsWith("ipfs://")) {
    const cid = value.slice("ipfs://".length);
    return [`${PINNED_GATEWAY}${cid}`, `${PUBLIC_GATEWAY}${cid}`];
  }
  return [value];
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
