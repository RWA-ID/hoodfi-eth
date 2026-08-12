"use client";

import Link from "next/link";
import { useReadContract } from "wagmi";
import { mainnet } from "wagmi/chains";
import { DONATIONS_ADDRESS, donationsAbi } from "@/lib/contracts";
import { GOAL_YEARS } from "@/lib/site";
import { CenturyRuler } from "./CenturyRuler";

const STEPS = [
  "Donate a year. Your ETH goes straight to the official ENS controller inside your own transaction — the contract cannot hold funds.",
  "Earn a credit. Credits accrue on mainnet against your address and are readable by anyone.",
  "Spend it. The registrar verifies a signed attestation of your balance and mints a 1–3 character name free. No bridge involved.",
];

/**
 * Section 03 — the donation drive, as one ink panel.
 *
 * Years funded and credits issued are the same number by construction (one credit per
 * year donated), but both are shown because they answer different questions: one is
 * how long the parent name is safe for, the other is how much premium inventory is
 * spoken for. Both are read from mainnet.
 */
export function FundTheCentury() {
  const enabled = Boolean(DONATIONS_ADDRESS);

  const { data: totalYears } = useReadContract({
    address: DONATIONS_ADDRESS,
    abi: donationsAbi,
    functionName: "totalYearsDonated",
    chainId: mainnet.id,
    query: { enabled, refetchInterval: 30_000 },
  });

  const years = totalYears === undefined ? undefined : Number(totalYears);

  const stats: { label: string; value: string; lime?: boolean }[] = [
    { label: "years funded", value: years?.toLocaleString("en-US") ?? "—", lime: true },
    { label: "credits issued", value: years?.toLocaleString("en-US") ?? "—" },
    { label: "goal", value: String(GOAL_YEARS) },
  ];

  return (
    <div className="on-ink mt-6 px-[clamp(24px,4vw,48px)] py-[clamp(32px,5vw,56px)]">
      <div className="duo items-start">
        <div>
          <h2 className="h-panel m-0 text-[var(--fg)]">Fund the century.</h2>
          <p className="lede mt-[22px] max-w-[42ch]">
            Every year donated pushes hoodfi.eth&apos;s expiry further out on Ethereum —
            and earns one credit. One credit mints any 1–3 character name free, forever.
          </p>
          <div className="mt-9 flex flex-wrap gap-2.5">
            <Link href="/short-names/" className="btn btn-lime">
              Donate a year ↗
            </Link>
            <Link href="/#verify" className="btn btn-ghost">
              Read the contract
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
