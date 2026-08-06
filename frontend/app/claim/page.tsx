import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ClaimRedirect } from "@/components/ClaimRedirect";
import { ogMetadata } from "@/lib/metadata";

export const metadata: Metadata = ogMetadata({
  title: "Claim moved to Mint",
  description:
    "Names are minted directly now — no waiting for a snapshot. Head to the mint page.",
  path: "/claim/",
  image: "/og/mint.png",
});

/**
 * Kept as a landing spot because the old claim flow was shared publicly. Minting is
 * immediate now, so there is nothing to claim — send people to /mint instead of
 * showing them a dead page.
 */
export default function ClaimPage() {
  return (
    <>
      <ClaimRedirect />
      <Header />
      <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 text-center sm:px-6">
        <div className="eyebrow">this page moved</div>
        <h1 className="display mt-3 text-[clamp(28px,3.4vw,40px)]">
          Names are minted instantly now
        </h1>
        <p className="mt-4 text-[clamp(15px,1.2vw,18px)] text-[var(--dim)]">
          There&apos;s no snapshot to wait for. Search a name and it&apos;s yours in one
          transaction.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/mint/" className="btn btn-primary">
            Mint a name
          </Link>
          <Link href="/manage/" className="btn btn-ghost">
            Manage your names
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
