import { type Address, encodeFunctionData, keccak256, namehash, toHex } from "viem";
import { registryAbi } from "@/lib/contracts";
import { checkLabel } from "@/lib/labels";

/**
 * Creating names beneath a name you already own.
 *
 * The registry needs no registrar for this: `createSubnode` is guarded by
 * `onlyOwnerOrRegistrar(node)` and keys on namehash, so the holder of
 * `aaron.hoodfi.eth` can mint `jack.aaron.hoodfi.eth` directly, and the holder of
 * *that* can go deeper still. Nothing is charged — the registrar's pricing sits on
 * the public mint of second-level names and has no say here.
 */

/** A row in the batch editor. `recipient` empty means "keep it myself". */
export type SubnameDraft = {
  id: string;
  label: string;
  recipient: string;
};

export type SubnameRowCheck =
  | { ok: true; label: string; recipient: Address | null }
  | { ok: false; reason: string };

/**
 * Validates one row.
 *
 * The contract checks only that a label is 1–255 bytes — no charset rule, and
 * `createSubnode` bypasses the registrar, so the blocklist does not apply either.
 * Every rule that keeps a name resolvable and typeable therefore lives here and
 * nowhere else. `checkLabel` is the same function the mint panel uses, so a subname
 * can never be something that would have been refused at the top level.
 */
export function checkSubnameRow(draft: SubnameDraft): SubnameRowCheck {
  const check = checkLabel(draft.label);
  if (!check.ok) return { ok: false, reason: check.reason };

  const raw = draft.recipient.trim();
  if (raw === "") return { ok: true, label: check.label, recipient: null };
  if (!/^0x[0-9a-fA-F]{40}$/.test(raw))
    return { ok: false, reason: "Recipient must be a 0x address" };

  return { ok: true, label: check.label, recipient: raw as Address };
}

/** Rejects two rows claiming the same label before the chain has to. */
export function duplicateLabels(rows: SubnameRowCheck[]): Set<string> {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const row of rows) {
    if (!row.ok) continue;
    if (seen.has(row.label)) dupes.add(row.label);
    seen.add(row.label);
  }
  return dupes;
}

/** namehash of a child, without a round trip to the chain. */
export function subnodeOf(parentNode: `0x${string}`, label: string): `0x${string}` {
  const labelhash = keccak256(new TextEncoder().encode(label));
  return keccak256(`0x${parentNode.slice(2)}${labelhash.slice(2)}` as `0x${string}`);
}

/** The full dotted name a row would create. */
export function subnameOf(parentName: string, label: string): string {
  return `${label}.${parentName}`;
}

/**
 * The calls that create one subname, in the only order that works.
 *
 * `createSubnode` mints the token BEFORE it runs the resolver setters in `data`, and
 * those setters authorise against the owner of the *subnode*. So handing a name
 * straight to a friend with its address record already filled in reverts — by the
 * time the setter runs, the friend owns it and we do not.
 *
 * The way round it is to mint to ourselves, set the record while we still hold the
 * token, and transfer afterwards. All three land in one `registry.multicall`, which
 * delegatecalls into this same contract and so preserves `msg.sender` throughout.
 * (Multicall3 cannot be used for any of this: it would become the caller and fail
 * the owner check on the very first call.)
 *
 * A row with no recipient skips the transfer and keeps the name.
 */
export function buildSubnameCalls(
  parentNode: `0x${string}`,
  label: string,
  recipient: Address | null,
  self: Address
): `0x${string}`[] {
  const subnode = subnodeOf(parentNode, label);
  const holder = recipient ?? self;

  // Point the name at whoever ends up holding it, so it resolves the moment it
  // lands rather than after the recipient works out they must come and set it.
  const setAddr = encodeFunctionData({
    abi: registryAbi,
    functionName: "setAddr",
    args: [subnode, 60n, holder],
  });

  const create = encodeFunctionData({
    abi: registryAbi,
    functionName: "createSubnode",
    args: [parentNode, label, self, [setAddr]],
  });

  if (!recipient) return [create];

  const transfer = encodeFunctionData({
    abi: registryAbi,
    functionName: "transferFrom",
    args: [self, recipient, BigInt(subnode)],
  });

  return [create, transfer];
}

/** Every call for a whole batch, flattened into one multicall payload. */
export function buildBatchCalls(
  parentNode: `0x${string}`,
  rows: SubnameRowCheck[],
  self: Address
): `0x${string}`[] {
  const calls: `0x${string}`[] = [];
  for (const row of rows) {
    if (!row.ok) continue;
    calls.push(...buildSubnameCalls(parentNode, row.label, row.recipient, self));
  }
  return calls;
}

/** The ERC-721 token id for a name — the node, reinterpreted. */
export function tokenIdOf(node: `0x${string}`): bigint {
  return BigInt(node);
}

export { namehash, toHex };
