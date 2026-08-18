"use client";

import { useCallback, useEffect, useState } from "react";
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

  const load = useCallback(async () => {
    // Drop the previous name's records BEFORE the new read starts. Without this the
    // hook keeps answering with the last name's data while the next read is in flight,
    // and the editor happily prefills one name's avatar and bio onto another — which
    // looks exactly like "it shows the wrong avatar".
    setPrefill(null);

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
        setPrefill(null);
        return;
      }

      const text = (i: number) =>
        results[i].status === "success" ? ((results[i].result as string) ?? "") : "";

      const ethAddr = results[TEXT_KEYS.length];

      setPrefill({
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
      });
    } catch {
      setPrefill(null);
    } finally {
      setLoading(false);
    }
  }, [node, client]);

  useEffect(() => {
    void load();
  }, [load]);

  return { prefill, loading };
}
