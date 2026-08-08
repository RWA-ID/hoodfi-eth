import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { ManagePanel } from "@/components/ManagePanel";
import { PageView } from "@/components/PageView";
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
      <main className="mx-auto max-w-[1240px] px-4 pb-24 pt-14 sm:px-6 lg:px-8">
        <section className="hero-glow flex flex-col items-center gap-4 text-center">
          <Reveal>
            <span className="eyebrow inline-flex items-center gap-2 rounded-full border border-[var(--line-strong)] bg-[color-mix(in_srgb,var(--panel)_70%,transparent)] px-3.5 py-1.5">
              <span className="live-dot" />
              your names · robinhood chain · chain id 4663
            </span>
            <h1 className="statement mt-4 text-[clamp(42px,6.4vw,82px)]">
              Your name.
              <span className="bloom">Your records.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-[52ch] text-pretty text-[clamp(16px,1.3vw,19px)] leading-relaxed text-[var(--dim)]">
              Point it at a wallet, add an avatar, link your X. Every record is written
              straight to the registry by you — <span className="data text-[var(--paper)]">we
              can&apos;t change or reclaim anything</span>.
            </p>
          </Reveal>
        </section>

        <section className="mt-10">
          <ManagePanel />
        </section>

        <section className="mt-10">
          <p className="text-center text-sm text-[var(--dim)]">
            Want another one?{" "}
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
