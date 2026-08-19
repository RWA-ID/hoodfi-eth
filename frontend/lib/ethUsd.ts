"use client";

import { useReadContract } from "wagmi";
import { robinhoodChain } from "@/lib/chains";
import { ETH_USD_FEED, ETH_USD_HEARTBEAT_SECONDS, aggregatorV3Abi } from "@/lib/contracts";

/**
 * How old a Chainlink answer may be before we stop quoting dollars from it.
 *
 * Derived from the feed's published heartbeat rather than from watching it: this feed
 * writes on a 0.5% deviation OR every 24 hours, whichever comes first, so a quiet
 * market legitimately leaves the last answer most of a day old. Anything tighter
 * rejects a perfectly healthy price and blanks the dollar figure for no reason —
 * the USDG feed on this chain was observed 7.2 hours stale while working correctly.
 *
 * The two hours on top are grace for the write itself landing late.
 */
const MAX_ANSWER_AGE_SECONDS = ETH_USD_HEARTBEAT_SECONDS + 2 * 60 * 60;

/**
 * Live ETH/USD, or undefined when we cannot vouch for it.
 *
 * Undefined is a first-class answer here, not an error state — every caller has to
 * render sensibly without it, because a dollar figure carried over from a stale or
 * missing answer is exactly the failure this whole exercise is meant to remove. A
 * missing price shows the ETH amount alone, which is always true.
 */
export function useEthUsd(): number | undefined {
  const { data } = useReadContract({
    address: ETH_USD_FEED,
    abi: aggregatorV3Abi,
    functionName: "latestRoundData",
    chainId: robinhoodChain.id,
    query: { refetchInterval: 60_000, staleTime: 30_000 },
  });

  // Read the scale rather than assume it. Getting this wrong misplaces the decimal
  // point by a factor of 100 and the result still looks like a plausible price, so
  // it is the one thing here that must not be a constant. It never changes for a
  // given feed, hence no refetch.
  const { data: decimals } = useReadContract({
    address: ETH_USD_FEED,
    abi: aggregatorV3Abi,
    functionName: "decimals",
    chainId: robinhoodChain.id,
    query: { staleTime: Infinity, gcTime: Infinity },
  });

  if (!data || decimals === undefined) return undefined;
  const [, answer, , updatedAt] = data;
  if (answer <= 0n) return undefined;

  const age = Math.floor(Date.now() / 1000) - Number(updatedAt);
  if (age > MAX_ANSWER_AGE_SECONDS) return undefined;

  return Number(answer) / 10 ** decimals;
}

/**
 * A wei amount as a dollar string, or undefined when there is no trustworthy rate.
 *
 * Deliberately returns undefined rather than a fallback: see useEthUsd.
 */
export function weiToUsd(wei: bigint | undefined, ethUsd: number | undefined): string | undefined {
  if (wei === undefined || ethUsd === undefined) return undefined;
  const usd = (Number(wei) / 1e18) * ethUsd;
  return `$${usd.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
