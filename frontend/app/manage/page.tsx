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
      <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-6 lg:px-8">
        <section className="pt-12 sm:pt-16">
          <Reveal>
            <div className="eyebrow">your names</div>
            <h1 className="display mt-3 text-[clamp(30px,3.6vw,44px)]">
              Set up your identity
            </h1>
            <p className="mt-4 max-w-[56ch] text-[clamp(15px,1.2vw,18px)] text-[var(--dim)]">
              Point your name at a wallet, add an avatar, and link your X. Every record
              is written straight to the registry by you — we can&apos;t change or
              reclaim anything.
            </p>
          </Reveal>
        </section>

        <section className="mt-10">
          <Reveal>
            <ManagePanel />
          </Reveal>
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
