"use client";

import Link from "next/link";
import { useReadContract } from "wagmi";
import { mainnet } from "wagmi/chains";
import { DONATIONS_ADDRESS, donationsAbi } from "@/lib/contracts";
import { expiryYear } from "@/lib/format";
import { TIER_USD } from "@/lib/labels";
import { GOAL_YEAR_LABEL, RENEWAL_BLOCK_YEARS } from "@/lib/site";
import { ArrowNE } from "./ArrowNE";
import { CenturyRuler } from "./CenturyRuler";

const STEPS = [
  `Short names are on sale. One character is $${TIER_USD[0]}, two are $${TIER_USD[1]}, three are $${TIER_USD[2]} — paid once, in USDG or ETH.`,
  `The Safe renews the parent. Every month the HoodFi 2-of-3 Safe adds ${RENEWAL_BLOCK_YEARS} years to hoodfi.eth through ENS's own renewer, paid in USDC.`,
  "Credits still count. Every credit earned by donating before ENSv2 mints a 1–3 character name free, before or after the sale.",
];

/**
 * Section 04 — short names and the parent name's renewal, as one ink panel.
 *
 * Progress is the expiry itself, not the donation counter. The Safe renews outside the
 * donation contract, so `totalYearsDonated` stopped moving when donations closed and
 * would show a stalled drive while the name was being carried forward. Credits issued
 * is still that counter, because credits were only ever earned by donating.
 */
export function FundTheCentury() {
  const enabled = Boolean(DONATIONS_ADDRESS);

  const { data: expiry } = useReadContract({
    address: DONATIONS_ADDRESS,
    abi: donationsAbi,
    functionName: "nameExpires",
    chainId: mainnet.id,
    query: { enabled, refetchInterval: 60_000 },
  });

  const { data: totalYears } = useReadContract({
    address: DONATIONS_ADDRESS,
    abi: donationsAbi,
    functionName: "totalYearsDonated",
    chainId: mainnet.id,
    query: { enabled, staleTime: 300_000 },
  });

  const year = expiryYear(expiry);
  const yearsToGo = year === undefined ? undefined : Math.max(0, GOAL_YEAR_LABEL - year);

  const stats: { label: string; value: string; lime?: boolean }[] = [
    { label: "secured to", value: year?.toString() ?? "—", lime: true },
    { label: "years to go", value: yearsToGo?.toLocaleString("en-US") ?? "—" },
    {
      label: "credits issued",
      value: totalYears === undefined ? "—" : Number(totalYears).toLocaleString("en-US"),
    },
  ];

  return (
    <div className="on-ink mt-6 px-[clamp(24px,4vw,48px)] py-[clamp(32px,5vw,56px)]">
      <div className="duo items-start">
        <div>
          <h2 className="h-panel m-0 text-[var(--fg)]">Short names are open.</h2>
          <p className="lede mt-[22px] max-w-[42ch]">
            x, og and gme are on public sale from ${TIER_USD[2]}. And hoodfi.eth is renewed
            by its own Safe, {RENEWAL_BLOCK_YEARS} years every month, until it reaches{" "}
            {GOAL_YEAR_LABEL}.
          </p>
          <div className="mt-9 flex flex-wrap gap-2.5">
            <Link href="/mint/" className="btn btn-lime">
              Mint a short name <ArrowNE />
            </Link>
            <Link href="/short-names/" className="btn btn-ghost">
              The renewal pledge
            </Link>
          </div>
        </div>

        <div>
          <div className="cells border-y border-[var(--line-card)]">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex-[1_1_120px] border-l border-[var(--line)] px-[18px] py-[22px]"
              >
                <div className="label">{stat.label}</div>
                <div
                  className="mt-3 text-[34px] font-extrabold leading-none tracking-[-0.03em]"
                  style={{ color: stat.lime ? "var(--lime)" : "var(--fg)" }}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-9">
            <CenturyRuler />
          </div>

          <div className="mt-9 border-t border-[var(--line-card)]">
            {STEPS.map((text, i) => (
              <div
                key={text}
                className="grid grid-cols-[44px_1fr] gap-3.5 border-b border-[var(--line-soft)] py-4"
              >
                <span className="data text-[11px] tracking-[0.1em]" style={{ color: "var(--lime)" }}>
                  0{i + 1}
                </span>
                <span className="text-[14.5px] leading-[1.55] text-[rgba(241,241,234,0.8)]">
                  {text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
