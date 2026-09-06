"use client";

import { useCallback, useState } from "react";
import { useAccount, useConfig, useWriteContract } from "wagmi";
import { getWalletClient } from "@wagmi/core";
import type { Hex } from "viem";
import { AUTH_CONNECTOR_ID } from "./session";

/**
 * `useWriteContract`, minus the one call the embedded wallet cannot answer.
 *
 * THE BUG (reown-com/appkit#5764). AppKit's email/social wallet answers
 * `eth_chainId` with the CAIP-2 string `"eip155:4663"` instead of a hex quantity,
 * and viem parses that reply on the way to every signature:
 *
 *   sendTransaction  `if (chain !== null)` → getChainId action
 *   getChainId       → hexToNumber(reply)
 *   hexToNumber      → hexToBigInt
 *   hexToBigInt      → BigInt("eip155:4663")   ✗ SyntaxError
 *
 * It reaches the page as `ContractFunctionExecutionError: An unknown error occurred`,
 * which points nowhere near the cause. viem never reaches `assertCurrentChain`, so the
 * app's own chain value is not the problem — the wallet's reply is. `chain: null` skips
 * both the assertion and the `eth_chainId` round trip that precedes it.
 *
 * NOT limited to custom chains: the same failure was reproduced on Ethereum mainnet,
 * where JavaScriptCore words it "Failed to parse String to BigInt" and V8 says "Cannot
 * convert eip155:1 to a BigInt". Same line, two engines.
 *
 * WHY A WRAPPER AND NOT A ONE-LINE FIX. wagmi's `writeContract` computes the chain
 * itself and never passes null:
 *
 *   const chain = (!chainId || client.chain?.id === chainId)
 *     ? client.chain : { id: chainId };
 *
 * and viem calls `getChainId()` whenever `chain !== null` — `assertChainId` only gates
 * the assertion, not the call. So there is no argument to `writeContractAsync` that
 * avoids it. The only route is to skip wagmi's action and drive viem's wallet client
 * directly, which is what this does.
 *
 * Only for the AUTH connector. Every other wallet keeps wagmi's normal path and viem's
 * wrong-chain assertion, which is a real check here: this app names Robinhood Chain on
 * every write precisely because an injected wallet can genuinely be sitting on mainnet,
 * and that assertion is what catches it. Losing it for an embedded wallet costs nothing
 * — SocialDefaultNetwork is unnecessary because `defaultNetwork` is already 4663, and
 * an embedded wallet has no chain of its own to be wrong about.
 *
 * Drop-in: same `{ writeContractAsync, data, isPending, error }` shape, so a call site
 * changes only which hook it calls. Delete this file when #5764 is fixed upstream.
 *
 * Kept in step with frontend/lib/useWriteContractCompat.ts.
 */

type Wagmi = ReturnType<typeof useWriteContract>;
type WriteArgs = Parameters<Wagmi["writeContractAsync"]>[0];

export function useWriteContractCompat(): Wagmi {
  const wagmi = useWriteContract();
  const config = useConfig();
  const { address, connector } = useAccount();

  const [data, setData] = useState<Hex | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isEmbedded =
    connector?.id === AUTH_CONNECTOR_ID || connector?.type === AUTH_CONNECTOR_ID;

  const writeContractAsync = useCallback(
    async (args: WriteArgs) => {
      setIsPending(true);
      setError(null);
      try {
        // `chainId` selects which client to fetch; it must NOT be forwarded as a
        // contract argument, and it is what wagmi would have turned back into a
        // non-null chain.
        const { chainId, ...rest } = args as WriteArgs & { chainId?: number };
        const wallet = await getWalletClient(config, {
          account: address,
          ...(chainId ? { chainId } : {}),
        });
        const hash = await wallet.writeContract({
          ...(rest as Parameters<typeof wallet.writeContract>[0]),
          account: address ?? null,
          chain: null,
        });
        setData(hash);
        return hash;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [config, address],
  );

  if (!isEmbedded) return wagmi;

  return {
    ...wagmi,
    writeContractAsync: writeContractAsync as Wagmi["writeContractAsync"],
    data,
    isPending,
    error,
  } as Wagmi;
}
