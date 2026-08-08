import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { SearchPanel } from "@/components/SearchPanel";
import { PageView } from "@/components/PageView";
import { ogMetadata } from "@/lib/metadata";

export const metadata: Metadata = ogMetadata({
  title: "Look up a name",
  description:
    "Search any *.hoodfi.eth name and see every record attached to it — addresses, avatar, X, website and bio, read straight from Robinhood Chain.",
  path: "/search/",
  image: "/og/default.png",
});

export default function SearchPage() {
  return (
    <>
      <PageView />
      <Header />
      <main className="mx-auto max-w-3xl px-4 pb-24 sm:px-6 lg:px-8">
        <section className="pt-12 sm:pt-16">
          <Reveal>
            <div className="eyebrow">name lookup</div>
            <h1 className="display mt-3 text-[clamp(30px,3.6vw,44px)]">
              Look up any name
            </h1>
            <p className="mt-4 max-w-[56ch] text-[clamp(15px,1.2vw,18px)] text-[var(--dim)]">
              Every record a HoodFi name carries is public and onchain. Type one in to
              see where it points — no wallet needed.
            </p>
          </Reveal>
        </section>

        <section className="mt-10">
          <Reveal>
            <SearchPanel />
          </Reveal>
        </section>

        <section className="mt-10">
          <p className="text-center text-sm text-[var(--dim)]">
            Don&apos;t have one yet?{" "}
            <Link href="/mint/" className="underline hover:text-[var(--paper)]">
              Mint a name
            </Link>
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
