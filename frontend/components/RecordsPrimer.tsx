"use client";

import { ArrowNE } from "./ArrowNE";
import { PrimerCard } from "./PrimerCard";
import { track } from "@/lib/analytics";
import { BUILDER_URL } from "@/lib/site";

/**
 * What the left column says under the profile card.
 *
 * The card and its two buttons are short and the records editor beside them is long, so
 * the column used to run out of content about a fifth of the way down the page and leave
 * a tall empty strip. What filled it was a primer on subnames — which now sits beside
 * the subname form itself, in the section below. So this column says what the *records*
 * section does instead, which is the thing a reader on this half of the page is actually
 * looking at.
 *
 * The lime block is the one place on the site where the website record and the tool that
 * produces one meet: the editor above accepts an IPFS address for a site, and until now
 * nothing anywhere told an owner where a site might come from.
 */
export function RecordsPrimer() {
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap gap-[18px]">
        <PrimerCard
          eyebrow="01 / records"
          title="Everything a name carries"
          className="flex-[1_1_190px]"
        >
          An address on Robinhood Chain and mainnet, Bitcoin and Solana, an avatar, your
          X handle, a bio and a whole website — saved in one transaction, however many
          you change.
        </PrimerCard>
        <PrimerCard
          eyebrow="02 / yours"
          title="Written by you, not by us"
          className="flex-[1_1_190px]"
        >
          Every field here goes straight from your wallet to the registry. Nothing routes
          through us, and we can&apos;t change or reclaim a record once it lands.
        </PrimerCard>
      </div>

      <div className="shadow-card flex flex-col gap-2.5 border border-[var(--ink)] bg-[var(--lime)] px-6 py-7 text-[var(--ink)]">
        <span className="data text-[10px] uppercase tracking-[0.2em] text-[rgba(11,14,8,0.62)]">
          website record
        </span>
        <h4 className="text-[20px] font-bold leading-[1.06] tracking-[-0.03em]">
          Give your name a website.
        </h4>
        <p className="text-[12.5px] leading-[1.55] text-pretty text-[rgba(11,14,8,0.72)]">
          Build one in minutes, publish it to IPFS, and paste the address into the website
          record — your name serves the site itself, with no host to pay.
        </p>
        {/* Ink fill, not the usual lime: on a lime ground a lime button is invisible,
            and this is the only action in the column. */}
        <a
          className="btn btn-ink mt-3.5 self-start"
          href={BUILDER_URL}
          target="_blank"
          rel="noreferrer"
          onClick={() => track("builder_opened", { from: "manage" })}
        >
          Build your website <ArrowNE />
        </a>
      </div>
    </div>
  );
}
