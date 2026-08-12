"use client";

import { useReadContract } from "wagmi";
import { mainnet } from "wagmi/chains";
import { DONATIONS_ADDRESS, donationsAbi } from "@/lib/contracts";
import { GOAL_YEAR_LABEL, START_YEAR } from "@/lib/site";
import { expiryYear } from "@/lib/format";

const SPAN = GOAL_YEAR_LABEL - START_YEAR; // a century across the track

/**
 * The century: 2026 to 2127, with hoodfi.eth's live expiry as the filled portion.
 *
 * The figure is read from the official .eth registrar through the donation contract's
 * `nameExpires`, not from a counter we keep — donations visibly push the fill right,
 * and if the read fails the bar stays empty rather than inventing progress.
 *
 * Ten decade labels sit under the bar, each opened by its own hairline. They are
 * `grid-template-columns: repeat(10, 1fr)` rather than absolute positions, so the
 * marks stay evenly spaced at every width without a media query.
 */
export function CenturyRuler() {
  const enabled = Boolean(DONATIONS_ADDRESS);

  const { data: expiry } = useReadContract({
    address: DONATIONS_ADDRESS,
    abi: donationsAbi,
    functionName: "nameExpires",
    chainId: mainnet.id,
    query: { enabled, refetchInterval: 30_000 },
  });

  const markerYear = expiryYear(expiry);
  const pct = markerYear
    ? Math.min(100, Math.max(0, ((markerYear - START_YEAR) / SPAN) * 100))
    : 0;

  const decades = Array.from({ length: 10 }, (_, i) => START_YEAR + i * 10);

  return (
    <div>
      <div className="data flex justify-between text-[11px] uppercase tracking-[0.14em] text-[var(--label)]">
        <span>{START_YEAR}</span>
        <span>100-year goal · {GOAL_YEAR_LABEL}</span>
      </div>
      <div
        className="ruler-box mt-2.5"
        role="img"
        aria-label={
          markerYear
            ? `hoodfi.eth expires in ${markerYear}; the goal is ${GOAL_YEAR_LABEL}`
            : "hoodfi.eth expiry is still loading"
        }
      >
        <div className="ruler-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2.5 grid grid-cols-10">
        {decades.map((year) => (
          <span key={year} className="ruler-decade">
            {year}
          </span>
        ))}
      </div>
    </div>
  );
}
