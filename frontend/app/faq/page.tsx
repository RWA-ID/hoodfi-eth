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
        a: "$3 for names of 4 or more characters, paid in ETH or USDG. Short names are premium: $5 for 3 characters, $10 for 2 and $15 for 1. Prices are one-time, for life.",
      },
      {
        q: "Which names can I mint?",
        a: "Any unregistered name of 1-32 characters using a-z, 0-9 and hyphens, with no leading or trailing hyphen. A small set of infrastructure labels (www, api, admin and similar) is permanently blocked. Names of 4+ characters are open to everyone right now; 1-3 character names need a credit until the 100-year goal is reached.",
      },
      {
        q: "Can I pay in something other than ETH?",
        a: "Yes — USDG, Robinhood Chain's stablecoin, at the same dollar price. Note that bridged USDC arrives on this chain as USDG.",
      },
      {
        q: "Do I need to do anything to keep my name?",
        a: "No. There is nothing to renew and no deadline to miss. The one ongoing cost belongs to us: keeping the parent name hoodfi.eth alive on Ethereum, which is what the donation drive funds.",
      },
    ],
  },
  {
    heading: "Short names & credits",
    items: [
      {
        q: "Why can't I just buy a 1, 2 or 3 character name?",
        a: "They're the scarcest inventory here — there are only 37 possible single-character labels in total. Until hoodfi.eth's expiry reaches the 100-year goal, they're reserved for people who helped fund it. After the goal they open to everyone at the listed prices.",
      },
      {
        q: "How do I earn a credit?",
        a: "Donate a year to hoodfi.eth's expiry on Ethereum — about $5, the exact ENS renewal price. Each year donated earns one credit, and one credit mints any 1, 2 or 3 character name free.",
      },
      {
        q: "How does a credit earned on Ethereum work on Robinhood Chain?",
        a: "Our gateway reads your credit balance from the donation contract on mainnet and signs an attestation of it. The registrar on Robinhood Chain accepts that signature and tracks how many credits you've spent. The attestation covers your cumulative total, which only grows, so an old one can never be replayed to mint more than you earned. Anyone can independently verify the figure by reading shortCredits(yourAddress) on Ethereum.",
      },
      {
        q: "Do credits expire, or lose value after the goal?",
        a: "Neither. Unspent credits stay spendable indefinitely, and they still mint short names free even after short names open to public sale — so an early credit is never worth less than a late one.",
      },
      {
        q: "Where does my donated ETH actually go?",
        a: "Straight to the official ENS ETHRegistrarController, inside your own transaction. The donation contract quotes ENS's live price, calls renew() atomically, and refunds every wei above the real cost in the same transaction. It has no withdraw function and can't hold funds — you can verify its balance is always zero on Etherscan.",
      },
      {
        q: "Can I still donate after the goal is reached?",
        a: "Yes. Donations keep working and keep earning credits, and the separate extend() function pushes hoodfi.eth's expiry further without earning any. Both stay open permanently.",
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
        a: "Subnames only resolve while the parent name exists, which is exactly why the donation drive exists. Your NFT itself never expires and stays in your wallet regardless, but resolution depends on hoodfi.eth staying registered — so the expiry is pushed further out with every donation and published live on the homepage.",
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
