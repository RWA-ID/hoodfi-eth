import type { Metadata } from "next";
import Link from "next/link";
import { AddressToName } from "@/components/AddressToName";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { PageView } from "@/components/PageView";
import { PartnerForm } from "@/components/PartnerForm";
import { ogMetadata } from "@/lib/metadata";

export const metadata: Metadata = ogMetadata({
  title: "Become a partner",
  description:
    "Put readable names on your product. Wallets, exchanges, agents and apps on Robinhood Chain can hand their users a name instead of an address — tell us what you're building and we'll reply from a real address.",
  path: "/partner/",
  image: "/og/partner.png",
});

/**
 * The partner enquiry route.
 *
 * Exists because every inbound conversation so far has arrived by DM, which is not a
 * channel anyone can be pointed at from a footer. It leads with the demonstration
 * rather than the pitch: a partner evaluating this has to understand in one glance what
 * their users would actually get, and the shortest way to say it is to show forty-two
 * characters of hex becoming a word.
 *
 * The route name also has to be claimed. `vercel.json` rewrites any bare
 * `/[a-z0-9-]{1,32}` to the gateway's name card, so without a page here `/partner`
 * would resolve as a lookup for a name called "partner". Filesystem routes are matched
 * before rewrites, so this takes it — the same reason /mcp/ exists as a page.
 */

const OFFERS = [
  {
    n: "01",
    title: "Names in your product",
    body: "Your users mint a name from inside your app and it resolves everywhere ENS does — your interface, block explorers, every wallet that reads the standard. The registry is public, so nothing about it is only ours to read.",
  },
  {
    n: "02",
    title: "Your own namespace",
    body: "A parent name of your own, with subnames issued under it on whatever terms you set. Free for your users, priced, invite-only, or handed out with an account. You keep the parent.",
  },
  {
    n: "03",
    title: "Agents, not just people",
    body: "An MCP server already lets an agent check, price and register a name with no key held on our side. If your platform runs agents that need a stable identity, that path is built and live.",
  },
];

export default function PartnerPage() {
  return (
    <>
      <PageView />
      <Header />
      <main>
        <section className="shell pt-[clamp(40px,5vw,64px)]">
          <div className="duo items-end">
            <div>
              <div className="eyebrow">partners / hoodfi names</div>
              <h1 className="h-page mt-[18px]">
                Give your users a name, not an address.
              </h1>
            </div>
            <p className="lede m-0 mb-2.5 max-w-[46ch]">
              HoodFi issues lifetime ENS names on Robinhood Chain. If you run a wallet,
              an exchange, an app or a fleet of agents, there is a version of that worth
              doing together — tell us which one and a person will answer.
            </p>
          </div>

          <div className="mt-12 max-w-[720px]">
            <AddressToName />
          </div>
        </section>

        <section className="shell section">
          <div className="eyebrow">01 / what a partnership looks like</div>
          <h2 className="h-page mt-[18px]">Three shapes, so far.</h2>
          <div className="cells mt-11 border-t border-l border-[var(--line)]">
            {OFFERS.map((offer) => (
              <div
                key={offer.n}
                className="flex-[1_1_300px] border-b border-r border-[var(--line)] p-7"
              >
                <div className="data text-[12.5px] tracking-[0.14em] text-[var(--olive)]">
                  {offer.n}
                </div>
                <h3 className="h-sub mt-4">{offer.title}</h3>
                <p className="mt-3.5 text-sm leading-relaxed text-[var(--dim)]">
                  {offer.body}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-[70ch] text-sm leading-relaxed text-[var(--dim)]">
            None of them is a menu. If what you have in mind is a fourth thing, that is
            the more interesting email — and if you just want to ask a question, this
            form reaches the same inbox.{" "}
            <Link href="/how-it-works/" className="link">
              How the names work
            </Link>
            .
          </p>
        </section>

        <section className="shell section">
          <div className="eyebrow">02 / tell us</div>
          <div className="duo mt-[18px] items-start">
            <div>
              <h2 className="h-page m-0">Start the conversation.</h2>
              <p className="lede mt-5 max-w-[42ch]">
                Everything here is read by a person, and answered by one. There is no
                form-filling stage after this and nothing gets added to a list.
              </p>
              <div className="mt-9 border-t border-[var(--line)] pt-6">
                <div className="label">already building?</div>
                <p className="mt-2.5 max-w-[42ch] text-sm leading-relaxed text-[var(--dim)]">
                  The contracts, the gateway and the MCP server are all public. You can
                  read the whole thing before you write to us.
                </p>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <Link href="/mcp/" className="btn btn-ghost btn-sm">
                    MCP server
                  </Link>
                  <Link href="/#verify" className="btn btn-ghost btn-sm">
                    Contracts
                  </Link>
                </div>
              </div>
            </div>
            <PartnerForm />
          </div>
        </section>

        <div className="section" />
      </main>
      <Footer />
    </>
  );
}
