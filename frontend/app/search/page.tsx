import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SearchPanel } from "@/components/SearchPanel";
import { PageView } from "@/components/PageView";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chains";
import { ogMetadata } from "@/lib/metadata";

export const metadata: Metadata = ogMetadata({
  title: "Look up a name",
  description:
    "Search any *.hoodfi.eth name and see every record attached to it — addresses, avatar, X, bio, and the IPFS site it serves — read straight from Robinhood Chain.",
  path: "/search/",
  image: "/og/default.png",
});

export default function SearchPage() {
  return (
    <>
      <PageView />
      <Header />
      <main className="shell pb-24 pt-[clamp(40px,5vw,64px)]">
        {/* The measure goes on the heading, not the section: `ch` resolves against
            the element's own font-size, so 22ch on a 16px wrapper is ~190px and the
            title wraps to three lines inside it. */}
        <section>
          <div className="eyebrow">
            name lookup · robinhood chain · id {ROBINHOOD_CHAIN_ID}
          </div>
          <h1 className="h-page mt-[18px] max-w-[14ch]">Look up a friend.</h1>
        </section>
        <p className="lede mt-6 max-w-[52ch] text-[17px]">
          Type a name to see the addresses and links its owner chose to share, then grab
          the card to post it — <span className="data text-[var(--fg)]">no wallet needed</span>.
        </p>

        <section className="mt-12">
          <SearchPanel />
        </section>
      </main>
      <Footer />
    </>
  );
}
