import { ROBINHOOD_CHAIN_ID } from "./chains";

/** The name every site published here hangs off. */
export const PARENT_NAME = "hoodfi.eth";

/**
 * ENSIP-11 coin type for Robinhood Chain.
 *
 * The `n` suffixes are load-bearing. `0x80000000 | 4663` in plain JS is a *signed*
 * 32-bit operation and comes out negative, which breaks the write and the read alike —
 * and a failed read looks like a pre-filled field rather than an error. Cost a day once.
 */
export const ROBINHOOD_COIN_TYPE = 0x80000000n | BigInt(ROBINHOOD_CHAIN_ID);

/** Decodes the DNS wire format the registry stores names in. */
export function dnsDecodeName(encoded: string): string {
  const hex = encoded.startsWith("0x") ? encoded.slice(2) : encoded;
  const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? []);

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

export function labelFromName(name: string): string {
  return name.split(".")[0] ?? "";
}
