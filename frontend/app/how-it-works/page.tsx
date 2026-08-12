import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ResolutionGrids } from "@/components/ResolutionGrids";
import { PageView } from "@/components/PageView";
import { STEPS } from "@/lib/steps";
import { ogMetadata } from "@/lib/metadata";

export const metadata: Metadata = ogMetadata({
  title: "How it works",
  description:
    "Search a name, mint it in one transaction on Robinhood Chain, point it wherever you like, and keep it for life. No renewals, no expiry.",
  path: "/how-it-works/",
});

/**
 * The explanation, on a route of its own.
 *
 * The homepage makes the argument in passing; this is where it is made in full, and
 * it's where the header menu sends anyone who wants the mechanism rather than the
 * pitch. The resolution grids are shared with `/`, not copied, so the two can't drift.
 */
export default function HowItWorksPage() {
  return (
    <>
      <PageView />
      <Header />
      <main>
        <section className="shell pt-[clamp(40px,5vw,64px)]">
          <div className="duo items-end">
            <div>
              <div className="eyebrow">how it works</div>
              <h1 className="h-page mt-[18px]">Four steps, one transaction.</h1>
            </div>
            <p className="lede m-0 mb-2.5 max-w-[46ch]">
              A name here is an ERC-721 on Robinhood Chain that answers from Ethereum
              mainnet. You mint it once and it is yours — there is no renewal date to
              miss and no authority left over it.
            </p>
          </div>

          <div className="cells mt-11 border-t border-l border-[var(--line)]">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="flex-[1_1_260px] border-b border-r border-[var(--line)] p-6"
              >
                <div className="data text-[11px] tracking-[0.16em] text-[var(--faint)]">
                  0{i + 1}
                </div>
                <h2 className="h-sub mt-4">{step.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-[var(--dim)]">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="shell section">
          <div className="eyebrow">02 / resolution</div>
          <div className="duo mt-[18px] items-end">
            <h2 className="h-page m-0">Works where you already are.</h2>
            <p className="lede m-0 mb-2.5 max-w-[44ch]">
              Names resolve from Ethereum mainnet through the ENS Universal Resolver, so
              anything that speaks ENS finds yours — no plugin, no allowlist.
            </p>
          </div>
          <ResolutionGrids />
          <p className="data mt-5 max-w-[88ch] text-[11.5px] leading-[1.7] text-[var(--faint)]">
            One addr record covers Ethereum and every EVM chain. Bitcoin and Solana are
            stored as separate ENSIP-9 records in each chain&apos;s own encoding.
          </p>
        </section>

        <section className="on-lime mt-28 border-y border-[var(--ink)]">
          <div className="shell py-[clamp(56px,7vw,88px)] text-center">
            <h2 className="h-cta m-0 mx-auto max-w-[22ch]">Your name is probably still free</h2>
            <div className="mt-10 flex flex-wrap justify-center gap-2.5">
              <Link href="/mint/" className="btn btn-ink btn-lg">
                Mint a name ↗
              </Link>
              <Link href="/faq/" className="btn btn-ghost btn-lg">
                Read the FAQ
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
