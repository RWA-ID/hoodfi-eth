"use client";

import { useCallback, useEffect, useState } from "react";
import { type Address, parseAbiItem, toHex } from "viem";
import { usePublicClient } from "wagmi";
import { L2_REGISTRY_ADDRESS, registryAbi } from "@/lib/contracts";
import { dnsDecodeName, labelFromName } from "@/lib/ens";
import { robinhoodChain } from "@/lib/chains";

const DEPLOY_BLOCK = BigInt(process.env.NEXT_PUBLIC_L2_DEPLOY_BLOCK ?? "0");

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
);

export type OwnedName = {
  label: string;
  name: string;
  node: `0x${string}`;
  tokenId: bigint;
};

/**
 * Names currently held by an address.
 *
 * The registry is a plain ERC-721 with no Enumerable extension, so there is no
 * `tokenOfOwnerByIndex` to call. We collect every Transfer *to* the address and then
 * re-check `ownerOf` for each — that second step matters, because a name they minted
 * and later sold would otherwise still show up as theirs.
 */
export function useMyNames(address: Address | undefined) {
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
        fromBlock: DEPLOY_BLOCK,
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

      const owned: OwnedName[] = [];
      for (const tokenId of tokenIds) {
        const node = toHex(tokenId, { size: 32 });
        try {
          const owner = await client.readContract({
            address: L2_REGISTRY_ADDRESS,
            abi: registryAbi,
            functionName: "ownerOf",
            args: [tokenId],
          });
          if (owner.toLowerCase() !== address.toLowerCase()) continue;

          const encoded = await client.readContract({
            address: L2_REGISTRY_ADDRESS,
            abi: registryAbi,
            functionName: "names",
            args: [node],
          });
          const name = dnsDecodeName(encoded);
          if (!name) continue;
          owned.push({ label: labelFromName(name), name, node, tokenId });
        } catch {
          // Burned or unreadable token — skip it rather than failing the whole list.
        }
      }

      owned.sort((a, b) => a.label.localeCompare(b.label));
      setNames(owned);
    } catch {
      setError("Couldn't load your names. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [address, client]);

  useEffect(() => {
    void load();
  }, [load]);

  return { names, loading, error, reload: load };
}
