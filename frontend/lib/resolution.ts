import { getAddress, parseAbiItem, type Address } from "viem";
import {
  L2_REGISTRY_ADDRESS,
  PARTNER_ROUTER_ADDRESS,
  ZERO_ADDRESS,
} from "./contracts";
import { l2Client, publicClient } from "./wagmi";
import { getLogsInWindows } from "./logs";

/** Where the registry starts. Unset falls back to 0: slower, never wrong. */
const DEPLOY_BLOCK = BigInt(process.env.NEXT_PUBLIC_L2_DEPLOY_BLOCK ?? "0");

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
    // From the registry's deploy block, not 0: the query is windowed to stay under the
    // RPC's 10M-block cap (lib/logs.ts), and every window before the deploy is a wasted
    // request.
    const logs = await getLogsInWindows(l2Client, DEPLOY_BLOCK, (fromBlock, toBlock) =>
      l2Client.getLogs({
        address: L2_REGISTRY_ADDRESS!,
        event: transferEvent,
        args: { from: ZERO_ADDRESS, tokenId },
        fromBlock,
        toBlock,
      })
    );
    if (logs.length === 0) return null;
    const block = await l2Client.getBlock({ blockNumber: logs[0].blockNumber });
    return new Date(Number(block.timestamp) * 1000).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

/**
 * How `owner` came to hold the name: minted it, or received it from someone.
 *
 * The registry has no transfer hook, so records do not follow the NFT. A name bought on
 * OpenSea arrives still pointing at the seller — funds sent to it go to the previous
 * owner until the buyer re-points it. This is what tells the manage page that the
 * records it is showing were written by somebody else.
 *
 * A partner sale mints to the router and the router hands it on, so a transfer *from
 * the router* is a mint for this purpose — and the router has already re-pointed the
 * records at the buyer.
 *
 * Tri-state on purpose: a failed log read is "unknown", never "minted". Reading a
 * throttled RPC as "nothing to warn about" would hide the notice from exactly the
 * buyer it exists for.
 */
export type Acquisition =
  | { status: "checking" }
  | { status: "minted" }
  | { status: "transferred"; from: Address; date: string | null }
  | { status: "unknown" };

export async function readAcquisition(
  tokenId: bigint,
  owner: Address
): Promise<Acquisition> {
  if (!L2_REGISTRY_ADDRESS) return { status: "unknown" };
  try {
    const logs = await getLogsInWindows(l2Client, DEPLOY_BLOCK, (fromBlock, toBlock) =>
      l2Client.getLogs({
        address: L2_REGISTRY_ADDRESS!,
        event: transferEvent,
        args: { to: owner, tokenId },
        fromBlock,
        toBlock,
      })
    );
    // The most recent arrival is the one that matters: a name minted here, sent away
    // and bought back carries whatever the last holder wrote.
    const last = logs.at(-1);
    if (!last?.args.from) return { status: "unknown" };
    const from = getAddress(last.args.from);
    if (from === ZERO_ADDRESS || from === getAddress(PARTNER_ROUTER_ADDRESS)) {
      return { status: "minted" };
    }
    const block = await l2Client
      .getBlock({ blockNumber: last.blockNumber })
      .catch(() => null);
    const date = block
      ? new Date(Number(block.timestamp) * 1000).toISOString().slice(0, 10)
      : null;
    return { status: "transferred", from, date };
  } catch {
    return { status: "unknown" };
  }
}
