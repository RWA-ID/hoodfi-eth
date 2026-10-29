import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { FaqAccordion, type FaqItem } from "@/components/FaqAccordion";
import { PageView } from "@/components/PageView";
import { ogMetadata } from "@/lib/metadata";

export const metadata: Metadata = ogMetadata({
  title: "FAQ",
  description:
    "How minting, pricing, short-name credits, records and resolution work on hoodfi.eth.",
  path: "/faq/",
  image: "/og/faq.png",
});

const GROUPS: { heading: string; items: FaqItem[] }[] = [
  {
    heading: "Minting",
    items: [
      {
        q: "What am I actually buying?",
        a: "A lifetime ENS name on Robinhood Chain, held as an ERC-721 NFT in your wallet. There is no expiry and no renewal fee, ever — you pay once and it stays yours until you transfer or sell it.",
      },
      {
        q: "How much does a name cost?",
        a: "$3 for names of 4 or more characters. Short names are premium: $5 for 3 characters, $10 for 2 and $15 for 1. Prices are one-time, for life. Those figures are exact when you pay in USDG. Paying in ETH costs a fixed amount of ETH per tier — set to match the dollar price and re-pegged as ETH moves — so it lands near the figure rather than on it. The mint panel shows both before you sign.",
      },
      {
        q: "Which names can I mint?",
        a: "Any unregistered name of 1-32 characters using a-z, 0-9 and hyphens, with no leading or trailing hyphen. A small set of infrastructure labels (www, api, admin and similar) is permanently blocked. Every length is on public sale, first come, first served.",
      },
      {
        q: "Can I pay in something other than ETH?",
        a: "Yes — USDG, Robinhood Chain's stablecoin, at the same dollar price. Note that bridged USDC arrives on this chain as USDG.",
      },
      {
        q: "Do I need to do anything to keep my name?",
        a: "No. There is nothing to renew and no deadline to miss. The one ongoing cost belongs to us: keeping the parent name hoodfi.eth alive on Ethereum, which the HoodFi Safe renews every month.",
      },
    ],
  },
  {
    heading: "Short names & credits",
    items: [
      {
        q: "Can I buy a 1, 2 or 3 character name?",
        a: "Yes. They're the scarcest inventory here — there are only 37 possible single-character labels in total — and they're on public sale at the listed prices, first come, first served: $15 for one character, $10 for two, $5 for three.",
      },
      {
        q: "Can I still donate to earn a credit?",
        a: "No. Donations closed on October 27, 2026, when ENSv2 went live: the donation contract renewed hoodfi.eth through ENS's v1 controller, which ENSv2 retired, so a donation now reverts before any ETH moves. The HoodFi Safe renews the name itself instead — six years every month until its expiry reaches 2127.",
      },
      {
        q: "I donated. What happens to my credits?",
        a: "Nothing changes. Each year you donated earned one credit, and each credit still mints any 1, 2 or 3 character name free. Short names going on sale doesn't affect that.",
      },
      {
        q: "How does a credit earned on Ethereum work on Robinhood Chain?",
        a: "Our gateway reads your credit balance from the donation contract on mainnet and signs an attestation of it. The registrar on Robinhood Chain accepts that signature and tracks how many credits you've spent. The attestation covers your cumulative total, which only grows, so an old one can never be replayed to mint more than you earned. Anyone can independently verify the figure by reading shortCredits(yourAddress) on Ethereum.",
      },
      {
        q: "Do credits expire?",
        a: "No. Unspent credits stay spendable indefinitely, before and after short names went on public sale.",
      },
      {
        q: "Where did donated ETH go?",
        a: "Straight to the official ENS ETHRegistrarController, inside the donor's own transaction. The donation contract quoted ENS's live price, called renew() atomically, and refunded every wei above the real cost in the same transaction. It has no withdraw function and never held funds — its balance is zero on Etherscan.",
      },
      {
        q: "How is hoodfi.eth renewed now?",
        a: "By the HoodFi Safe, a 2-of-3 multisig that owns the name. Once a month it pays ENS's own ETHRenewerV1 in USDC for six more years — the length at which ENS's multi-year price bottoms out — until the expiry reaches 2127. Each renewal is a public transaction from the Safe, and the expiry it produces is read live on the homepage.",
      },
    ],
  },
  {
    heading: "Managing your name",
    items: [
      {
        q: "What can I set on my name?",
        a: "The address it resolves to, an avatar, your X handle, a link, a bio, and an IPFS website the name itself serves. More records are supported by the registry than the manage page exposes today.",
      },
      {
        q: "Can my name be a website?",
        a: "Yes. Pin a site to IPFS and paste its CID into the website field on the manage page — or an IPNS key, if you want to publish updates later without another transaction. The lookup page then shows a Visit button for anyone who searches your name, and ENS-aware browsers and gateways can open the name itself. It's the same mechanism this site uses: hoodfi.eth is served from IPFS through its own contenthash record.",
      },
      {
        q: "Who can change my records?",
        a: "Only you. The registry checks that the caller owns the name, so record writes go from your wallet straight to the contract. We cannot edit, freeze or reclaim a name once it's minted.",
      },
      {
        q: "What does it cost to update a record?",
        a: "Just Robinhood Chain gas, typically a fraction of a cent. Setting the address updates both the Robinhood Chain and mainnet ETH records in a single transaction.",
      },
    ],
  },
  {
    heading: "Ownership & resolution",
    items: [
      {
        q: "Do I really own my name?",
        a: "Yes. Each name is an ERC-721 NFT on Robinhood Chain. You can transfer it, sell it on any marketplace, and set your own records. No one — including us — can take a minted name back, and there are no renewal fees, ever.",
      },
      {
        q: "Will my name work in wallets and apps?",
        a: "Yes. Names resolve through the ENS Universal Resolver via CCIP-Read, so anything.hoodfi.eth works wherever ENS works: MetaMask, Rainbow, Etherscan, and apps on both Ethereum and Robinhood Chain.",
      },
      {
        q: "What happens to my name if hoodfi.eth ever expired?",
        a: "Subnames only resolve while the parent name exists, which is why the HoodFi Safe renews it every month. Your NFT itself never expires and stays in your wallet regardless, but resolution depends on hoodfi.eth staying registered — so the expiry is pushed further out with every renewal and published live on the homepage.",
      },
      {
        q: "What is Robinhood Chain?",
        a: "An Ethereum layer-2 built on Arbitrum technology, live on mainnet since July 2026 (chain id 4663). It uses ETH for gas and settles to Ethereum. hoodfi.eth names live there as NFTs; this project is independent and not affiliated with Robinhood Markets.",
      },
    ],
  },
];

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: GROUPS.flatMap((g) =>
      g.items.map((i) => ({
        "@type": "Question",
        name: i.q,
        acceptedAnswer: { "@type": "Answer", text: i.a },
      }))
    ),
  };

  return (
    <>
      <PageView />
      <Header />
      <main className="shell pb-24 pt-[clamp(40px,5vw,64px)]">
        <section className="duo items-end">
          <div>
            <div className="eyebrow">questions, answered plainly</div>
            <h1 className="h-page mt-[18px]">Everything, in order.</h1>
          </div>
          <p className="lede m-0 mb-2.5 max-w-[44ch]">
            The short version lives on the homepage. This is the whole of it — minting,
            credits, records, ownership and how resolution actually reaches your wallet.
          </p>
        </section>

        {/* The numbering runs through the page rather than restarting per group, so
            two rows never carry the same index. */}
        {GROUPS.map((g, gi) => (
          <section key={g.heading} className="mt-16">
            <h2 className="eyebrow">
              0{gi + 1} / {g.heading}
            </h2>
            <div className="mt-6">
              <FaqAccordion
                items={g.items}
                startIndex={GROUPS.slice(0, gi).reduce((n, x) => n + x.items.length, 0)}
              />
            </div>
          </section>
        ))}
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
