import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { DonatePanel } from "@/components/DonatePanel";
import { Endowment } from "@/components/Endowment";
import { ShortNamesCopy } from "@/components/ShortNamesCopy";
import { PageView } from "@/components/PageView";
import { ogMetadata } from "@/lib/metadata";

export const metadata: Metadata = ogMetadata({
  title: "Short names",
  description:
    "One, two and three character *.hoodfi.eth names are premium inventory. Donate a year to hoodfi.eth's ENS expiry to earn a credit and mint one free.",
  path: "/short-names/",
});

/**
 * The short-name offer on a route of its own.
 *
 * The landing page carries this as `#extend`, which is fine on a desktop and useless on
 * a phone: mobile now lands on a mint screen with the marketing sections hidden, so an
 * anchor into one of them scrolls to nothing. Donating is a real feature — it is the
 * only way to get a 1–3 character name before the goal — so it needed an address that
 * does not depend on the landing page being rendered.
 *
 * Everything here is shared with `/`, not copied, so the two can't drift.
 */
export default function ShortNamesPage() {
  return (
    <>
      <PageView />
      <Header />
      <main className="mx-auto max-w-[1600px] px-4 pb-24 sm:px-6 lg:px-8 2xl:px-12">
        <section className="hero-glow pt-10 sm:pt-14">
          <Reveal>
            <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,420px)]">
              <ShortNamesCopy as="h1" />
              <DonatePanel />
            </div>
          </Reveal>
        </section>

        <section className="mt-16 border-t border-[var(--line)] pt-16 sm:mt-20 sm:pt-20">
          <Endowment />
        </section>

        <section className="mt-16 border-t border-[var(--line)] py-16 text-center sm:mt-20 sm:py-20">
          <Reveal>
            <h2 className="display text-[clamp(24px,3vw,36px)]">
              Four characters and up are on sale now.
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
      <Footer />
    </>
  );
}
