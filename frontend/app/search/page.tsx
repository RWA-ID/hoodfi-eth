import type { Metadata } from "next";
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
      <main className="mx-auto max-w-[1240px] px-4 pb-24 pt-14 sm:px-6 lg:px-8">
        <section className="hero-glow flex flex-col items-center gap-4 text-center">
          <Reveal>
            <span className="eyebrow inline-flex items-center gap-2 rounded-full border border-[var(--line-strong)] bg-[color-mix(in_srgb,var(--panel)_70%,transparent)] px-3.5 py-1.5">
              <span className="live-dot" />
              name lookup · robinhood chain · chain id 4663
            </span>
            <h1 className="statement mt-4 text-[clamp(42px,6.4vw,82px)]">
              Look up a friend.
              <span className="bloom">Or show off your own.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-[52ch] text-pretty text-[clamp(16px,1.3vw,19px)] leading-relaxed text-[var(--dim)]">
              Type a name to see the addresses and links its owner chose to share, then
              grab the card to post it — <span className="data text-[var(--paper)]">no
              wallet needed</span>.
            </p>
          </Reveal>
        </section>

        <section className="mt-10">
          <SearchPanel />
        </section>
      </main>
      <Footer />
    </>
  );
}
