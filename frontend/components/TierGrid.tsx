"use client";

import Link from "next/link";
import { useState } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { robinhoodChain } from "@/lib/chains";
import { REGISTRAR_ADDRESS, registrarAbi } from "@/lib/contracts";
import { useEthUsd, weiToUsd } from "@/lib/ethUsd";
import { formatEth } from "@/lib/format";
import { TIER_USD, checkLabel } from "@/lib/labels";
import { ArrowNE } from "./ArrowNE";
import { useMintQuery } from "./MintQuery";

const TIERS = [
  { chars: "1 char", example: "x" },
  { chars: "2 chars", example: "og" },
  { chars: "3 chars", example: "gme" },
  { chars: "4+ chars", example: "blake" },
];

/**
 * The four price tiers, and the band underneath explaining why three of them are
 * locked.
 *
 * Selection follows the name being typed in the hero rather than a click: the panel
 * above is the actual instrument, so the card that lights up is a readout of it. With
 * an empty field it falls back to whatever was last clicked, and clicking a card
 * clears the field so the two can't disagree about which tier is selected.
 *
 * `shortsOpen` is read from the registrar, never assumed. When the Safe flips it this
 * whole block changes voice with no deploy.
 */
export function TierGrid() {
  const shared = useMintQuery();
  const [clicked, setClicked] = useState(3);
  const check = checkLabel(shared?.query ?? "");
  const label = check.ok ? check.label : "";

  const { data: shortsOpen } = useReadContract({
    address: REGISTRAR_ADDRESS,
    abi: registrarAbi,
    functionName: "shortsOpen",
    chainId: robinhoodChain.id,
    query: { enabled: Boolean(REGISTRAR_ADDRESS) },
  });

  /**
   * The ETH leg of every tier, read from the registrar rather than derived from the
   * dollar figure beside it. The contract stores a fixed amount of ETH per tier, so
   * the two are only equal on the day the prices were last set — printing the dollar
   * figure as though it were the ETH price is what made this card lie.
   */
  const { data: tierWei } = useReadContracts({
    contracts: [0, 1, 2, 3].map((tier) => ({
      address: REGISTRAR_ADDRESS,
      abi: registrarAbi,
      functionName: "priceWei",
      args: [BigInt(tier)],
      chainId: robinhoodChain.id,
    })),
    query: { enabled: Boolean(REGISTRAR_ADDRESS) },
  });
  const ethUsd = useEthUsd();

  const active = label ? Math.min(label.length, 4) - 1 : clicked;

  /**
   * The second line of an open tier: what the ETH leg costs, and what that is worth
   * right now. Both halves degrade independently — no feed drops the dollar figure,
   * no registrar read drops the line to the bare "+ gas" it can always honour. It
   * stays one line in every one of those states, because the cards align on their
   * bottom edge and a wrapped line floats the price above its neighbours.
   */
  function ethLine(i: number): string {
    const wei = tierWei?.[i]?.result as bigint | undefined;
    if (wei === undefined) return "or ETH at the live rate + gas";
    const usd = weiToUsd(wei, ethUsd);
    return usd
      ? `or ${formatEth(wei, 4)} ETH ≈ ${usd} + gas`
      : `or ${formatEth(wei, 4)} ETH + gas`;
  }

  return (
    <>
      <div className="cells mt-11 border border-[var(--line)]">
        {TIERS.map((tier, i) => {
          const isSelected = active === i;
          const open = i === 3 || Boolean(shortsOpen);
          return (
            <button
              key={tier.chars}
              type="button"
              onClick={() => {
                setClicked(i);
                shared?.setQuery("");
              }}
              aria-pressed={isSelected}
              className="flex min-h-[260px] flex-[1_1_210px] cursor-pointer flex-col border-l border-[var(--line)] px-6 pb-7 pt-6 text-left transition-colors"
              style={{ background: isSelected ? "var(--lime)" : "transparent" }}
            >
              <span className="flex w-full items-start justify-between">
                <span className="data text-[11px] tracking-[0.16em] text-[var(--label)]">
                  0{i + 1}
                </span>
                {/* The one circle in the entire design, and it earns it: this is a
                    radio control, and a square would read as a checkbox. */}
                <span
                  className="block h-[13px] w-[13px] rounded-full border-[1.5px] border-[var(--ink)]"
                  style={{ background: isSelected ? "var(--ink)" : "transparent" }}
                />
              </span>
              <span className="mt-[26px] block text-[34px] font-extrabold leading-none tracking-[-0.035em]">
                {tier.chars}
              </span>
              <span className="data mt-2 block text-[13px] text-[var(--dim)]">
                {tier.example}.hoodfi.eth
              </span>
              {/* The big number is the public price. While a tier is still locked
                  that is a price nobody can pay yet, so the first line says which kind
                  of price it is and the second says who can mint it meanwhile.

                  Every card carries both lines, open or not. They are the last thing
                  in the card and the card bottoms are aligned, so a card with one line
                  fewer floats its price 20px above the other three. */}
              <span className="mt-auto block pt-6">
                <span className="block text-[30px] font-extrabold tracking-[-0.03em]">
                  ${TIER_USD[i]}
                </span>
                <span className="label mt-2 block">
                  {open ? "in USDG · open now" : "public price · opening"}
                </span>
                <span className="label mt-1 block" style={{ color: "var(--ink)" }}>
                  {open ? ethLine(i) : "credit holders mint free"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="on-ink flex flex-wrap items-center justify-between gap-x-8 gap-y-5 px-7 py-6">
        <p className="m-0 max-w-[74ch] text-sm leading-relaxed text-[var(--dim)]">
          <span className="font-bold text-[var(--fg)]">
            {shortsOpen
              ? "Short names are open."
              : "1–3 character names open shortly."}
          </span>{" "}
          {shortsOpen
            ? "One, two and three character names mint publicly at the prices above, first come, first served. Credits earned by donating still mint them free."
            : "They go on public sale at the prices above. Until then, credits earned by donating mint them free."}
        </p>
        <Link href={shortsOpen ? "/mint/" : "/short-names/"} className="btn btn-lime flex-none h-11">
          {shortsOpen ? "Mint a short name" : "Short names"} <ArrowNE />
        </Link>
      </div>
    </>
  );
}
