import { getAddress, parseAbiItem, type Address } from "viem";
import { L2_REGISTRY_ADDRESS, ZERO_ADDRESS } from "./contracts";
import { l2Client, publicClient } from "./wagmi";

/**
 * Whether a name resolves through Ethereum mainnet, and where it points if so.
 *
 * Lives outside the components because /search and /manage both need it and neither
 * owns it: the lookup page reports it about someone else's name, the manage page about
 * your own while you edit.
 */
export type L1State =
  | { status: "idle" | "checking" }
  | { status: "ok"; addr: Address }
  | { status: "mismatch"; addr: Address }
  | { status: "empty" }
  | { status: "error" };

/**
 * Resolves the name through the UniversalResolver and compares it against what the L2
 * registry holds.
 *
 * A disagreement is worth surfacing rather than smoothing over: it means the CCIP path
 * is answering with something other than the record you can see, which is the one
 * failure the L2 read cannot detect on its own.
 *
 * `path` is everything below `hoodfi.eth` — `gm` for `gm.hoodfi.eth`, `crypto.gm` for
 * `crypto.gm.hoodfi.eth`. Passing only the leftmost label asks about a different name:
 * `crypto.gm.hoodfi.eth` was checked as `crypto.hoodfi.eth`, which nobody owns, so a
 * name resolving perfectly well was reported to its owner as invisible to wallets.
 */
export async function resolveOnL1(
  path: string,
  expected: string
): Promise<L1State> {
  try {
    const resolved = await publicClient.getEnsAddress({
      name: `${path}.hoodfi.eth`,
    });
    if (!resolved) return { status: "empty" };
    const addr = getAddress(resolved);
    if (expected && addr !== getAddress(expected as Address)) {
      return { status: "mismatch", addr };
    }
    return { status: "ok", addr };
  } catch {
    return { status: "error" };
  }
}

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
);

/**
 * When the name was minted.
 *
 * Filtered on `from = 0x0` specifically. Querying every Transfer for the token and
 * taking the first returns the most recent *transfer* whenever the range starts after
 * the mint — which silently reports the day a name changed hands as the day it was
 * created. Verified against test1000: 2026-07-11 minted, 2026-08-07 transferred.
 */
export async function readMintDate(tokenId: bigint): Promise<string | null> {
  if (!L2_REGISTRY_ADDRESS) return null;
  try {
    const logs = await l2Client.getLogs({
      address: L2_REGISTRY_ADDRESS,
      event: transferEvent,
      args: { from: ZERO_ADDRESS, tokenId },
      fromBlock: 0n,
      toBlock: "latest",
    });
    if (logs.length === 0) return null;
    const block = await l2Client.getBlock({ blockNumber: logs[0].blockNumber });
    return new Date(Number(block.timestamp) * 1000).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}
