"use client";

import { useEffect, useState } from "react";
import { zeroAddress } from "viem";
import { useReadContract } from "wagmi";
import { robinhoodChain } from "@/lib/chains";
import { REGISTRAR_ADDRESS, registrarAbi } from "@/lib/contracts";
import { VOUCHER_URL } from "@/lib/site";

/**
 * Whether short-name credit vouchers are closed: true once the HoodFi Safe has set
 * `creditSigner` to the zero address, after which `mintShortWithVoucher` reverts
 * `SignerNotConfigured` for everyone.
 *
 * Read from the registrar, not the gateway. The gateway keeps its signing key (it also
 * signs CCIP answers) and would happily keep issuing vouchers nobody can use, so it
 * isn't the authority here. `undefined` while the read is in flight or failed: callers
 * must treat that as "don't know", never as open.
 */
export function useCreditsClosed(): boolean | undefined {
  const { data } = useReadContract({
    address: REGISTRAR_ADDRESS,
    abi: registrarAbi,
    functionName: "creditSigner",
    chainId: robinhoodChain.id,
    query: { enabled: Boolean(REGISTRAR_ADDRESS), staleTime: 5 * 60_000 },
  });
  if (data === undefined) return undefined;
  return data.toLowerCase() === zeroAddress;
}

/**
 * Unused credits for `address`, from the gateway's voucher endpoint (which reads the
 * mainnet donation total and subtracts `creditsSpent` on Robinhood Chain). 0 for a
 * non-donor; null when unknown (no address, still loading, or the gateway failed).
 */
export function useUnusedCredits(address: string | undefined, enabled: boolean): number | null {
  const [credits, setCredits] = useState<number | null>(null);
  useEffect(() => {
    setCredits(null);
    if (!enabled || !address) return;
    let cancelled = false;
    fetch(`${VOUCHER_URL}/${address}`)
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        // 404 = "No short-name credits": a definite zero. Anything else non-OK is unknown.
        if (res.status === 404) return setCredits(0);
        if (!res.ok || json?.creditsAvailable == null) return;
        setCredits(Number(json.creditsAvailable));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [address, enabled]);
  return credits;
}
