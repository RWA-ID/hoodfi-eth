import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "FAQ — hoodfi.eth",
  description:
    "How donations, reservations, free claims and public registration work on hoodfi.eth.",
};

const GROUPS: { heading: string; items: { q: string; a: string }[] }[] = [
  {
    heading: "Donations",
    items: [
      {
        q: "Where does my ETH actually go?",
        a: "Straight to the official ENS ETHRegistrarController, inside your own transaction. The hoodfi donation contract quotes ENS's live price, calls renew() atomically, and refunds every wei above the real cost back to you in the same transaction. It has no withdraw function and can't hold funds — you can verify its balance is always zero on Etherscan.",
      },
      {
        q: "How much does a year cost?",
        a: "Exactly what ENS charges to renew hoodfi.eth: about $5 per year, priced in ETH by ENS's own oracle at the moment your transaction lands. The site adds a 5% buffer so price drift can't fail your transaction; the excess is refunded automatically.",
      },
      {
        q: "What do I get for donating?",
        a: "One reserved name slot per year donated. Slots don't expire — spend them on specific names during the donation or any time before the 1,000-year snapshot.",
      },
      {
        q: "Can I still help after the goal is reached?",
        a: "Yes. The extend() function stays open forever and keeps pushing hoodfi.eth's expiry further — it just doesn't earn name slots after the snapshot.",
      },
    ],
  },
  {
    heading: "Reservations",
    items: [
      {
        q: "Which names can I reserve?",
        a: "Any unreserved name of 4 or more characters (a–z, 0–9, hyphens; no leading or trailing hyphen; max 32). First come, first served. 1–3 character names are premium inventory sold only at public launch — $15, $10 and $5 respectively.",
      },
      {
        q: "Where are reservations stored?",
        a: "Onchain, in the donation contract on Ethereum. Every reservation emits a public NameReserved event, and the snapshot copied to Robinhood Chain at launch can be verified by anyone against those logs.",
      },
      {
        q: "What happens if I never claim my reserved name?",
        a: "Reserved names stay blocked from public sale for 30 days after claims open. After that they can be released into the public pool, so claim within the window.",
      },
    ],
  },
  {
    heading: "Launch & claiming",
    items: [
      {
        q: "When is launch?",
        a: "The moment total donations reach 1,000 years, anyone can call finalize() to freeze the snapshot. Claims open on Robinhood Chain shortly after, followed the same day by public registration at $3.",
      },
      {
        q: "What does claiming cost?",
        a: "Nothing but Robinhood Chain gas — typically a fraction of a cent. Your name mints as an NFT directly to the wallet that made the donation.",
      },
      {
        q: "What is Robinhood Chain?",
        a: "An Ethereum layer-2 built on Arbitrum technology, live on mainnet since July 2026 (chain id 4663). It uses ETH for gas and settles to Ethereum. hoodfi.eth names live there as NFTs; this project is independent and not affiliated with Robinhood Markets.",
      },
    ],
  },
  {
    heading: "Ownership & resolution",
    items: [
      {
        q: "Do I really own my name?",
        a: "Yes. Each name is an ERC-721 NFT on Robinhood Chain. You can transfer it, sell it, and set your own address, avatar and text records. No one — including the hoodfi team — can take a minted name back, and there are no renewal fees, ever.",
      },
      {
        q: "Will my name work in wallets and apps?",
        a: "Yes. Names resolve through the ENS Universal Resolver via CCIP-Read, so anything.hoodfi.eth works wherever ENS works: MetaMask, Rainbow, Etherscan, and apps on both Ethereum and Robinhood Chain.",
      },
      {
        q: "Does the 1,000-year expiry cover my subname?",
        a: "That's the point of the whole mechanism. Subnames only resolve while the parent name exists, so pushing hoodfi.eth's expiry to the year 3026 secures every name under it for the next millennium. Your NFT itself never expires.",
      },
      {
        q: "Why does hoodfi.eth need 1,000 years anyway?",
        a: "If the parent name ever expired, every name under it would stop resolving. Prepaying a millennium of renewals removes that risk entirely — and it's community-funded, onchain, and publicly verifiable.",
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
      <Header />
      <main className="mx-auto max-w-3xl px-4 sm:px-6">
        <section className="pt-16 sm:pt-20">
          <div className="eyebrow">questions, answered plainly</div>
          <h1 className="display mt-4 text-3xl sm:text-5xl">FAQ</h1>
        </section>
        {GROUPS.map((g) => (
          <section key={g.heading} className="mt-12">
            <h2 className="eyebrow">{g.heading}</h2>
            <div className="mt-4">
              {g.items.map((item) => (
                <details
                  key={item.q}
                  className="group border-b border-[var(--line)] py-4"
                >
                  <summary className="cursor-pointer list-none text-base font-medium marker:content-none">
                    <span className="flex items-baseline justify-between gap-4">
                      {item.q}
                      <span className="data text-[var(--faint)] transition-transform group-open:rotate-45">
                        +
                      </span>
                    </span>
                  </summary>
                  <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-[var(--dim)]">
                    {item.a}
                  </p>
                </details>
              ))}
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
