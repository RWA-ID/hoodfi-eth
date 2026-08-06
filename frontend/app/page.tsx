import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { HeroIdCard } from "@/components/HeroIdCard";
import { CenturyRuler } from "@/components/CenturyRuler";
import { MintPanel } from "@/components/MintPanel";
import { DonatePanel } from "@/components/DonatePanel";
import { DonationsFeed } from "@/components/DonationsFeed";
import { PageView } from "@/components/PageView";
import { TIER_USD } from "@/lib/labels";
import { GOAL_YEARS, GOAL_YEAR_LABEL } from "@/lib/site";
import { ogMetadata } from "@/lib/metadata";

export const metadata: Metadata = ogMetadata({
  title: "Lifetime names on Robinhood Chain",
  description:
    "Mint a *.hoodfi.eth name in one transaction from $3. No renewals, no expiry — you own the ERC-721 and every record on it.",
  path: "/",
  image: "/og/default.png",
});

const STEPS = [
  {
    title: "Find your name",
    body: "Search any name up to 32 characters. Availability is read live from the registry on Robinhood Chain — no waitlist, no allowlist.",
  },
  {
    title: "Mint it",
    body: "One transaction, paid in ETH or USDG. From $3 for 4+ characters. The name is an ERC-721 that lands in your wallet immediately.",
  },
  {
    title: "Make it yours",
    body: "Point it at any address, add an avatar, link your X and website. Every record is written by you, straight to the registry.",
  },
  {
    title: "Keep it forever",
    body: "No renewals, no expiry, no annual bill. Lifetime means lifetime — the only ongoing cost is ours, keeping hoodfi.eth alive on Ethereum.",
  },
];

const TIERS = [
  { chars: "1 character", example: "x", usd: TIER_USD[0], premium: true },
  { chars: "2 characters", example: "og", usd: TIER_USD[1], premium: true },
  { chars: "3 characters", example: "gme", usd: TIER_USD[2], premium: true },
  { chars: "4+ characters", example: "blake", usd: TIER_USD[3], premium: false },
];

export default function Home() {
  return (
    <>
      <PageView />
      <Header />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Hero — the offer, opposite a claimed identity */}
        <section className="hero-glow grid items-center gap-6 pt-12 sm:pt-16 lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[1.05fr_0.95fr] lg:pt-0">
          <Reveal>
            <div className="eyebrow">ens names · robinhood chain · chain id 4663</div>
            {/* `block` keeps the second line on its own row: relying on natural
                wrapping lets the prod minifier eat the separating space. */}
            <h1 className="statement mt-4 max-w-[13ch] text-[clamp(40px,5.6vw,78px)]">
              Mint your name.
              <span className="block">Own it forever.</span>
            </h1>
            <p className="mt-5 max-w-[36ch] text-[clamp(16px,1.3vw,19px)] text-[var(--dim)]">
              A lifetime name like{" "}
              <span className="data text-[var(--paper)]">blake.hoodfi.eth</span> on
              Robinhood Chain. One transaction from $3 — no renewals, no expiry, ever.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/mint/" className="btn btn-primary">
                Mint a name
              </Link>
              <Link href="/manage/" className="btn btn-ghost">
                Manage your names
              </Link>
            </div>
          </Reveal>
          <Reveal>
            <HeroIdCard />
          </Reveal>
        </section>

        {/* Search is the primary action — put it directly under the fold */}
        <section id="mint" className="scroll-mt-24 py-20 sm:py-28">
          <Reveal>
            <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,420px)]">
              <div>
                <div className="eyebrow">start here</div>
                <h2 className="display mt-3 text-[clamp(28px,3.4vw,44px)]">
                  Is your name available?
                </h2>
                <p className="mt-4 max-w-[46ch] text-[clamp(15px,1.2vw,18px)] text-[var(--dim)]">
                  Names are lifetime ERC-721s. You control the records, the resolution
                  and the transfer — this site can&apos;t edit or reclaim anything once
                  it&apos;s yours.
                </p>
                <div className="mt-8">
                  {TIERS.map((tier) => (
                    <div key={tier.chars} className="ledger-row">
                      <span className="text-sm text-[var(--dim)]">
                        {tier.chars}{" "}
                        <span className="data text-[var(--faint)]">
                          {tier.example}.hoodfi.eth
                        </span>
                      </span>
                      <span className="data text-sm">
                        ${tier.usd}
                        {tier.premium && (
                          <span className="ml-2 text-[var(--faint)]">premium</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs leading-relaxed text-[var(--faint)]">
                  One-time, for life. 1–3 character names are premium inventory — see
                  below.
                </p>
              </div>
              <MintPanel />
            </div>
          </Reveal>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-24 border-t border-[var(--line)] py-20 sm:py-28">
          <Reveal>
            <div className="eyebrow">how it works</div>
            <h2 className="display mt-3 text-[clamp(28px,3.4vw,44px)]">
              Four steps, one transaction
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <Reveal key={step.title}>
                <div>
                  <div className="data text-sm text-[var(--faint)]">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="display mt-3 text-lg">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* The perk — donation drive, now clearly secondary */}
        <section
          id="extend"
          className="scroll-mt-24 border-t border-[var(--line)] py-20 sm:py-28"
        >
          <Reveal>
            <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,420px)]">
              <div>
                <div className="eyebrow">the perk</div>
                <h2 className="display mt-3 text-[clamp(28px,3.4vw,44px)]">
                  Want <span className="ok">x</span>, <span className="ok">og</span> or{" "}
                  <span className="ok">gme</span>?
                </h2>
                <p className="mt-4 max-w-[48ch] text-[clamp(15px,1.2vw,18px)] text-[var(--dim)]">
                  One, two and three character names are the scarcest inventory here —
                  there are only 37 possible single characters in total. They aren&apos;t
                  on public sale yet.
                </p>
                <p className="mt-4 max-w-[48ch] text-sm leading-relaxed text-[var(--dim)]">
                  The one way to get one today: add a year to hoodfi.eth&apos;s expiry on
                  Ethereum. Each year donated earns one credit, and a credit mints any
                  short name free. It costs about the price of a coffee and it&apos;s what
                  keeps the parent name — and therefore every name minted here — alive.
                </p>
                <p className="mt-4 max-w-[48ch] text-sm leading-relaxed text-[var(--dim)]">
                  At <span className="data text-[var(--paper)]">{GOAL_YEARS} years</span>{" "}
                  donated, short names open to everyone at the prices above. Credits still
                  mint free after that, so an early credit never loses its value.
                </p>
              </div>
              <DonatePanel />
            </div>
          </Reveal>
        </section>

        {/* Proof — the live ruler and the ledger */}
        <section className="border-t border-[var(--line)] py-20 sm:py-28">
          <Reveal>
            <div className="eyebrow">the endowment</div>
            <h2 className="display mt-3 text-[clamp(28px,3.4vw,44px)]">
              Funding hoodfi.eth to {GOAL_YEAR_LABEL}
            </h2>
            <p className="mt-4 max-w-[56ch] text-[clamp(15px,1.2vw,18px)] text-[var(--dim)]">
              Every name here is a subname of hoodfi.eth, so the parent name has to
              outlive them all. Donations renew it directly on the official ENS
              controller — read live below, straight from the .eth registrar.
            </p>
          </Reveal>
          <div className="mt-12">
            <Reveal>
              <CenturyRuler />
            </Reveal>
          </div>
          <div className="mt-12">
            <Reveal>
              <DonationsFeed />
            </Reveal>
          </div>
        </section>

        <section className="border-t border-[var(--line)] py-20 text-center sm:py-28">
          <Reveal>
            <h2 className="display text-[clamp(26px,3vw,40px)]">
              Your name is probably still free.
            </h2>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/mint/" className="btn btn-primary">
                Mint a name
              </Link>
              <Link href="/faq/" className="btn btn-ghost">
                Read the FAQ
              </Link>
            </div>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  );
}
