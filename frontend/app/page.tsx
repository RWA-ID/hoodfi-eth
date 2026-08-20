import type { Metadata } from "next";
import Link from "next/link";
import { ArrowNE } from "@/components/ArrowNE";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MintPanel } from "@/components/MintPanel";
import { MintQueryProvider } from "@/components/MintQuery";
import { StatBar } from "@/components/StatBar";
import { Ticker } from "@/components/Ticker";
import { TierGrid } from "@/components/TierGrid";
import { BuildSite } from "@/components/BuildSite";
import { IdentityCard } from "@/components/IdentityCard";
import { FundTheCentury } from "@/components/FundTheCentury";
import { ResolutionGrids } from "@/components/ResolutionGrids";
import { ContractsTable } from "@/components/ContractsTable";
import { WalletLockup } from "@/components/WalletLockup";
import { FaqAccordion, type FaqItem } from "@/components/FaqAccordion";
import { PageView } from "@/components/PageView";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chains";
import { ogMetadata } from "@/lib/metadata";

export const metadata: Metadata = ogMetadata({
  title: "Lifetime names on Robinhood Chain",
  description:
    "Mint a *.hoodfi.eth name in one transaction from $3. No renewals, no expiry — you own the ERC-721 and every record on it.",
  path: "/",
  image: "/og/default.png",
});

/** What a name is, as a ledger. Six rows, six claims, each one checkable. */
const FACTS: [string, string][] = [
  ["token", "A lifetime ERC-721 in your wallet the moment the transaction confirms."],
  ["renewals", "None. There is no expiry, no grace period and nothing to forget."],
  ["records", "Address, avatar, X handle, website and bio — saved in a single signature."],
  ["control", "Owner only. The registrar has no authority over a name once it is minted."],
  ["resolution", "Ethereum mainnet plus every EVM chain from one address record."],
  ["transfer", "Freely tradable. No admin burn, no reclaim, no seizure path exists."],
];

const LEDGER: [string, string][] = [
  ["network", `Robinhood Chain · ${ROBINHOOD_CHAIN_ID}`],
  ["standard", "ERC-721 · ENS subname"],
  ["payment", "ETH or USDG"],
  ["audit", "No external audit yet"],
];

const GUARANTEES = [
  "The donation contract has no withdraw function and never holds funds.",
  "No admin burn or transfer exists — a minted name cannot be seized.",
  "Owners set their own records directly on the registry.",
  "Every ledger row carries its transaction hash, so nothing needs our word.",
];

const FAQ: FaqItem[] = [
  {
    q: "What does $3 actually buy?",
    a: "A lifetime ERC-721 for a name of four characters or more, minted in one transaction. There is no second payment — no renewal, no expiry, no grace period.",
  },
  {
    q: "Why are 1–3 character names locked?",
    a: "They are premium inventory reserved to fund the parent name. Until hoodfi.eth's expiry is funded 100 years ahead, they can only be minted with short-name credits earned by donating a year. At the goal they open to everyone at tier prices, and credits still mint them free.",
  },
  {
    q: "Can you take my name back?",
    a: "No. There is no admin burn, transfer or reclaim function in the registrar, and re-minting an existing name reverts. Once it is in your wallet the site has no authority over it.",
  },
  {
    q: "Will my wallet recognise it?",
    a: "If it speaks ENS, yes. Names resolve from Ethereum mainnet through the ENS Universal Resolver using wildcard resolution and CCIP-Read, so no client needs to know about Robinhood Chain.",
  },
  {
    q: "What can I put on a name?",
    a: "An address for Ethereum and every EVM chain, separate Bitcoin and Solana records, an avatar, an X handle, a website and a bio. Every change in the form saves as one multicall, so it costs a single signature however many records moved.",
  },
  {
    q: "Is this affiliated with Robinhood?",
    a: "No. This is an independent project, not affiliated with, endorsed by or connected to Robinhood Markets, Inc. It is built on Robinhood Chain because that is where the chain is.",
  },
];

export default function Home() {
  return (
    <>
      <PageView />
      <Header />
      <MintQueryProvider>
        <main id="top">
          {/* ── Hero. The only lime field above the fold: the page opens on the
              product's one colour, and the mint card is the one dark object in it. */}
          <section className="on-lime border-b border-[var(--ink)]">
            <div className="shell grid items-start gap-14 pb-[68px] pt-[clamp(48px,6vw,76px)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr))]">
              {/* The size container the hero headline is measured against. It has to
                  be this element rather than the <h1>: `cqi` resolves against the
                  nearest container *ancestor*, so the box being sized can't be the
                  one that establishes it. */}
              <div className="[container-type:inline-size]">
                <div className="eyebrow">
                  ENS names · Robinhood Chain · id {ROBINHOOD_CHAIN_ID}
                </div>
                {/* An explicit <br>, not natural wrapping: the prod minifier eats the
                    space around a line break and the two words fuse. */}
                <h1 className="h-hero mt-[22px]">
                  Your name
                  <br />
                  forever
                </h1>
                <p className="mt-[30px] max-w-[40ch] text-[19px] font-medium leading-[1.5] text-pretty">
                  Mint a lifetime <span className="data text-[17px]">*.hoodfi.eth</span>{" "}
                  name on Robinhood Chain. One transaction from $3 — no renewals, no
                  expiry, no landlord.
                </p>
                <div className="mt-[34px] flex flex-wrap gap-2.5">
                  <Link href="/mint/" className="btn btn-ink">
                    Mint a name <ArrowNE />
                  </Link>
                  <Link href="/how-it-works/" className="btn btn-ghost">
                    How it works
                  </Link>
                </div>
              </div>

              <MintPanel handoffOnConnect />
            </div>
          </section>

          <StatBar />
          <Ticker />

          {/* ── 01 — the price ladder, driven by whatever is typed above. */}
          <section id="names" className="shell section">
            <div className="eyebrow">01 / pick a name</div>
            <div className="duo mt-[18px] items-end">
              <h2 className="h-section m-0">Choose your name.</h2>
              <p className="lede m-0 mb-2.5 max-w-[44ch]">
                Price is set by length and paid once. Nothing renews, nothing expires,
                and no one can take it back. Type above and the matching tier lights up.
              </p>
            </div>
            <TierGrid />
          </section>

          {/* ── 02 — what the thing actually is, beside a picture of one. */}
          <section id="own" className="shell section">
            <div className="eyebrow">02 / what you get</div>
            <h2 className="h-section mt-[18px] max-w-[15ch]">
              An identity, not a subscription.
            </h2>
            <div className="duo mt-[52px] items-start">
              <div className="min-w-0 border-t border-[var(--line)]">
                {FACTS.map(([key, value]) => (
                  <div key={key} className="ledger-row">
                    <span className="data text-[11px] uppercase tracking-[0.16em] text-[var(--label)]">
                      {key}
                    </span>
                    <span className="text-[17px] font-medium leading-[1.5] text-pretty">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              <IdentityCard />
            </div>
          </section>

          {/* ── 03 — the record nobody knows they have, and the tool that fills it.
              The builder is a deployment of its own and was reachable from nowhere on
              this site, so a name's most interesting record went unused by default. */}
          <section id="website" className="shell section">
            <div className="eyebrow">03 / your website</div>
            <BuildSite />
          </section>

          {/* ── 04 — the drive that keeps the parent name alive. */}
          <section id="short" className="shell section">
            <div className="eyebrow">04 / short names</div>
            <FundTheCentury />
          </section>

          {/* ── 05 — the answer to "will anything I use recognise this?" */}
          <section id="resolves" className="shell section">
            <div className="eyebrow">05 / resolution</div>
            <div className="duo mt-[18px] items-end">
              <h2 className="h-section m-0">Works where you already are.</h2>
              <p className="lede m-0 mb-2.5 max-w-[44ch]">
                Names resolve from Ethereum mainnet through the ENS Universal Resolver,
                so anything that speaks ENS finds yours — no plugin, no allowlist.
              </p>
            </div>
            <ResolutionGrids />
            <p className="data mt-5 max-w-[88ch] text-[11.5px] leading-[1.7] text-[var(--faint)]">
              One address record covers Ethereum and every EVM chain. Bitcoin and Solana are
              stored as separate ENSIP-9 records in each chain&apos;s own encoding.
            </p>
          </section>

          {/* ── 06 — every address, every guarantee, nothing taken on trust. */}
          <section id="verify" className="shell section">
            <div className="eyebrow">06 / transparency</div>
            <div className="duo mt-[18px] items-end">
              <h2 className="h-section m-0">Verify everything.</h2>
              <p className="lede m-0 mb-2.5 max-w-[44ch]">
                Nothing here asks for trust. Every contract is public, every mint is your
                own signature, and the donation contract has no withdraw function at all.
              </p>
            </div>

            <ContractsTable />

            <div className="cells mt-3.5 border border-[var(--line-card)]">
              {LEDGER.map(([key, value]) => (
                <div
                  key={key}
                  className="flex-[1_1_190px] border-l border-[var(--line-soft)] px-[22px] py-5"
                >
                  <div className="label" style={{ letterSpacing: "0.16em" }}>
                    {key}
                  </div>
                  <div className="mt-2.5 text-[19px] font-bold tracking-[-0.02em]">
                    {value}
                  </div>
                </div>
              ))}
            </div>

            <div className="on-ink cells mt-3.5">
              {GUARANTEES.map((text) => (
                <div
                  key={text}
                  className="flex flex-[1_1_320px] items-baseline gap-3 border-b border-[var(--line-soft)] px-6 py-[18px]"
                >
                  <span className="chip-square" aria-hidden />
                  <span className="text-[14.5px] leading-[1.5] text-[rgba(241,241,234,0.85)]">
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ── 07 — the six questions people actually arrive with. */}
          <section id="faq" className="shell section">
            <div className="eyebrow">07 / questions</div>
            <h2 className="h-section mt-[18px]">Answered plainly.</h2>
            <div className="mt-11">
              <FaqAccordion items={FAQ} />
            </div>
            <p className="mt-8 text-sm text-[var(--dim)]">
              More detail on{" "}
              <Link href="/faq/" className="link">
                the full FAQ
              </Link>
              .
            </p>
          </section>

          <section className="on-lime mt-28 border-y border-[var(--ink)]">
            <div className="shell py-[clamp(64px,8vw,96px)] text-center">
              <h2 className="h-cta m-0">
                Your name is
                <br />
                probably still free
              </h2>
              <div className="mt-10 flex flex-wrap justify-center gap-2.5">
                <Link href="/mint/" className="btn btn-ink btn-lg">
                  Mint a name <ArrowNE />
                </Link>
                <Link href="/faq/" className="btn btn-ghost btn-lg">
                  Read the FAQ
                </Link>
              </div>
            </div>
          </section>

          <WalletLockup />
        </main>
      </MintQueryProvider>
      <Footer />
    </>
  );
}
