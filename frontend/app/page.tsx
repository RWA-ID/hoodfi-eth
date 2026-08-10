import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { HeroIdCard } from "@/components/HeroIdCard";
import { MintPanel } from "@/components/MintPanel";
import { MintQueryProvider } from "@/components/MintQuery";
import { ConnectMintButton } from "@/components/ConnectMintButton";
import { DonatePanel } from "@/components/DonatePanel";
import { Endowment } from "@/components/Endowment";
import { ShortNamesCopy } from "@/components/ShortNamesCopy";
import { ResolvesEverywhere } from "@/components/ResolvesEverywhere";
import { PageView } from "@/components/PageView";
import { TIER_USD } from "@/lib/labels";
import { STEPS } from "@/lib/steps";

import { ogMetadata } from "@/lib/metadata";

export const metadata: Metadata = ogMetadata({
  title: "Lifetime names on Robinhood Chain",
  description:
    "Mint a *.hoodfi.eth name in one transaction from $3. No renewals, no expiry — you own the ERC-721 and every record on it.",
  path: "/",
  image: "/og/default.png",
});

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
      <main className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 2xl:px-12">
        {/* Hero — the offer, opposite a claimed identity */}
        {/* No min-h/centering here: forcing the row to a full viewport pushed the
            headline into the middle of the screen and left a dead band above it. */}
        <MintQueryProvider>
        <section className="hero-glow grid items-start gap-8 pt-8 sm:pt-10 lg:grid-cols-[1.2fr_0.8fr] lg:gap-12 lg:pt-12">
          <Reveal>
            <div className="eyebrow">ens names · robinhood chain · chain id 4663</div>
            {/* `.bloom` is display:block, keeping the second line on its own row:
                relying on natural wrapping lets the prod minifier eat the space. */}
            <h1 className="statement mt-4 max-w-[14ch] text-[clamp(44px,6.4vw,88px)]">
              Mint your name.
              <span className="bloom">Own it forever.</span>
            </h1>
            {/* Both of these are desktop-only. Most phone traffic arrives from a link
                on X intending to mint, and on a 390px screen this paragraph and button
                row are ~180px of preamble between the headline and the only input that
                matters — while "How it works" points at a section that is itself hidden
                on mobile. The panel below says the same things in a form you can act on. */}
            <p className="mt-5 hidden max-w-[36ch] text-[clamp(16px,1.3vw,19px)] text-[var(--dim)] sm:block">
              A lifetime name like{" "}
              <span className="data text-[var(--paper)]">blake.hoodfi.eth</span> on
              Robinhood Chain. One transaction from $3 — no renewals, no expiry, ever.
            </p>
            {/* No primary CTA here any more — the mint panel opposite *is* the
                primary action, and a green "Mint a name" button beside it just
                competes with the thing it points at. */}
            <div className="mt-7 hidden flex-wrap gap-3 sm:flex">
              <ConnectMintButton />
              <Link href="#how" className="btn btn-ghost">
                How it works
              </Link>
            </div>
          </Reveal>
          <Reveal>
            <MintPanel handoffOnConnect />
          </Reveal>
        </section>
        </MintQueryProvider>

        {/* The whole pitch, at the size a phone deserves. Everything that argues for
            the product is hidden below `sm`, so without this a mobile visitor gets a
            price and no reason — and the drawer is one tap away for the long version. */}
        <section className="pb-14 pt-8 sm:hidden">
          <ul className="flex flex-col gap-3 text-sm text-[var(--dim)]">
            {[
              "Lifetime ERC-721 — no renewals, no expiry, nothing to forget.",
              "Resolves from Ethereum mainnet, so wallets that speak ENS find it.",
              "You control every record. This site can't edit or reclaim your name.",
            ].map((line) => (
              <li key={line} className="flex gap-3">
                <span className="ok">→</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* What you actually get, opposite the card that shows it */}
        <section id="mint" className="hidden scroll-mt-24 pt-10 pb-16 sm:block sm:pt-14 sm:pb-20">
          <Reveal>
            <div className="grid items-center gap-10 lg:grid-cols-[1fr_minmax(0,480px)]">
              <div>
                <div className="eyebrow">what you get</div>
                <h2 className="display mt-3 text-[clamp(28px,3.4vw,44px)]">
                  An identity, not a subscription
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
              <HeroIdCard />
            </div>
          </Reveal>
        </section>

        {/* How it works */}
        <section id="how" className="hidden scroll-mt-24 border-t border-[var(--line)] py-20 sm:block sm:py-28">
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

        {/* Where the name actually reaches — answers the question every new visitor
            has right after "what is it": will anything I use recognise this? */}
        <section
          id="resolves"
          className="hidden scroll-mt-24 border-t border-[var(--line)] py-20 sm:block sm:py-28"
        >
          <Reveal>
            <ResolvesEverywhere />
          </Reveal>
        </section>

        {/* The perk — donation drive, now clearly secondary */}
        <section
          id="extend"
          className="hidden scroll-mt-24 border-t border-[var(--line)] py-20 sm:block sm:py-28"
        >
          <Reveal>
            <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,420px)]">
              <ShortNamesCopy />
              <DonatePanel />
            </div>
          </Reveal>
        </section>

        {/* Proof — the live ruler and the ledger */}
        <section className="hidden border-t border-[var(--line)] py-20 sm:block sm:py-28">
          <Endowment />
        </section>

        <section className="hidden border-t border-[var(--line)] py-20 text-center sm:block sm:py-28">
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
