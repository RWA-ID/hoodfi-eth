import { CenturyRuler } from "./CenturyRuler";
import { DonationsFeed } from "./DonationsFeed";
import { DONATIONS_CLOSED, GOAL_YEAR_LABEL, RENEWAL_BLOCK_YEARS } from "@/lib/site";

/**
 * The parent name's funding, live: the century ruler and the donation ledger.
 *
 * The ruler is drawn on ink because a lime fill needs a dark ground to read as a
 * measure rather than as a highlight — the same object as the one in the homepage's
 * short-names panel, in the same colours.
 */
export function Endowment({ as = "h2" }: { as?: "h1" | "h2" }) {
  const Heading = as;
  return (
    <>
      <div className="eyebrow">the endowment</div>
      <Heading className="h-page mt-[18px] max-w-[18ch]">
        Funding hoodfi.eth to {GOAL_YEAR_LABEL}.
      </Heading>
      <p className="lede mt-6 max-w-[56ch] text-[17px]">
        Every name here is a subname of hoodfi.eth, so the parent name has to outlive
        them all. The HoodFi Safe renews it on ENS&apos;s own renewer, {RENEWAL_BLOCK_YEARS}{" "}
        years every month — the expiry is read live below, straight from the .eth
        registrar.
      </p>
      <p className="mt-4 max-w-[56ch] text-sm leading-relaxed text-[var(--dim)]">
        Public donations funded the first years and closed on {DONATIONS_CLOSED}, when
        ENSv2 retired the controller they renewed through. Their ledger stays here, and
        every credit it issued still mints a short name free.
      </p>

      <div className="on-ink mt-11 p-[clamp(24px,4vw,40px)]">
        <CenturyRuler />
      </div>

      <div className="mt-11">
        <DonationsFeed />
      </div>
    </>
  );
}
