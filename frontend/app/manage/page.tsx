import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ManagePanel } from "@/components/ManagePanel";
import { PageView } from "@/components/PageView";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chains";
import { ogMetadata } from "@/lib/metadata";

export const metadata: Metadata = ogMetadata({
  title: "Manage your names",
  description:
    "Point your *.hoodfi.eth name at any address and set your avatar, X handle, website and bio — all onchain, all yours.",
  path: "/manage/",
  image: "/og/manage.png",
});

export default function ManagePage() {
  return (
    <>
      <PageView />
      <Header />
      <main className="shell pb-24 pt-[clamp(40px,5vw,64px)]">
        <section>
          <div className="eyebrow">
            your names · robinhood chain · id {ROBINHOOD_CHAIN_ID}
          </div>
          <h1 className="h-page mt-[18px] max-w-[14ch]">Your name. Your records.</h1>
        </section>
        <p className="lede mt-6 max-w-[52ch] text-[17px]">
          Point it at a wallet, add an avatar, link your X. Every record is written
          straight to the registry by you —{" "}
          <span className="data text-[var(--fg)]">we can&apos;t change or reclaim anything</span>.
        </p>

        <section className="mt-12">
          <ManagePanel />
        </section>

        <p className="mt-12 text-sm text-[var(--dim)]">
          Want another one?{" "}
          <Link href="/mint/" className="link">
            Mint a name
          </Link>
          .
        </p>
      </main>
      <Footer />
    </>
  );
}
