"use client";

import Link from "next/link";
import { useState } from "react";
import { useReadContract } from "wagmi";
import { robinhoodChain } from "@/lib/chains";
import { REGISTRAR_ADDRESS, registrarAbi } from "@/lib/contracts";
import { CREDIT_USD, TIER_USD, checkLabel } from "@/lib/labels";
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
 * `shortsOpen` is read from the registrar, never assumed. When the goal is reached
 * the contract flips it and this whole block changes voice with no deploy.
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

  const active = label ? Math.min(label.length, 4) - 1 : clicked;

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
              {/* The big number is the public price, and for a locked tier that is a
                  price nobody can pay yet — reading "$15" with nothing under it sent
                  people to /short-names/ expecting to pay it. So the first line says
                  which kind of price it is and the second says what the name actually
                  costs today, which for all three locked tiers is one credit: about
                  $5, less than every number above it.

                  Every card carries both lines, open or not. They are the last thing
                  in the card and the card bottoms are aligned, so a card with one line
                  fewer floats its price 20px above the other three. */}
              <span className="mt-auto block pt-6">
                <span className="block text-[30px] font-extrabold tracking-[-0.03em]">
                  ${TIER_USD[i]}
                </span>
                <span className="label mt-2 block">
                  {open ? "public · open now" : "public price · locked"}
                </span>
                <span className="label mt-1 block" style={{ color: "var(--ink)" }}>
                  {open
                    ? `today: $${TIER_USD[i]} + gas`
                    : `today: 1 credit · ~$${CREDIT_USD} + gas`}
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
              : "1–3 character names are premium inventory."}
          </span>{" "}
          {shortsOpen
            ? "The 100-year goal was reached, so short names now mint publicly at tier prices. Credits still mint them free."
            : `Until hoodfi.eth's expiry is funded 100 years ahead, they mint only with short-name credits — one credit per year donated to the parent name. A year costs about $${CREDIT_USD} in ETH plus Ethereum gas, and the credit mints the name free, so a short name today costs less than any of the three prices above.`}
        </p>
        <Link href={shortsOpen ? "/mint/" : "/short-names/"} className="btn btn-lime flex-none h-11">
          {shortsOpen ? "Mint a short name" : "Earn credits"} <ArrowNE />
        </Link>
      </div>
    </>
  );
}
