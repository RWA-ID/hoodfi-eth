"use client";

import { useCallback, useEffect, useState } from "react";
import { type Address, parseAbiItem, toHex } from "viem";
import { usePublicClient } from "wagmi";
import { L2_DEPLOY_BLOCK, L2_REGISTRY_ADDRESS, registryAbi } from "@/lib/contracts";
import { dnsDecodeName, labelFromName } from "@/lib/ens";
import { robinhoodChain } from "@/lib/chains";

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
);

export type OwnedName = {
  label: string;
  name: string;
  node: `0x${string}`;
  tokenId: bigint;
};

export type MyNamesState = {
  names: OwnedName[];
  loading: boolean;
  /** Set only when we could not find out. Never set to mean "you own none". */
  error: string | null;
  reload: () => void;
};

/**
 * Names currently held by an address.
 *
 * The registry is a plain ERC-721 with no Enumerable extension, so there is no
 * `tokenOfOwnerByIndex`. We collect every Transfer *to* the address, then re-check
 * `ownerOf` — that second step matters, because a name they minted and later sold
 * would otherwise still show up as theirs.
 *
 * The site's copy of this hook swallows a per-token read failure and moves on, which is
 * right there: a missing row on a management page is a cosmetic bug. Here it is not.
 * This list decides which names a visitor is allowed to pay to publish on, so a
 * throttled RPC that quietly drops a name tells someone they don't own something they
 * do — and the fix they'll reach for is to buy it again. Every failure mode below
 * either produces the truth or says it couldn't.
 */
export function useMyNames(address: Address | undefined): MyNamesState {
  const client = usePublicClient({ chainId: robinhoodChain.id });
  const [names, setNames] = useState<OwnedName[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address || !client || !L2_REGISTRY_ADDRESS) {
      setNames([]);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const logs = await client.getLogs({
        address: L2_REGISTRY_ADDRESS,
        event: transferEvent,
        args: { to: address },
        fromBlock: L2_DEPLOY_BLOCK,
        toBlock: "latest",
      });

      const tokenIds = [
        ...new Set(
          logs
            .map((log) => log.args.tokenId)
            .filter((id): id is bigint => id !== undefined)
            .map((id) => id.toString())
        ),
      ].map((id) => BigInt(id));

      if (tokenIds.length === 0) {
        setNames([]);
        return;
      }

      // Two reads per token, one round trip. Multicall3 is deployed on Robinhood Chain
      // at the canonical address, and viem batches through it automatically.
      const calls = tokenIds.flatMap((tokenId) => {
        const node = toHex(tokenId, { size: 32 });
        return [
          {
            address: L2_REGISTRY_ADDRESS!,
            abi: registryAbi,
            functionName: "ownerOf",
            args: [tokenId],
          } as const,
          {
            address: L2_REGISTRY_ADDRESS!,
            abi: registryAbi,
            functionName: "names",
            args: [node],
          } as const,
        ];
      });

      const results = await client.multicall({
        contracts: calls,
        allowFailure: true,
        // viem splits a batch once calldata passes 1024 bytes, and a split is invisible.
        // Pinned so a wallet holding many names stays one request with one failure mode.
        batchSize: 0,
      });

      // `allowFailure: true` cannot tell a reverted call from a transport that never
      // answered — a dead RPC comes back as every entry failed, which is exactly what
      // "you own nothing" looks like. A token we just saw a Transfer for does exist, so
      // a total wipeout is the network, not the truth.
      if (results.every((r) => r.status === "failure")) {
        throw new Error("every read failed");
      }

      const owned: OwnedName[] = [];
      let partial = false;

      tokenIds.forEach((tokenId, i) => {
        const ownerResult = results[i * 2];
        const nameResult = results[i * 2 + 1];

        if (ownerResult.status === "failure" || nameResult.status === "failure") {
          // A burned token reverts here too, but we cannot tell that apart from a read
          // that didn't land. Say the list is incomplete rather than pick one.
          partial = true;
          return;
        }

        const owner = ownerResult.result as Address;
        if (owner.toLowerCase() !== address.toLowerCase()) return; // sold on — not ours

        const name = dnsDecodeName(nameResult.result as string);
        if (!name) return;

        owned.push({
          label: labelFromName(name),
          name,
          node: toHex(tokenId, { size: 32 }),
          tokenId,
        });
      });

      owned.sort((a, b) => a.label.localeCompare(b.label));
      setNames(owned);
      setError(
        partial ? "Some names couldn't be read just now. Reload to see the full list." : null
      );
    } catch {
      // Leave whatever we last knew on screen; an empty list here would be a lie.
      setError("Couldn't reach Robinhood Chain to read your names. Try again.");
    } finally {
      setLoading(false);
    }
  }, [address, client]);

  useEffect(() => {
    void load();
  }, [load]);

  return { names, loading, error, reload: load };
}
