import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — HoodFi.eth",
  description:
    "How HoodFi.eth handles data: a static IPFS site with no server, no accounts, no cookies and no analytics.",
};

const UPDATED = "July 11, 2026";

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="what we know about you: almost nothing"
      title="Privacy Policy"
      updated={UPDATED}
      intro={
        <>
          HoodFi.eth is a static website served over IPFS. It has no server, no
          database, no user accounts, no cookies, and no analytics or tracking scripts.
          We do not collect, store, sell, or share personal data. This policy explains
          the little that does happen with data when you use the site.
        </>
      }
      sections={[
        {
          heading: "What we don't collect",
          paragraphs: [
            <>
              We do not collect names, email addresses, IP addresses, device
              fingerprints, or usage analytics. There is no backend to send them to:
              the site is published as static files and everything runs in your
              browser.
            </>,
          ],
        },
        {
          heading: "Wallet connections",
          paragraphs: [
            <>
              If you connect a wallet, your wallet address becomes visible to the site
              running locally in your browser so it can display your slots and
              reservations. Your private keys are never shared with, or accessible to,
              the site. Connection preferences are kept in your browser&apos;s local
              storage on your device; disconnecting your wallet and clearing site data
              removes them.
            </>,
          ],
        },
        {
          heading: "Third-party infrastructure",
          paragraphs: [
            <>
              Using the site necessarily involves third-party infrastructure that we do
              not operate: public RPC endpoints (to read and broadcast transactions),
              the Reown/WalletConnect relay (if you connect via WalletConnect), and
              IPFS gateways such as eth.limo (to serve the site). These services may
              see your IP address, wallet address, and request data, and handle them
              under their own privacy policies. If you prefer, you can use your own RPC
              endpoint, your own IPFS node, or a VPN.
            </>,
          ],
        },
        {
          heading: "Blockchain data is public and permanent",
          paragraphs: [
            <>
              Donations, wallet addresses, reserved names, and all related transactions
              are recorded on public blockchains. That data is permanently public,
              replicated worldwide, and outside anyone&apos;s control — including ours.
              It cannot be edited or deleted, and privacy rights such as erasure cannot
              be applied to it. Do not put information in a name that you may later
              want removed.
            </>,
          ],
        },
        {
          heading: "Children",
          paragraphs: [
            <>
              The site is not directed at children and is intended for users 18 and
              older.
            </>,
          ],
        },
        {
          heading: "Changes and contact",
          paragraphs: [
            <>
              If this policy changes, the revised version will be published at this
              address with an updated date. Questions can be raised on{" "}
              <a
                href="https://github.com/RWA-ID/hoodfi-eth"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-[var(--paper)]"
              >
                GitHub
              </a>{" "}
              or via{" "}
              <a
                href="https://x.com/hoodfieth"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-[var(--paper)]"
              >
                @hoodfieth
              </a>
              .
            </>,
          ],
        },
      ]}
    />
  );
}
