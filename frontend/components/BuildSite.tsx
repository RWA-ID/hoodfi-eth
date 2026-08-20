"use client";

import { ArrowNE } from "./ArrowNE";
import { track } from "@/lib/analytics";
import { BUILDER_URL } from "@/lib/site";

/**
 * The three moves that turn a name into a site, and the handoff to the tool that does
 * them. Written as steps rather than as features because the surprising part is not
 * what the builder can draw — it is that the result is served by the name itself, with
 * nothing left to rent.
 */
const STEPS: [string, string, string][] = [
  [
    "01",
    "Pick a template",
    "Four to start from, each one a whole site rather than a link page. Change the words, the colours and the pictures.",
  ],
  [
    "02",
    "Publish to IPFS",
    "One click pins the finished site. There is no server to rent, no host account and nothing that lapses if a card expires.",
  ],
  [
    "03",
    "Point your name at it",
    "The address goes in your name's website record. From then on the name is the site — hoodfi.eth.limo and every ENS-aware browser serve it.",
  ],
];

export function BuildSite() {
  return (
    <>
      <div className="duo mt-[18px] items-end">
        <h2 className="h-section m-0 max-w-[16ch]">A name that is also a website.</h2>
        <p className="lede m-0 mb-2.5 max-w-[44ch]">
          Every hoodfi name carries a website record, and there is a builder that fills
          it in for you. Nothing to host, nothing to renew — the same terms as the name.
        </p>
      </div>

      <div className="cells mt-[52px] border border-[var(--line-card)]">
        {STEPS.map(([num, title, body]) => (
          <div
            key={num}
            className="flex-[1_1_280px] border-l border-[var(--line-card)] px-[22px] py-6"
          >
            <div className="data text-[11.5px] uppercase tracking-[0.2em] text-[var(--label)]">
              {num}
            </div>
            <h3 className="h-sub mt-3.5">{title}</h3>
            <p className="mt-3 text-[15px] leading-[1.55] text-pretty text-[var(--dim)]">
              {body}
            </p>
          </div>
        ))}
      </div>

      <div className="shadow-card mt-3.5 flex flex-col items-start justify-between gap-6 border border-[var(--ink)] bg-[var(--lime)] px-[clamp(22px,3vw,34px)] py-[clamp(24px,3vw,32px)] text-[var(--ink)] min-[820px]:flex-row min-[820px]:items-center">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="data text-[11px] uppercase tracking-[0.2em] text-[rgba(11,14,8,0.62)]">
            hoodfi sites · free while it is new
          </span>
          <h3 className="text-[clamp(24px,3vw,32px)] font-extrabold leading-[1.02] tracking-[-0.035em]">
            Build yours in under 5 minutes.
          </h3>
        </div>
        {/* Ink fill: a lime button on a lime ground is a rectangle you cannot see. */}
        <a
          className="btn btn-ink btn-lg w-full flex-none min-[820px]:w-auto"
          href={BUILDER_URL}
          target="_blank"
          rel="noreferrer"
          onClick={() => track("builder_opened", { from: "home" })}
        >
          Build your website <ArrowNE />
        </a>
      </div>
    </>
  );
}
