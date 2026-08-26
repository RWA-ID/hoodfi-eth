"use client";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { TemplateSubmitForm } from "@/components/TemplateSubmitForm";
import { PARTNER_SHARE } from "@/lib/site";

/** What a project gets, and what it owes. Four rows, no small print elsewhere. */
const TERMS: [string, string][] = [
  [
    "your share",
    `${PARTNER_SHARE} of every publish on your template, first sites and rebuilds alike. Paid in whichever currency the holder used.`,
  ],
  [
    "who can use it",
    "Only wallets holding your NFT. The gate is a balance check in the contract, on the same chain your collection lives on — not a list we maintain.",
  ],
  [
    "how you're paid",
    "Your share accrues on-chain to the address you give us. You withdraw it yourself, whenever you like, from the contract.",
  ],
  [
    "who builds it",
    "We do, from your design. Only our code ever emits the published page, which is what keeps a template safe to accept from outside.",
  ],
];

/** The gate, stated plainly rather than buried in a reply. */
const REQUIREMENTS: string[] = [
  "The collection is verified on OpenSea.",
  "The contract is deployed on Robinhood Chain.",
  "The collection has a website and an X account we can reach you at.",
  "The design is yours to license to us.",
];

export default function PartnerPage() {
  return (
    <>
      <Header />
      <main id="top">
        <section className="on-lime border-b border-[var(--ink)]">
          <div className="shell pb-[68px] pt-[clamp(48px,6vw,76px)]">
            <div className="max-w-[52ch] [container-type:inline-size]">
              <div className="eyebrow">Partners · NFT collections</div>
              <h1 className="h-hero mt-[22px]">
                Your art,
                <br />
                their website
              </h1>
              <p className="mt-[30px] text-[19px] font-medium leading-[1.5] text-pretty">
                Bring a template your holders can build on, and earn {PARTNER_SHARE} of
                every site published with it. They get a page that looks like your
                collection; you get a cut and a live link from every one.
              </p>
            </div>
          </div>
        </section>

        <section className="shell section">
          <div className="eyebrow">01 / the deal</div>
          <div className="duo mt-[18px] items-end">
            <h2 className="h-section m-0">How it works.</h2>
            <p className="lede m-0 mb-2.5 max-w-[44ch]">
              The split is written into the contract, per template, and paid on-chain.
              Nothing here depends on us remembering to send you anything.
            </p>
          </div>
          <div className="mt-[52px] border-t border-[var(--line)]">
            {TERMS.map(([key, value]) => (
              <div key={key} className="ledger-row">
                <div className="label">{key}</div>
                <div className="text-[15.5px] leading-[1.6] text-[var(--dim)]">{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="shell section">
          <div className="eyebrow">02 / what we accept</div>
          <div className="duo mt-[18px] items-start">
            <div className="min-w-0">
              <h2 className="h-section m-0 max-w-[14ch]">Four things we check.</h2>
              <p className="lede mt-6 max-w-[44ch]">
                Every template is reviewed and built by hand before it goes live, and any
                template can be switched off from the contract without a redeploy. That
                is deliberate: a published site is served under a hoodfi.eth subdomain, so
                a design we haven&rsquo;t read has our name on it as much as yours.
              </p>
            </div>
            <div className="min-w-0 border-t border-[var(--line)]">
              {/* Not `.ledger-row`: its label column is 150px, sized for a phrase like
                  "how you're paid". A two-digit number in it leaves a gap wide enough
                  that the number stops reading as attached to its line. 44px is what the
                  FAQ numbers its rows with, and these are the same shape of list. */}
              {REQUIREMENTS.map((req, i) => (
                <div
                  key={req}
                  className="grid grid-cols-[44px_minmax(0,1fr)] items-baseline gap-4 border-b border-[var(--line)] py-5"
                >
                  <span className="data text-[11px] tracking-[0.14em] text-[var(--faint)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[15.5px] leading-[1.6] text-[var(--dim)]">{req}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="submit" className="shell section">
          <div className="eyebrow">03 / submit</div>
          <div className="duo mt-[18px] items-end">
            <h2 className="h-section m-0">Send us your collection.</h2>
            <p className="lede m-0 mb-2.5 max-w-[44ch]">
              We&rsquo;ll check the contract as you type it. Everything else we read by
              hand and reply to from a real address.
            </p>
          </div>
          <div className="mt-[52px] max-w-[820px]">
            <TemplateSubmitForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
