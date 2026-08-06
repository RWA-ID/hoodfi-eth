import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { MintPanel } from "@/components/MintPanel";
import { PageView } from "@/components/PageView";
import { TIER_USD } from "@/lib/labels";
import { ogMetadata } from "@/lib/metadata";

export const metadata: Metadata = ogMetadata({
  title: "Mint your name",
  description:
    "Search and mint a lifetime *.hoodfi.eth name on Robinhood Chain. From $3, one transaction, no renewals ever.",
  path: "/mint/",
  image: "/og/mint.png",
});

const TIERS = [
  { chars: "1 character", example: "x", usd: TIER_USD[0], premium: true },
  { chars: "2 characters", example: "og", usd: TIER_USD[1], premium: true },
  { chars: "3 characters", example: "gme", usd: TIER_USD[2], premium: true },
  { chars: "4+ characters", example: "blake", usd: TIER_USD[3], premium: false },
];

export default function MintPage() {
  return (
    <>
      <PageView />
      <Header />
      <main className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <section className="hero-glow pt-12 sm:pt-16">
          <Reveal>
            <div className="eyebrow">robinhood chain · chain id 4663</div>
            {/* accent is `block` so the two type treatments always land on their own
                lines — relying on natural wrapping puts them flush against each other
                and the minifier eats the separating space. */}
            <h1 className="statement mt-4 max-w-[14ch] text-[clamp(36px,4.6vw,64px)]">
              Mint your name.
              <span className="accent block">Keep it forever.</span>
            </h1>
            <p className="mt-5 max-w-[52ch] text-[clamp(16px,1.3vw,19px)] text-[var(--dim)]">
              A lifetime ENS name on Robinhood Chain. One transaction, no renewals, no
              expiry — you own the ERC-721 and every record on it.
            </p>
          </Reveal>
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <Reveal>
            <div className="flex flex-col gap-6">
              <div className="panel p-6 sm:p-8">
                <h2 className="display text-lg">What you get</h2>
                <ul className="mt-4 flex flex-col gap-3 text-sm text-[var(--dim)]">
                  <li className="flex gap-3">
                    <span className="ok">→</span>
                    <span>
                      A <span className="text-[var(--paper)]">lifetime</span> ERC-721.
                      No renewal, no expiry date, nothing to forget.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="ok">→</span>
                    <span>
                      Full control of your records — address, avatar, X, website, bio.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="ok">→</span>
                    <span>
                      Resolves from Ethereum mainnet through CCIP-Read, so wallets that
                      speak ENS find it.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="ok">→</span>
                    <span>Pay in ETH or USDG, whichever you already hold.</span>
                  </li>
                </ul>
              </div>

              <div className="panel p-6 sm:p-8">
                <h2 className="display text-lg">Pricing</h2>
                <div className="mt-4">
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
                  One-time, for life. 1–3 character names are premium inventory: they
                  unlock for everyone once hoodfi.eth&apos;s expiry reaches the 100-year
                  goal, and donors can mint them free before then.{" "}
                  <Link href="/#extend" className="underline">
                    Earn a credit
                  </Link>
                  .
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal>
            <div className="lg:sticky lg:top-24">
              <MintPanel />
            </div>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  );
}
