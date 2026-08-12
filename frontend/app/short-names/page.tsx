import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
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
 * The short-name offer on a route of its own — donating is the only way to get a 1–3
 * character name before the goal, so it needed an address of its own rather than a
 * homepage anchor. Everything here is shared with `/`, not copied.
 */
export default function ShortNamesPage() {
  return (
    <>
      <PageView />
      <Header />
      <main>
        <section className="shell pt-[clamp(40px,5vw,64px)]">
          <div className="duo items-start">
            <ShortNamesCopy as="h1" />
            <DonatePanel />
          </div>
        </section>

        <section className="shell section">
          <Endowment />
        </section>

        <section className="on-lime mt-28 border-y border-[var(--ink)]">
          <div className="shell py-[clamp(56px,7vw,88px)] text-center">
            <h2 className="h-cta m-0 mx-auto max-w-[22ch]">Four characters and up are on sale now</h2>
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
