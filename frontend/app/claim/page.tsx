import type { Metadata } from "next";
import Link from "next/link";
import { ArrowNE } from "@/components/ArrowNE";
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
      <main className="shell flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
        <div className="eyebrow">this page moved</div>
        <h1 className="h-page mt-[18px] max-w-[16ch]">Names are minted instantly now.</h1>
        <p className="lede mt-6 max-w-[46ch] text-[17px]">
          There&apos;s no snapshot to wait for. Search a name and it&apos;s yours in one
          transaction.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-2.5">
          <Link href="/mint/" className="btn btn-ink">
            Mint a name <ArrowNE />
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
