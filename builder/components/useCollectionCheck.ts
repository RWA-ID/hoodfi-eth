"use client";

import { useEffect, useState } from "react";
import { getAddress, isAddress } from "viem";
import { l2Client } from "@/lib/wagmi";

/** ERC-165 interface id for ERC-721. */
const ERC721_INTERFACE = "0x80ac58cd" as const;

const collectionAbi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "supportsInterface",
    stateMutability: "view",
    inputs: [{ type: "bytes4" }],
    outputs: [{ type: "bool" }],
  },
] as const;

export type CollectionInfo = {
  address: `0x${string}`;
  name: string;
  symbol: string;
  supply: string | null;
};

export type CheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok"; info: CollectionInfo }
  | { status: "invalid"; reason: string }
  | { status: "unreachable" };

/**
 * Reads a pasted collection address off Robinhood Chain and reports what it is.
 *
 * Worth doing rather than trusting the paste, because this address is the one field a
 * submission cannot recover from being wrong about: it becomes the on-chain gate, so a
 * typo silently locks out every holder the template was meant for, and the failure shows
 * up as "nobody can use our template" long after anyone remembers what was typed.
 *
 * `unreachable` is a distinct state from `invalid` on purpose. Reporting a throttled RPC
 * as "not a valid collection" is the same class of lie this repo has been bitten by more
 * than once — a read that did not happen is not a read that returned no.
 */
export function useCollectionCheck(raw: string): CheckState {
  const [state, setState] = useState<CheckState>({ status: "idle" });

  useEffect(() => {
    const value = raw.trim();
    if (!value) {
      setState({ status: "idle" });
      return;
    }
    if (!isAddress(value)) {
      setState({ status: "invalid", reason: "That isn't a contract address." });
      return;
    }

    let cancelled = false;
    const address = getAddress(value);
    setState({ status: "checking" });

    // Debounced: this fires per keystroke on a paste-heavy field.
    const timer = setTimeout(async () => {
      try {
        const code = await l2Client.getCode({ address });
        if (cancelled) return;
        if (!code || code === "0x") {
          setState({
            status: "invalid",
            reason: "Nothing is deployed at that address on Robinhood Chain.",
          });
          return;
        }

        const [isErc721, name, symbol, supply] = await l2Client.multicall({
          contracts: [
            { address, abi: collectionAbi, functionName: "supportsInterface", args: [ERC721_INTERFACE] },
            { address, abi: collectionAbi, functionName: "name" },
            { address, abi: collectionAbi, functionName: "symbol" },
            { address, abi: collectionAbi, functionName: "totalSupply" },
          ],
          allowFailure: true,
          batchSize: 0,
        });
        if (cancelled) return;

        // Every entry failing is what a dead transport looks like, and it is
        // indistinguishable from four reverts. The contract exists — we just read its
        // code — so a total wipeout here is the network, not the contract.
        if (
          isErc721.status === "failure" &&
          name.status === "failure" &&
          symbol.status === "failure" &&
          supply.status === "failure"
        ) {
          setState({ status: "unreachable" });
          return;
        }

        if (isErc721.status === "success" && isErc721.result === false) {
          setState({
            status: "invalid",
            reason: "That contract doesn't report itself as an ERC-721 collection.",
          });
          return;
        }

        setState({
          status: "ok",
          info: {
            address,
            // A collection that doesn't implement name/symbol is unusual but not wrong,
            // and refusing it over a missing string would be pedantry.
            name: name.status === "success" ? (name.result as string) : "Unnamed collection",
            symbol: symbol.status === "success" ? (symbol.result as string) : "",
            supply: supply.status === "success" ? String(supply.result) : null,
          },
        });
      } catch {
        if (!cancelled) setState({ status: "unreachable" });
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [raw]);

  return state;
}
