import { CenturyRuler } from "./CenturyRuler";
import { DonationsFeed } from "./DonationsFeed";
import { Reveal } from "./Reveal";
import { GOAL_YEAR_LABEL } from "@/lib/site";

/**
 * The parent name's funding, live: the century ruler and the donation ledger.
 *
 * Shared by the landing page and `/short-names/`. It belongs next to the donate panel
 * on both — the ask only makes sense beside the thing being funded — and on mobile
 * `/short-names/` is the only place it appears at all.
 */
export function Endowment({ as = "h2" }: { as?: "h1" | "h2" }) {
  const Heading = as;
  return (
    <>
      <Reveal>
        <div className="eyebrow">the endowment</div>
        <Heading className="display mt-3 text-[clamp(28px,3.4vw,44px)]">
          Funding hoodfi.eth to {GOAL_YEAR_LABEL}
        </Heading>
        <p className="mt-4 max-w-[56ch] text-[clamp(15px,1.2vw,18px)] text-[var(--dim)]">
          Every name here is a subname of hoodfi.eth, so the parent name has to outlive
          them all. Donations renew it directly on the official ENS controller — read
          live below, straight from the .eth registrar.
        </p>
      </Reveal>
      <div className="mt-12">
        <Reveal>
          <CenturyRuler />
        </Reveal>
      </div>
      <div className="mt-12">
        <Reveal>
          <DonationsFeed />
        </Reveal>
      </div>
    </>
  );
}
