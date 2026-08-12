import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MintPanel } from "@/components/MintPanel";
import { MintIdentityHero } from "@/components/MintIdentityHero";
import { MintQueryProvider } from "@/components/MintQuery";
import { TierGrid } from "@/components/TierGrid";
import { PageView } from "@/components/PageView";
import { STEPS } from "@/lib/steps";
import { ogMetadata } from "@/lib/metadata";

export const metadata: Metadata = ogMetadata({
  title: "Mint your name",
  description:
    "Search and mint a lifetime *.hoodfi.eth name on Robinhood Chain. From $3, one transaction, no renewals ever.",
  path: "/mint/",
  image: "/og/mint.png",
});

const GETS = [
  ["token", "A lifetime ERC-721. No renewal, no expiry date, nothing to forget."],
  ["records", "Address, avatar, X handle, website and bio — all set by you."],
  ["resolution", "Answers from Ethereum mainnet, so anything that speaks ENS finds it."],
  ["payment", "ETH or USDG, whichever you already hold."],
];

export default function MintPage() {
  return (
    <>
      <PageView />
      <Header />
      <MintQueryProvider>
        <main>
          {/* Same lime field as the homepage hero, and the same ink card in it: this
              is the instrument the landing page was pointing at, so it should be the
              object someone recognises when they arrive. */}
          <section className="on-lime border-b border-[var(--ink)]">
            <div className="shell grid items-start gap-14 pb-[68px] pt-[clamp(40px,5vw,64px)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr))]">
              <div className="min-w-0 [container-type:inline-size]">
                <MintIdentityHero />
              </div>
              <MintPanel />
            </div>
          </section>

          <section className="shell section">
            <div className="eyebrow">01 / pick a name</div>
            <div className="duo mt-[18px] items-end">
              <h2 className="h-page m-0">Price is length.</h2>
              <p className="lede m-0 mb-2.5 max-w-[44ch]">
                Paid once, in ETH or USDG. Nothing renews and nothing expires — the tier
                below tracks whatever you type above.
              </p>
            </div>
            <TierGrid />
          </section>

          <section className="shell section">
            <div className="eyebrow">02 / what you get</div>
            <div className="duo mt-[18px] items-start">
              <div className="min-w-0">
                <h2 className="h-page m-0">Yours, then out of our hands.</h2>
                <p className="lede mt-5 max-w-[46ch]">
                  The name lands in your wallet as an ERC-721 the moment the transaction
                  confirms. From that point the registrar has no authority over it — no
                  burn, no reclaim, no renewal to miss.
                </p>
                <div className="mt-8 flex flex-wrap gap-2.5">
                  <Link href="/manage/" className="btn btn-ghost">
                    Manage records
                  </Link>
                  <Link href="/faq/" className="btn btn-ghost">
                    Read the FAQ
                  </Link>
                </div>
              </div>
              <div className="min-w-0 border-t border-[var(--line)]">
                {GETS.map(([key, value]) => (
                  <div key={key} className="ledger-row">
                    <span className="data text-[11px] uppercase tracking-[0.16em] text-[var(--label)]">
                      {key}
                    </span>
                    <span className="text-[17px] font-medium leading-[1.5] text-pretty">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="shell section pb-24">
            <div className="eyebrow">03 / the whole flow</div>
            <h2 className="h-page mt-[18px]">Four steps, one transaction.</h2>
            <div className="cells mt-11 border-t border-l border-[var(--line)]">
              {STEPS.map((step, i) => (
                <div
                  key={step.title}
                  className="flex-[1_1_260px] border-b border-r border-[var(--line)] p-6"
                >
                  <div className="data text-[11px] tracking-[0.16em] text-[var(--faint)]">
                    0{i + 1}
                  </div>
                  <h3 className="h-sub mt-4">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--dim)]">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </main>
      </MintQueryProvider>
      <Footer />
    </>
  );
}
