import type { Metadata } from "next";
import Link from "next/link";
import { ArrowNE } from "@/components/ArrowNE";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Endowment } from "@/components/Endowment";
import { RenewalPledge } from "@/components/RenewalPledge";
import { ShortNamesCopy } from "@/components/ShortNamesCopy";
import { PageView } from "@/components/PageView";
import { ogMetadata } from "@/lib/metadata";

export const metadata: Metadata = ogMetadata({
  title: "Short names",
  description:
    "One, two and three character *.hoodfi.eth names are on sale from $5 — and the HoodFi Safe renews hoodfi.eth every month until 2127.",
  path: "/short-names/",
  image: "/og/short-names.png",
});

/**
 * The short-name offer on a route of its own, beside the pledge that keeps the parent
 * name alive. Everything here is shared with `/`, not copied.
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
            <RenewalPledge />
          </div>
        </section>

        <section className="shell section">
          <Endowment />
        </section>

        <section className="on-lime mt-28 border-y border-[var(--ink)]">
          <div className="shell py-[clamp(56px,7vw,88px)] text-center">
            <h2 className="h-cta m-0 mx-auto max-w-[22ch]">Every length is on sale now</h2>
            <div className="mt-10 flex flex-wrap justify-center gap-2.5">
              <Link href="/mint/" className="btn btn-ink btn-lg">
                Mint a name <ArrowNE />
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
