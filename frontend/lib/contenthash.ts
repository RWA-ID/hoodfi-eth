import { bytesToHex, hexToBytes } from "viem";
import {
  base32UnpaddedDecode,
  base32UnpaddedEncode,
  base58UncheckedDecode,
} from "@ensdomains/address-encoder/utils";

/**
 * EIP-1577 contenthash — the record that turns a name into a website.
 *
 * Only the IPFS family is handled, which is the whole of what this site can honestly
 * offer: names are minted here, pinned here and served through IPFS gateways here.
 * Swarm and Arweave namespaces exist in the spec and are deliberately not accepted —
 * writing one would produce a record we can't preview, can't link to, and can't tell
 * an owner is working.
 *
 * The stored bytes are <protoCode varint><CID>, so a record is two decisions: which
 * namespace, and a CID the gateways will accept.
 */

/** uvarint(0xe3) — ipfs-ns. */
const IPFS_NS = [0xe3, 0x01];
/** uvarint(0xe5) — ipns-ns. */
const IPNS_NS = [0xe5, 0x01];

/** Multicodecs a CID may carry for each namespace. dag-pb is a directory (a site), raw a single file. */
const IPFS_CODECS = [0x70, 0x55];
const IPNS_CODEC = 0x72; // libp2p-key

export type ContentProtocol = "ipfs" | "ipns";

export type ContentHash = {
  protocol: ContentProtocol;
  /**
   * The canonical multibase id: base32 for an IPFS CID, base36 for an IPNS key. Both
   * are lowercase and DNS-safe, which is what lets them be used as a gateway subdomain
   * — the only gateway form that serves a site's own assets from the site's own origin.
   */
  id: string;
  /** `ipfs://…` — how every other ENS tool shows the same record. */
  uri: string;
};

/*//////////////////////////////////////////////////////////////
                          MULTIBASE
//////////////////////////////////////////////////////////////*/

const BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * base36, lowercase — multibase prefix `k`, the form IPNS names are published in.
 *
 * Hand-rolled because it is the one base in this file no dependency here exposes. Both
 * directions carry leading zero bytes explicitly: a big-integer conversion drops them,
 * and for a CID that would silently change which key the record points at.
 */
function base36Decode(input: string): Uint8Array {
  let value = 0n;
  for (const char of input) {
    const digit = BASE36.indexOf(char);
    if (digit < 0) throw new Error("Not base36");
    value = value * 36n + BigInt(digit);
  }
  const bytes: number[] = [];
  while (value > 0n) {
    bytes.unshift(Number(value & 0xffn));
    value >>= 8n;
  }
  for (const char of input) {
    if (char !== "0") break;
    bytes.unshift(0);
  }
  return new Uint8Array(bytes);
}

function base36Encode(bytes: Uint8Array): string {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  let out = "";
  while (value > 0n) {
    out = BASE36[Number(value % 36n)] + out;
    value /= 36n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    out = `0${out}`;
  }
  return out;
}

/** base32 with no padding, lowercase — multibase prefix `b`, the canonical CIDv1 form. */
function base32Decode(input: string): Uint8Array {
  return base32UnpaddedDecode(input.toUpperCase());
}

function base32Encode(bytes: Uint8Array): string {
  return base32UnpaddedEncode(bytes).toLowerCase();
}

/*//////////////////////////////////////////////////////////////
                            VARINT
//////////////////////////////////////////////////////////////*/

/** Reads an unsigned varint, returning the value and where it ended. */
function readVarint(bytes: Uint8Array, offset: number): [number, number] {
  let value = 0;
  let shift = 0;
  let i = offset;
  while (i < bytes.length) {
    const byte = bytes[i];
    value |= (byte & 0x7f) << shift;
    i += 1;
    if ((byte & 0x80) === 0) return [value >>> 0, i];
    shift += 7;
    if (shift > 28) break;
  }
  throw new Error("Malformed varint");
}

/*//////////////////////////////////////////////////////////////
                              CID
//////////////////////////////////////////////////////////////*/

/**
 * Rejects anything that isn't a well-formed CIDv1 for the namespace it claims.
 *
 * The length check is what catches a truncated paste. A CID is base-encoded, so half a
 * CID decodes to bytes perfectly happily — only the multihash's own length prefix says
 * how many bytes should have followed it, and a record written from a half-CID resolves
 * to nothing forever with no error anywhere to explain why.
 */
function isValidCid(bytes: Uint8Array, codecs: number[]): boolean {
  try {
    if (bytes[0] !== 0x01) return false;
    const [codec, afterCodec] = readVarint(bytes, 1);
    if (!codecs.includes(codec)) return false;
    const [, afterHashCode] = readVarint(bytes, afterCodec);
    const [digestLength, afterLength] = readVarint(bytes, afterHashCode);
    return bytes.length - afterLength === digestLength && digestLength > 0;
  } catch {
    return false;
  }
}

/** Decodes any multibase form a user might paste into raw CID bytes. */
function decodeMultibase(id: string): Uint8Array | null {
  try {
    // CIDv0 — a bare base58 multihash, always dag-pb. Kept as its own case because it
    // has no multibase prefix at all: the leading `Qm` is part of the hash.
    if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(id)) {
      return new Uint8Array([0x01, 0x70, ...base58UncheckedDecode(id)]);
    }
    if (/^b[a-z2-7]+$/i.test(id)) return base32Decode(id.slice(1));
    if (/^k[0-9a-z]+$/.test(id)) return base36Decode(id.slice(1));
    // A raw libp2p peer id, which is how IPNS names were published before base36.
    if (/^1[1-9A-HJ-NP-Za-km-z]{10,}$/.test(id)) {
      return new Uint8Array([0x01, IPNS_CODEC, ...base58UncheckedDecode(id)]);
    }
    return null;
  } catch {
    return null;
  }
}

/*//////////////////////////////////////////////////////////////
                        PUBLIC INTERFACE
//////////////////////////////////////////////////////////////*/

/**
 * Reads what the registry holds. Returns null for an unset record and — deliberately —
 * for a record in a namespace this site doesn't handle, so callers can't offer a
 * "Visit" button pointing somewhere they were never able to check.
 */
export function decodeContenthash(
  stored: string | undefined | null
): ContentHash | null {
  if (!stored || stored === "0x") return null;
  try {
    const bytes = hexToBytes(stored as `0x${string}`);
    const [namespace, offset] = readVarint(bytes, 0);
    const cid = bytes.slice(offset);

    if (namespace === 0xe3 && isValidCid(cid, IPFS_CODECS)) {
      const id = `b${base32Encode(cid)}`;
      return { protocol: "ipfs", id, uri: `ipfs://${id}` };
    }
    if (namespace === 0xe5 && isValidCid(cid, [IPNS_CODEC])) {
      const id = `k${base36Encode(cid)}`;
      return { protocol: "ipns", id, uri: `ipns://${id}` };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Whatever an owner pasted -> the bytes to store, or null if it can't be one.
 *
 * Generous about the input because everything people copy is a different shape of the
 * same CID: the URI form, a bare CID, a gateway link with the CID in the path, and a
 * subdomain gateway link with it in the host. Every one of those is unambiguous, and
 * refusing them would only teach owners to hand-edit a URL until it looks like ours.
 */
export function encodeContenthash(input: string): `0x${string}` | null {
  const parsed = parseContentInput(input);
  if (!parsed) return null;
  const namespace = parsed.protocol === "ipfs" ? IPFS_NS : IPNS_NS;
  return bytesToHex(new Uint8Array([...namespace, ...parsed.cid]));
}

/** The same parse, exposed for the editor's "what you're about to publish" preview. */
export function parseContenthash(input: string): ContentHash | null {
  const parsed = parseContentInput(input);
  if (!parsed) return null;
  const id =
    parsed.protocol === "ipfs"
      ? `b${base32Encode(parsed.cid)}`
      : `k${base36Encode(parsed.cid)}`;
  return { protocol: parsed.protocol, id, uri: `${parsed.protocol}://${id}` };
}

function parseContentInput(
  input: string
): { protocol: ContentProtocol; cid: Uint8Array } | null {
  let value = input.trim();
  if (!value) return null;

  let protocol: ContentProtocol | null = null;

  // A gateway link: the CID sits either in the path (/ipfs/<cid>) or, on a subdomain
  // gateway, in the host (<cid>.ipfs.dweb.link).
  const httpMatch = value.match(/^https?:\/\/([^/]+)(\/.*)?$/i);
  if (httpMatch) {
    const [, host, path = ""] = httpMatch;
    const pathMatch = path.match(/\/(ipfs|ipns)\/([^/?#]+)/i);
    const hostMatch = host.match(/^([^.]+)\.(ipfs|ipns)\./i);
    if (pathMatch) {
      protocol = pathMatch[1].toLowerCase() as ContentProtocol;
      value = pathMatch[2];
    } else if (hostMatch) {
      protocol = hostMatch[2].toLowerCase() as ContentProtocol;
      value = hostMatch[1];
    } else {
      return null;
    }
  }

  const uriMatch = value.match(/^(ipfs|ipns):\/\/(?:(?:ipfs|ipns)\/)?(.+)$/i);
  if (uriMatch) {
    protocol = uriMatch[1].toLowerCase() as ContentProtocol;
    value = uriMatch[2];
  }

  // A CID can carry a trailing path — the record can't, and storing the CID alone
  // would quietly point at a different page than the one that was pasted.
  const id = value.replace(/\/+$/, "");
  if (id.includes("/") || id.includes("?") || id.includes("#")) return null;

  let cid = decodeMultibase(id);
  if (!cid) return null;

  // A `Qm…` peer id and a `Qm…` file CID are the same 34 bytes; only the prefix that
  // was typed tells them apart, so an explicit ipns:// re-labels it as a key.
  if (protocol === "ipns" && cid[0] === 0x01 && cid[1] === 0x70) {
    cid = new Uint8Array([0x01, IPNS_CODEC, ...cid.slice(2)]);
  }

  // Otherwise the CID itself says which namespace it belongs to, and it outranks the
  // prefix: `ipfs://k51…` is a key, not a file, however it was pasted.
  if (isValidCid(cid, IPFS_CODECS)) return { protocol: "ipfs", cid };
  if (isValidCid(cid, [IPNS_CODEC])) return { protocol: "ipns", cid };
  // Everything left is a CID in a codec no gateway would serve as a page.
  return null;
}

/**
 * A URL that serves the site today, for anyone in an ordinary browser.
 *
 * Deliberately a *subdomain* gateway: a path gateway (`/ipfs/<cid>/`) serves every page
 * from one origin, so a site's own absolute links, its styles and its scripts resolve
 * against the gateway root and the page arrives unstyled. The subdomain form gives the
 * CID its own origin and the site loads as its author built it.
 *
 * Not our own Pinata gateway, which serves only what this account pinned and 403s
 * everything else — owners publish their sites wherever they like.
 */
export function contentGatewayUrl(content: ContentHash): string {
  return `https://${content.id}.${content.protocol}.dweb.link/`;
}

/**
 * The address the name itself answers on, through eth.limo's ENS gateway.
 *
 * This is the point of setting the record — the CID link above is the fallback that
 * always works, this is the one worth telling people.
 */
export function limoUrl(label: string): string {
  return `https://${label}.hoodfi.eth.limo/`;
}
