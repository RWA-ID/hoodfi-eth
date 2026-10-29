import { TIER_USD } from "@/lib/labels";
import { GOAL_YEAR_LABEL, RENEWAL_BLOCK_YEARS } from "@/lib/site";

/**
 * The short-name pitch, written once.
 *
 * The heading level is the caller's, because the same words are a section heading in
 * one place and a page title in another — two copies of an argument about scarcity and
 * pricing is two copies to drift.
 */
export function ShortNamesCopy({ as = "h2" }: { as?: "h1" | "h2" }) {
  const Heading = as;
  return (
    <div>
      <div className="eyebrow">the perk</div>
      <Heading className="h-page mt-[18px] max-w-[16ch]">
        Want x, og or gme?
      </Heading>
      <p className="lede mt-6 max-w-[48ch] text-[17px]">
        One, two and three character names are the scarcest inventory here — there are
        only 37 possible single characters in total. They&apos;re on public sale now,
        first come, first served.
      </p>
      <p className="mt-4 max-w-[48ch] text-sm leading-relaxed text-[var(--dim)]">
        <span className="data text-[var(--fg)]">${TIER_USD[2]}</span> for three characters,{" "}
        <span className="data text-[var(--fg)]">${TIER_USD[1]}</span> for two and{" "}
        <span className="data text-[var(--fg)]">${TIER_USD[0]}</span> for one — paid once,
        in USDG or ETH, and yours for life like every other name here.
      </p>
      <p className="mt-4 max-w-[48ch] text-sm leading-relaxed text-[var(--dim)]">
        The parent name is our job, not yours: the HoodFi Safe renews hoodfi.eth{" "}
        {RENEWAL_BLOCK_YEARS} years at a time, every month, until it reaches{" "}
        {GOAL_YEAR_LABEL}. Short-name credits earned by donating before ENSv2 still mint
        free, so an early credit never loses its value.
      </p>
    </div>
  );
}
