import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { MillenniumRuler } from "@/components/MillenniumRuler";
import { DonatePanel } from "@/components/DonatePanel";
import { DonationsFeed } from "@/components/DonationsFeed";
import { TIER_USD } from "@/lib/labels";

const STEPS = [
  {
    title: "Donate years",
    body: "Pick how many years to add to hoodfi.eth's expiry. ETH goes straight to the official ENS controller in one transaction — about $5 per year, refunds included.",
  },
  {
    title: "Reserve your names",
    body: "Every year donated is one name slot. Lock in exact names during your donation or later — first come, first served, all recorded onchain.",
  },
  {
    title: "Snapshot at 1,000",
    body: "When the total hits 1,000 years, reservations freeze. The snapshot is public — anyone can verify it against the Ethereum logs.",
  },
  {
    title: "Claim free on Robinhood Chain",
    body: "Donors mint their reserved names for nothing but L2 gas. Right after, public registration opens for everyone else.",
  },
];

const TIERS = [
  { chars: "1 character", example: "x", usd: TIER_USD[0] },
  { chars: "2 characters", example: "og", usd: TIER_USD[1] },
  { chars: "3 characters", example: "gme", usd: TIER_USD[2] },
  { chars: "4+ characters", example: "blake", usd: TIER_USD[3] },
];

export default function Home() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Hero — the thesis */}
        <section className="hero-glow pt-16 sm:pt-24">
          <Reveal>
            <div className="eyebrow">ens names · robinhood chain · chain id 4663</div>
            <h1 className="display mt-4 max-w-3xl text-4xl sm:text-6xl">
              Fund the millennium.{" "}
              <span className="ok">Own your name forever.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-[var(--dim)] sm:text-lg">
              HoodFi.eth is being funded to a 1,000-year expiry on Ethereum. Donate a
              year, reserve a name like{" "}
              <span className="data text-[var(--paper)]">blake.hoodfi.eth</span> — and
              claim it free on Robinhood Chain the day we hit the goal.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#donate" className="btn btn-primary">
                Donate + reserve
              </a>
              <Link href="/faq/" className="btn btn-ghost">
                Read the FAQ
              </Link>
            </div>
          </Reveal>
        </section>

        {/* Signature: the millennium ruler */}
        <section className="mt-16 sm:mt-24">
          <Reveal>
            <MillenniumRuler />
          </Reveal>
        </section>

        {/* Donate + live ledger */}
        <section id="donate" className="mt-20 grid gap-6 sm:mt-28 lg:grid-cols-2">
          <Reveal>
            <DonatePanel />
          </Reveal>
          <Reveal delay={80}>
            <DonationsFeed />
          </Reveal>
        </section>

        {/* How it works — a real sequence, so numbers carry meaning */}
        <section id="how" className="mt-24 sm:mt-32">
          <Reveal>
            <div className="eyebrow">the mechanism</div>
            <h2 className="display mt-3 text-3xl sm:text-4xl">
              Years in, names out.
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-px overflow-hidden rounded-md border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 60} className="bg-[var(--panel)] p-6">
                <div className="data text-xs text-[var(--faint)]">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="display mt-3 text-lg">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">{s.body}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mt-24 sm:mt-32">
          <Reveal>
            <div className="eyebrow">public sale · after launch</div>
            <h2 className="display mt-3 text-3xl sm:text-4xl">
              One price, one time, yours for life.
            </h2>
            <p className="mt-3 max-w-xl text-sm text-[var(--dim)]">
              Names never expire and never charge renewal. Short names are premium
              inventory sold only at public launch — they can&apos;t be reserved with
              donations. Pay in ETH or USDG.
            </p>
          </Reveal>
          <div className="mt-8 grid gap-px overflow-hidden rounded-md border border-[var(--line)] bg-[var(--line)] sm:grid-cols-4">
            {TIERS.map((t, i) => (
              <Reveal key={t.chars} delay={i * 60} className="bg-[var(--panel)] p-6">
                <div className="data text-3xl font-semibold">${t.usd}</div>
                <div className="mt-1 text-sm text-[var(--dim)]">{t.chars}</div>
                <div className="data mt-4 text-xs text-[var(--faint)]">
                  {t.example}
                  <span className="text-[var(--dim)]">.hoodfi.eth</span>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Ownership + resolution guarantees */}
        <section className="mt-24 sm:mt-32">
          <div className="grid gap-6 lg:grid-cols-3">
            <Reveal className="panel p-6">
              <h3 className="display text-lg">Yours, fully.</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
                Every name is an NFT on Robinhood Chain. Transfer it, sell it, set your
                own records — nobody can revoke it, and there&apos;s no renewal fee,
                ever.
              </p>
            </Reveal>
            <Reveal delay={60} className="panel p-6">
              <h3 className="display text-lg">Resolves everywhere.</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
                Full ENS compatibility through the Universal Resolver — your name works
                in MetaMask, Rainbow, Etherscan and every ENS-aware app.
              </p>
            </Reveal>
            <Reveal delay={120} className="panel p-6">
              <h3 className="display text-lg">Trustless by construction.</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
                Donations renew hoodfi.eth atomically — the contract can&apos;t hold a
                single wei. Progress, reservations and the snapshot are all readable
                from the chain.
              </p>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
