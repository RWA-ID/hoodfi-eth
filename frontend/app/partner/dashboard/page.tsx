import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { PageView } from "@/components/PageView";
import { PartnerDashboard } from "@/components/PartnerDashboard";
import { ogMetadata } from "@/lib/metadata";

export const metadata: Metadata = ogMetadata({
  title: "Partner dashboard",
  description:
    "Set your price, copy your embed and withdraw what you have earned. Every figure is read from the partner router on Robinhood Chain, so it is yours to verify.",
  path: "/partner/dashboard/",
  image: "/og/partner.png",
});

/**
 * The partner's own console, and deliberately not an application form.
 *
 * PetID's equivalent gates on approved resellers. This router is permissionless — anyone
 * can call `setPartner` — and both /partner/ and the widget README promise no approval
 * from us. A form here would contradict the product.
 *
 * A nested route rather than a query param on /partner/, because `vercel.json` rewrites a
 * bare `/[a-z0-9-]{1,32}` to the gateway's name card: `/partner/dashboard/` is two
 * segments and never matches that, and filesystem routes win over rewrites regardless.
 */
export default function PartnerDashboardPage() {
  return (
    <>
      <PageView />
      <Header />
      <main>
        <section className="shell pt-[clamp(40px,5vw,64px)]">
          <div className="eyebrow">partner dashboard</div>
          <h1 className="h-page mt-[18px]">Your listing.</h1>
          <p className="lede mt-5 max-w-[56ch]">
            Everything below is read from the router on Robinhood Chain and written back to
            it. We store none of it, which also means every number here is one you can check
            on the explorer without taking our word for it.{" "}
            <Link href="/partner/#integrate" className="link">
              How the integration works
            </Link>
            .
          </p>
        </section>

        <section className="shell section">
          <PartnerDashboard />
        </section>

        <div className="section" />
      </main>
      <Footer />
    </>
  );
}
