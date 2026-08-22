"use client";

import { keccak256, stringToBytes } from "viem";
import { useReadContract } from "wagmi";
import { robinhoodChain } from "@/lib/chains";
import { SITES_ADDRESS, sitesAbi } from "@/lib/contracts";
import type { TemplateId } from "@/lib/templates/index.ts";

export type Quote = {
  weiPrice: bigint;
  usdgPrice: bigint;
  eligible: boolean;
  publishCount: bigint;
};

export type QuoteState =
  | { status: "unconfigured" }
  | { status: "loading" }
  | { status: "unreachable" }
  | { status: "ok"; quote: Quote };

export function templateHash(templateId: TemplateId): `0x${string}` {
  return keccak256(stringToBytes(templateId));
}

/**
 * What this name would pay to publish this template, right now.
 *
 * One `quote()` call rather than four reads, which is what the contract asks for: a
 * frontend that assembled the price from one call and the eligibility from another could
 * show a price from one block beside an answer from a different one.
 *
 * Deliberately `useReadContract` rather than an effect holding state. The query is keyed
 * on the arguments, so changing name or template makes `data` undefined until the new
 * answer lands — it never serves the previous name's price under the new name's heading.
 * That is the after-the-paint effect trap this repo has now hit twice (`useNameRecords`,
 * `NameAvatar`), and here it would put a wrong number next to a payment button.
 *
 * `unreachable` is its own state and never collapses into a price. A throttled RPC
 * reported as "free" is the same class of lie as a failed read reported as "you own
 * nothing" — and this one would be read as an invitation to publish for nothing.
 */
export function useQuote(
  node: `0x${string}` | undefined,
  templateId: TemplateId,
  buyer: `0x${string}` | undefined
): QuoteState {
  const enabled = Boolean(SITES_ADDRESS && node && buyer);

  const { data, isError } = useReadContract({
    address: SITES_ADDRESS,
    abi: sitesAbi,
    functionName: "quote",
    args: node && buyer ? [node, templateHash(templateId), buyer] : undefined,
    chainId: robinhoodChain.id,
    query: {
      enabled,
      // The price is owner-set and changes rarely, but a stale one here is a number
      // beside a payment button. Cheap to keep honest.
      staleTime: 30_000,
      retry: 1,
    },
  });

  if (!SITES_ADDRESS) return { status: "unconfigured" };
  if (!enabled) return { status: "loading" };
  if (isError) return { status: "unreachable" };
  if (!data) return { status: "loading" };

  const [weiPrice, usdgPrice, eligible, publishCount] = data as readonly [
    bigint,
    bigint,
    boolean,
    bigint,
  ];
  return { status: "ok", quote: { weiPrice, usdgPrice, eligible, publishCount } };
}
