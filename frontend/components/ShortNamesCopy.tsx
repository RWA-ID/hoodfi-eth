import { GOAL_YEARS } from "@/lib/site";

/**
 * The short-name pitch, written once.
 *
 * It appears in two places — the `#extend` section of the landing page and the
 * `/short-names/` route that carries the same offer on mobile, where that section is
 * hidden. Two copies of an argument about scarcity and pricing is two copies to drift,
 * so both render this.
 *
 * The heading level is the caller's, because the same words are a section heading on
 * the landing page and the page title on its own route.
 */
export function ShortNamesCopy({ as = "h2" }: { as?: "h1" | "h2" }) {
  const Heading = as;
  return (
    <div>
      <div className="eyebrow">the perk</div>
      <Heading className="display mt-3 text-[clamp(28px,3.4vw,44px)]">
        Want <span className="ok">x</span>, <span className="ok">og</span> or{" "}
        <span className="ok">gme</span>?
      </Heading>
      <p className="mt-4 max-w-[48ch] text-[clamp(15px,1.2vw,18px)] text-[var(--dim)]">
        One, two and three character names are the scarcest inventory here — there are
        only 37 possible single characters in total. They aren&apos;t on public sale
        yet.
      </p>
      <p className="mt-4 max-w-[48ch] text-sm leading-relaxed text-[var(--dim)]">
        The one way to get one today: add a year to hoodfi.eth&apos;s expiry on
        Ethereum. Each year donated earns one credit, and a credit mints any short name
        free. It costs about the price of a coffee and it&apos;s what keeps the parent
        name — and therefore every name minted here — alive.
      </p>
      <p className="mt-4 max-w-[48ch] text-sm leading-relaxed text-[var(--dim)]">
        At <span className="data text-[var(--paper)]">{GOAL_YEARS} years</span> donated,
        short names open to everyone at the prices above. Credits still mint free after
        that, so an early credit never loses its value.
      </p>
    </div>
  );
}
