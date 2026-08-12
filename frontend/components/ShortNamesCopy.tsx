import { CREDIT_USD } from "@/lib/labels";
import { GOAL_YEARS } from "@/lib/site";

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
        only 37 possible single characters in total. They aren&apos;t on public sale yet.
      </p>
      <p className="mt-4 max-w-[48ch] text-sm leading-relaxed text-[var(--dim)]">
        The one way to get one today: add a year to hoodfi.eth&apos;s expiry on Ethereum.
        Each year donated earns one credit, and a credit mints any short name free. A
        year is ENS&apos;s own renewal price —{" "}
        <span className="data text-[var(--fg)]">about ${CREDIT_USD} in ETH</span>, plus
        Ethereum gas — and it&apos;s what keeps the parent name, and therefore every name
        minted here, alive.
      </p>
      <p className="mt-4 max-w-[48ch] text-sm leading-relaxed text-[var(--dim)]">
        At <span className="data text-[var(--fg)]">{GOAL_YEARS} years</span> donated,
        short names open to everyone at tier prices. Credits still mint free after that,
        so an early credit never loses its value.
      </p>
    </div>
  );
}
