"use client";

import { useReadContracts } from "wagmi";
import { robinhoodChain } from "@/lib/chains";
import { SITES_ADDRESS, USDG_ADDRESS, erc20Abi } from "@/lib/contracts";

export type UsdgState =
  | { status: "unconfigured" }
  | { status: "loading" }
  | { status: "unreachable" }
  | { status: "ok"; balance: bigint; allowance: bigint };

/**
 * What this wallet holds in USDG, and how much of it the paywall may already spend.
 *
 * Both in one batch so the two can never be read a block apart — an allowance from one
 * block beside a balance from another is how a panel decides an approve is unnecessary
 * and then fails the transfer.
 *
 * `unreachable` never collapses into zero. A failed read reported as "no balance" would
 * tell somebody holding USDG to go and buy some, which is the same lie as reporting a
 * throttled RPC as an unregistered name — a mistake this repo has made before.
 */
export function useUsdg(owner: `0x${string}` | undefined): UsdgState {
  const enabled = Boolean(USDG_ADDRESS && SITES_ADDRESS && owner);

  const { data, isError } = useReadContracts({
    contracts:
      USDG_ADDRESS && SITES_ADDRESS && owner
        ? [
            {
              address: USDG_ADDRESS,
              abi: erc20Abi,
              functionName: "balanceOf" as const,
              args: [owner] as const,
              chainId: robinhoodChain.id,
            },
            {
              address: USDG_ADDRESS,
              abi: erc20Abi,
              functionName: "allowance" as const,
              args: [owner, SITES_ADDRESS] as const,
              chainId: robinhoodChain.id,
            },
          ]
        : [],
    query: { enabled, staleTime: 15_000, retry: 1 },
  });

  if (!USDG_ADDRESS || !SITES_ADDRESS) return { status: "unconfigured" };
  if (!enabled) return { status: "loading" };
  if (isError) return { status: "unreachable" };
  if (!data) return { status: "loading" };

  const [balance, allowance] = data;
  // allowFailure defaults to true, so a single reverting read arrives as a failure entry
  // rather than throwing. Either one missing means we do not know the answer — and the
  // disabled branch above passes no contracts at all, so the pair can be absent entirely.
  if (
    !balance ||
    !allowance ||
    balance.status !== "success" ||
    allowance.status !== "success"
  ) {
    return { status: "unreachable" };
  }

  return {
    status: "ok",
    balance: balance.result as bigint,
    allowance: allowance.result as bigint,
  };
}
