"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { bytesToHex, hexToBytes } from "viem";
import { usePublicClient } from "wagmi";
import { L2_REGISTRY_ADDRESS, registryAbi } from "@/lib/contracts";
import { robinhoodChain } from "@/lib/chains";
import type { SiteData } from "@/lib/templates/index.ts";

/** Text records worth pulling into a first draft, in the order we read them. */
const TEXT_KEYS = ["avatar", "description", "url", "com.twitter", "com.github"] as const;

/** ENSIP-9 coin types for the address records the manage page already writes. */
const ETH = 60n;
const BTC = 0n;
const SOL = 501n;

export type Prefill = Partial<SiteData>;

/**
 * Records already read this session, by node.
 *
 * Switching names means a chain round trip before the avatar can be drawn, and until it
 * lands the preview has nothing to show — so the picture arrives a beat after the name
 * does, which reads as the editor being slow to catch up. Names get switched back and
 * forth constantly while deciding which one to build on, and the second visit to a name
 * has no reason to wait again.
 *
 * Keyed by node, so it can only ever hand back the records of the name being asked about
 * — the cache cannot reintroduce the "one name's avatar on another" failure the reset
 * below exists to prevent. Module-level and unbounded, which is fine for the handful of
 * names a wallet holds and dies with the page either way.
 */
const cache = new Map<string, Prefill>();

/**
 * The records a name already carries, shaped as a starting draft.
 *
 * Almost everyone arriving here has already filled in an avatar, a description and a
 * couple of links on /manage. Asking them to type it a second time is asking them to
 * notice we didn't bother. This turns step one into an edit rather than a blank page.
 *
 * Read failures return nothing rather than an empty draft — a prefill that silently
 * comes back blank looks identical to a name with no records, and the visitor would
 * conclude their records were lost.
 */
export function useNameRecords(node: `0x${string}` | undefined) {
  const client = usePublicClient({ chainId: robinhoodChain.id });
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [loading, setLoading] = useState(false);
  /**
   * The name this hook is currently about.
   *
   * A read in flight for the name you just left still resolves, and without this it calls
   * setPrefill with that name's records — putting one name's avatar and bio onto another,
   * which is the failure the reset below was written to prevent and which the reset alone
   * cannot stop, since it only runs before the request rather than after it. Switching
   * quickly between two names is exactly the timing that hits it.
   */
  const current = useRef<`0x${string}` | undefined>(undefined);

  /**
   * Swap the answer the moment the question changes — during render, not in an effect.
   *
   * This used to reset inside the effect that starts the read, which runs *after* the
   * render that changed the name. For one painted frame the hook therefore answered the
   * new name's question with the old name's records, and the editor drew the previous
   * name's avatar before blanking it and fetching the right one. That flash is what
   * "the avatar lags when switching names" was.
   *
   * Same fix, and the same reasoning, as `NameAvatar` in the site: an effect runs after
   * the paint, so anything an effect corrects has already been seen.
   *
   * Records this name has already given us go straight back, so returning to a name is
   * instant and only a first visit waits. Keyed by node, so this can never hand back a
   * different name's records — the failure it exists to prevent.
   */
  const [asked, setAsked] = useState(node);
  if (asked !== node) {
    setAsked(node);
    setPrefill((node && cache.get(node)) || null);
  }

  const load = useCallback(async () => {
    current.current = node;
    if (!node || !client || !L2_REGISTRY_ADDRESS) return;
    setLoading(true);
    try {
      const results = await client.multicall({
        contracts: [
          ...TEXT_KEYS.map(
            (k) =>
              ({
                address: L2_REGISTRY_ADDRESS!,
                abi: registryAbi,
                functionName: "text",
                args: [node, k],
              }) as const
          ),
          ...[ETH, BTC, SOL].map(
            (coin) =>
              ({
                address: L2_REGISTRY_ADDRESS!,
                abi: registryAbi,
                functionName: "addr",
                args: [node, coin],
              }) as const
          ),
        ],
        allowFailure: true,
        // viem splits a batch past 1024 bytes of calldata and the split is invisible.
        // Pinned so this stays one request with one failure mode.
        batchSize: 0,
      });

      // Every entry failing is a dead transport, not a name with no records — the same
      // shape of lie the gateway outage produced. Say nothing rather than say empty.
      if (results.every((r) => r.status === "failure")) {
        if (current.current === node) setPrefill(cache.get(node) ?? null);
        return;
      }

      const text = (i: number) =>
        results[i].status === "success" ? ((results[i].result as string) ?? "") : "";

      const ethAddr = results[TEXT_KEYS.length];

      const fresh: Prefill = {
        avatar: text(0),
        bio: text(1),
        website: text(2),
        x: text(3),
        github: text(4),
        // Only the EVM address is decoded back to hex — BTC and SOL are stored in their
        // own binary encodings and turning those back into strings needs the coder set
        // the manage page carries. Not worth the bundle here: someone who wants them on
        // the site can paste them, and the field is right there.
        ethAddress:
          ethAddr?.status === "success" && ethAddr.result && (ethAddr.result as string) !== "0x"
            ? bytesToHex(hexToBytes(ethAddr.result as `0x${string}`))
            : "",
      };
      // Cached whatever happened next: these really are this node's records, so they are
      // worth keeping even if the answer arrived too late to show.
      cache.set(node, fresh);
      if (current.current === node) setPrefill(fresh);
    } catch {
      // Keep whatever this name last gave us. A read that didn't happen is not a name
      // whose records vanished.
      if (current.current === node) setPrefill((node && cache.get(node)) || null);
    } finally {
      if (current.current === node) setLoading(false);
    }
  }, [node, client]);

  useEffect(() => {
    void load();
  }, [load]);

  return { prefill, loading };
}
