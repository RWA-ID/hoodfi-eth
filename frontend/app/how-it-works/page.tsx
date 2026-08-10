import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { WalletBand } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { ResolvesEverywhere } from "@/components/ResolvesEverywhere";
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
 * These sections live on the landing page as `#how` and `#resolves`, and both are
 * hidden below `sm` now that a phone lands on a mint screen. Hiding something is only
 * fair if it is still reachable, so this is where the menu sends anyone who wants the
 * long version — and it carries the wallet band, which is also desktop-only in the
 * footer.
 */
export default function HowItWorksPage() {
  return (
    <>
      <PageView />
      <Header />
      <main className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 2xl:px-12">
        <section className="hero-glow pt-10 sm:pt-14">
          <Reveal>
            <div className="eyebrow">how it works</div>
            <h1 className="display mt-3 text-[clamp(30px,4.4vw,56px)]">
              Four steps, one transaction
            </h1>
            <p className="mt-4 max-w-[52ch] text-[clamp(15px,1.2vw,18px)] text-[var(--dim)]">
              A name here is an ERC-721 on Robinhood Chain that resolves through
              Ethereum mainnet. You mint it once and it is yours — there is no renewal
              date to miss.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <Reveal key={step.title}>
                <div>
                  <div className="data text-sm text-[var(--faint)]">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h2 className="display mt-3 text-lg">{step.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="mt-16 border-t border-[var(--line)] pt-16 sm:mt-20 sm:pt-20">
          <Reveal>
            <ResolvesEverywhere />
          </Reveal>
        </section>

        <section className="mt-16 border-t border-[var(--line)] py-16 text-center sm:mt-20 sm:py-20">
          <Reveal>
            <h2 className="display text-[clamp(24px,3vw,36px)]">
              Your name is probably still free.
            </h2>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/mint/" className="btn btn-primary">
                Mint a name
              </Link>
              <Link href="/faq/" className="btn btn-ghost">
                Read the FAQ
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      {/* Mobile only — the footer already carries this at `sm` and up, and rendering
          both would show it twice on a desktop. */}
      <div className="sm:hidden">
        <WalletBand />
      </div>
      <Footer />
    </>
  );
}
