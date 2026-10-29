"use client";

import Link from "next/link";
import { useAccount, useReadContract } from "wagmi";
import { mainnet } from "wagmi/chains";
import {
  DONATIONS_ADDRESS,
  ETH_RENEWER_V1_ADDRESS,
  MAINNET_USDC_ADDRESS,
  ZERO_ADDRESS,
  donationsAbi,
  ethRenewerAbi,
} from "@/lib/contracts";
import { expiryDate, expiryYear, formatAddress } from "@/lib/format";
import { GOAL_YEAR_LABEL, HOODFI_SAFE, RENEWAL_BLOCK_YEARS } from "@/lib/site";
import { ArrowNE } from "./ArrowNE";

const YEAR_SECONDS = 365n * 24n * 60n * 60n;

/**
 * The renewal pledge, in the panel the donate form used to occupy.
 *
 * Public donations stopped working on 2026-10-27: ENSv2 retired the v1 controller the
 * donation contract renews through. The HoodFi Safe renews hoodfi.eth itself now, and
 * this panel is the public side of that promise — who renews, how much each month,
 * what it costs, and how far there is to go. Every figure is a live mainnet read, so
 * a missed month shows up here as a stalled expiry rather than as a claim.
 *
 * Credits earned before donations closed still mint short names free, so a connected
 * donor still sees their balance.
 */
export function RenewalPledge() {
  const { address } = useAccount();
  const enabled = Boolean(DONATIONS_ADDRESS);

  const { data: expiry } = useReadContract({
    address: DONATIONS_ADDRESS,
    abi: donationsAbi,
    functionName: "nameExpires",
    chainId: mainnet.id,
    query: { enabled, refetchInterval: 60_000 },
  });

  // ENS's own quote for one block, from the contract the Safe calls. Not a constant:
  // the price is set by ENS and a hardcoded figure is the kind that quietly goes stale.
  const { data: blockPrice } = useReadContract({
    address: ETH_RENEWER_V1_ADDRESS,
    abi: ethRenewerAbi,
    functionName: "getRenewPrice",
    args: ["hoodfi", BigInt(RENEWAL_BLOCK_YEARS) * YEAR_SECONDS, MAINNET_USDC_ADDRESS],
    chainId: mainnet.id,
    query: { staleTime: 300_000 },
  });

  const { data: myCredits } = useReadContract({
    address: DONATIONS_ADDRESS,
    abi: donationsAbi,
    functionName: "shortCredits",
    args: [address ?? ZERO_ADDRESS],
    chainId: mainnet.id,
    query: { enabled: enabled && Boolean(address), refetchInterval: 30_000 },
  });

  const year = expiryYear(expiry);
  const yearsToGo = year === undefined ? undefined : Math.max(0, GOAL_YEAR_LABEL - year);
  const blocksToGo =
    yearsToGo === undefined ? undefined : Math.ceil(yearsToGo / RENEWAL_BLOCK_YEARS);
  // Two decimals, not the raw quote: the dust is real but meaningless to a reader.
  const price =
    blockPrice === undefined ? undefined : `$${(Number(blockPrice) / 1e6).toFixed(2)} USDC`;

  return (
    <div className="on-ink p-7">
      <div className="flex items-center justify-between gap-4">
        <span className="label">The renewal pledge</span>
        {address && myCredits !== undefined && myCredits > 0n && (
          <span className="data text-[11px] uppercase tracking-[0.14em] text-[var(--label)]">
            your credits{" "}
            <span style={{ color: "var(--lime)" }}>{myCredits.toString()}</span>
          </span>
        )}
      </div>

      <p className="mt-3.5 text-sm leading-relaxed text-[var(--dim)]">
        The HoodFi Safe renews hoodfi.eth itself — {RENEWAL_BLOCK_YEARS} years at a time,
        once a month, until its expiry reaches {GOAL_YEAR_LABEL}. Nothing is asked of
        anyone minting a name.
      </p>

      <div className="mt-5 border-t border-[var(--line)]">
        <div className="ledger-line">
          <span className="text-sm text-[var(--dim)]">Renewed by the Safe</span>
          <a
            className="data link text-sm"
            href={`https://etherscan.io/address/${HOODFI_SAFE}`}
            target="_blank"
            rel="noreferrer"
          >
            {formatAddress(HOODFI_SAFE)}
          </a>
        </div>
        <div className="ledger-line">
          <span className="text-sm text-[var(--dim)]">Each month</span>
          <span className="data text-sm" style={{ color: "var(--lime)" }}>
            +{RENEWAL_BLOCK_YEARS} years
          </span>
        </div>
        <div className="ledger-line">
          <span className="text-sm text-[var(--dim)]">Cost per block (live ENS price)</span>
          <span className="data text-sm">{price ?? "…"}</span>
        </div>
        <div className="ledger-line">
          <span className="text-sm text-[var(--dim)]">hoodfi.eth expires</span>
          <span className="data text-sm">{enabled ? expiryDate(expiry) : "—"}</span>
        </div>
        <div className="ledger-line">
          <span className="text-sm text-[var(--dim)]">To the {GOAL_YEAR_LABEL} goal</span>
          <span className="data text-sm">
            {yearsToGo === undefined
              ? "—"
              : yearsToGo === 0
              ? "reached"
              : `${yearsToGo} years · ${blocksToGo} block${blocksToGo === 1 ? "" : "s"}`}
          </span>
        </div>
      </div>

      <Link href="/mint/" className="btn btn-lime btn-lg mt-6 w-full">
        Mint a short name <ArrowNE />
      </Link>

      <p className="data mt-4 text-[11px] leading-relaxed text-[var(--faint)]">
        Each renewal is a public 2-of-3 Safe transaction to ENS&apos;s own renewer, paid in
        USDC — the expiry above moves the day it lands. Credits earned by donating still
        mint any 1–3 character name free.
      </p>
    </div>
  );
}
