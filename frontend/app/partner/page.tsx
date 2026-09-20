import type { Metadata } from "next";
import Link from "next/link";
import { AddressToName } from "@/components/AddressToName";
import { ArrowNE } from "@/components/ArrowNE";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { PageView } from "@/components/PageView";
import { PartnerForm } from "@/components/PartnerForm";
import { ogMetadata } from "@/lib/metadata";
import { WIDGET_DOCS_URL } from "@/lib/site";

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

/**
 * The three moves an integrator makes, in order. Deliberately not a code sample: the
 * README is the reference and a snippet duplicated here is a snippet that goes stale
 * against it — the same way the README once advertised a free builder while the contract
 * charged. Prices are named nowhere on this page for the same reason; the partner reads
 * theirs back from `priceUsdc` and sets their own.
 */
const STEPS = [
  {
    n: "01",
    title: "Set your price",
    body: "One call to the partner router with your price, your display name and the address your margin should land in. The payout address is separate from the wallet you call it with, so a hot key can configure and a Safe can be paid.",
  },
  {
    n: "02",
    title: "Embed the widget",
    body: "A script tag. It renders the registration panel in your own accent colour, light or dark, isolated in a shadow root so neither your CSS nor ours can reach the other. There is no build step and nothing to install.",
  },
  {
    n: "03",
    title: "Withdraw",
    body: "Every sale credits the difference between your price and the base fee. It accrues on-chain and you withdraw in USDG whenever you like — a pull payment, so nothing about your treasury can hold up someone else's registration.",
  },
];

/**
 * The embed, in the smallest form that actually works.
 *
 * `0xYourPayoutWallet` is deliberately not valid hex. A realistic-looking address here
 * would be copy-pasted as-is by someone skimming, and every sale they made would credit
 * whoever owns it — the widget validates the address and throws instead, which is a
 * failure they will notice in the console on the first load.
 *
 * Kept to the two required attributes. The full reference lives in the widget README and
 * is not mirrored here: the attribute list is this page's to go stale against.
 */
const EMBED_SNIPPET = `<script
  src="https://unpkg.com/@hoodfi/widget/dist/widget.js"
  data-partner="0xYourPayoutWallet"
  data-accent="#c6f702"
></script>`;

/** Ink-ground code block, matching /mcp/ — the one place type goes monospace at length. */
function Code({ children }: { children: string }) {
  return (
    <pre className="panel panel-ink on-ink data overflow-x-auto p-5 text-[12.5px] leading-[1.75] text-[var(--fg)]">
      <code>{children}</code>
    </pre>
  );
}

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

        <section id="integrate" className="shell section">
          <div className="eyebrow">02 / the integration widget</div>
          <h2 className="h-page mt-[18px]">Sell names on your own site.</h2>
          <p className="lede mt-5 max-w-[56ch]">
            Set your own price, embed a script tag, keep the margin. No agreement to sign
            and no approval from us — the router is public and you onboard yourself.
          </p>

          <div className="cells mt-11 border-l border-t border-[var(--line)]">
            {STEPS.map((step) => (
              <div
                key={step.n}
                className="flex-[1_1_300px] border-b border-r border-[var(--line)] p-7"
              >
                <div className="data text-[12.5px] tracking-[0.14em] text-[var(--olive)]">
                  {step.n}
                </div>
                <h3 className="h-sub mt-4">{step.title}</h3>
                <p className="mt-3.5 text-sm leading-relaxed text-[var(--dim)]">
                  {step.body}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-9 max-w-[720px]">
            <div className="label">step 02, in full</div>
            <Code>{EMBED_SNIPPET}</Code>
            <p className="mt-3.5 text-sm leading-relaxed text-[var(--dim)]">
              That is the whole integration. Every other attribute — theme, price, the
              plain-button and iframe modes — is optional, and listed in the integration
              docs.
            </p>
          </div>

          <p className="mt-8 max-w-[70ch] text-sm leading-relaxed text-[var(--dim)]">
            Names of four characters and up only. One to three characters are reserved for
            the donors funding hoodfi.eth&apos;s registration, and the router refuses them
            — including after those tiers open to everyone.{" "}
            <Link href="/short-names/" className="link">
              Why short names are held back
            </Link>
            .
          </p>

          <div className="mt-8 flex flex-wrap gap-2.5">
            <a
              href={WIDGET_DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ink btn-sm"
            >
              Integration docs
              <ArrowNE />
            </a>
            <Link href="/mcp/" className="btn btn-ghost btn-sm">
              MCP server
            </Link>
          </div>
        </section>

        <section className="shell section">
          <div className="eyebrow">03 / tell us</div>
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
