"use client";

import { useReadContract } from "wagmi";
import { mainnet } from "wagmi/chains";
import { DONATIONS_ADDRESS, donationsAbi } from "@/lib/contracts";
import { GOAL_YEARS, GOAL_YEAR_LABEL, START_YEAR } from "@/lib/site";
import { expiryDate, expiryYear } from "@/lib/format";

const SPAN = GOAL_YEAR_LABEL - START_YEAR; // a century across the track

/**
 * The century ruler: 2026 to 2127. The green marker is hoodfi.eth's live expiry,
 * read straight from the official .eth registrar — donations visibly push it right.
 */
export function CenturyRuler() {
  const enabled = Boolean(DONATIONS_ADDRESS);

  const { data: totalYears } = useReadContract({
    address: DONATIONS_ADDRESS,
    abi: donationsAbi,
    functionName: "totalYearsDonated",
    chainId: mainnet.id,
    query: { enabled, refetchInterval: 30_000 },
  });

  const { data: expiry } = useReadContract({
    address: DONATIONS_ADDRESS,
    abi: donationsAbi,
    functionName: "nameExpires",
    chainId: mainnet.id,
    query: { enabled, refetchInterval: 30_000 },
  });

  const years = Number(totalYears ?? 0n);
  const markerYear = expiryYear(expiry) ?? START_YEAR + 1;
  const pct = Math.min(100, Math.max(0.5, ((markerYear - START_YEAR) / SPAN) * 100));

  // Quarter-century labels with 5-year minors. On phones only the two ends and the
  // midpoint keep labels — five of them collide at 390px.
  const KEEP_ON_MOBILE = new Set([START_YEAR, START_YEAR + 50, GOAL_YEAR_LABEL]);
  const ticks: { pos: number; label?: string; minor?: boolean; mobileHide?: boolean }[] = [];
  for (let y = START_YEAR; y <= GOAL_YEAR_LABEL; y += 25) {
    const year = Math.min(y, GOAL_YEAR_LABEL);
    ticks.push({
      pos: ((year - START_YEAR) / SPAN) * 100,
      label: `${year}`,
      mobileHide: !KEEP_ON_MOBILE.has(year),
    });
  }
  for (let y = START_YEAR + 5; y < GOAL_YEAR_LABEL; y += 5) {
    ticks.push({ pos: ((y - START_YEAR) / SPAN) * 100, minor: true });
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <span className="live-dot" aria-hidden />
            live from the .eth registrar
          </div>
          <div className="data mt-2 text-4xl font-semibold sm:text-5xl">
            {years.toLocaleString()}
            <span className="text-[var(--faint)]"> / {GOAL_YEARS.toLocaleString()}</span>
          </div>
          <div className="mt-1 text-sm text-[var(--dim)]">years donated toward the goal</div>
        </div>
        <div className="text-right">
          <div className="data text-lg text-[var(--paper)]">{expiryDate(expiry)}</div>
          <div className="mt-1 text-sm text-[var(--dim)]">
            {enabled ? "current hoodfi.eth expiry" : "donations open soon"}
          </div>
        </div>
      </div>

      <div className="ruler-track mt-8" role="img" aria-label={`hoodfi.eth expires in ${markerYear}; goal is ${GOAL_YEAR_LABEL}`}>
        <div className="ruler-progress" style={{ width: `${pct}%` }} />
        {ticks.map((t, i) => (
          <div key={i}>
            <div className={`ruler-tick ${t.minor ? "minor" : ""}`} style={{ left: `${t.pos}%` }} />
            {t.label && (
              <div
                className={`ruler-tick-label ${t.mobileHide ? "mobile-hide" : ""}`}
                style={{
                  left: `${t.pos}%`,
                  transform: t.pos === 0 ? "none" : t.pos === 100 ? "translateX(-100%)" : undefined,
                }}
              >
                {t.label}
              </div>
            )}
          </div>
        ))}
        <div className="ruler-marker" style={{ left: `${pct}%` }}>
          <div className="ruler-marker-line" />
        </div>
        {/* Label positioned independently so it can clamp to the container edges */}
        <div
          className="data absolute top-[46px] whitespace-nowrap text-xs ok"
          style={{
            left: `clamp(0px, calc(${pct}% - 24px), calc(100% - 56px))`,
          }}
        >
          ▲ {markerYear}
        </div>
      </div>
    </div>
  );
}
