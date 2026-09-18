import type { Metadata } from "next";
import { ogMetadata } from "@/lib/metadata";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = ogMetadata({
  title: "Privacy Policy",
  description:
    "How the HoodFi.eth interface handles data: no accounts, no personal data, and exactly which analytics run on the site.",
  path: "/privacy/",
  image: "/og/legal.png",
});

const UPDATED = "September 18, 2026";

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="what we know about you: almost nothing"
      title="Privacy Policy"
      updated={UPDATED}
      intro={
        <>
          HoodFi.eth is a static website served over IPFS. It has no server, no
          database, and no user accounts. We do not collect, store, sell, or share
          personal data, and we never ask you for a name, an email address, or a
          password. The site does measure its own traffic, in the two ways described
          under &ldquo;Analytics&rdquo; below. This policy explains everything that
          happens with data when you use the site.
        </>
      }
      sections={[
        {
          heading: "What we don't collect",
          paragraphs: [
            <>
              We do not collect names, email addresses, passwords, or device
              fingerprints, and we never link what we do measure to a wallet address.
              The site is published as static files with no backend of our own, so
              there is nowhere for a user profile to accumulate even if we wanted one.
            </>,
          ],
        },
        {
          heading: "Analytics",
          paragraphs: [
            <>
              Two things measure traffic here, and it is worth being exact about which
              does what. The first is our own counter: it records an event name, the
              page path, the host that referred you, and a random session id that lives
              in your tab&apos;s session storage and is destroyed when you close it. It
              sets no cookie, reads no wallet address, and cannot follow you between
              visits or across sites.
            </>,
            <>
              The second is Google Analytics 4, which we use to understand where
              visitors arrive from and which pages hold their attention. It is a
              third-party script from Google and it does set cookies on your device,
              which distinguish repeat visits from new ones. It receives your IP
              address, the pages you view, and general details about your browser and
              region, and Google handles that data under its own privacy policy rather
              than this one. It is never given your wallet address, and it plays no part
              in minting, resolving, or owning a name.
            </>,
            <>
              Both are about the site, not about you. If you would rather not be counted
              at all, any content blocker or the browser&apos;s &ldquo;do not
              track&rdquo; tooling will stop both, and nothing on the site behaves
              differently when they are blocked.
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
              the Reown/WalletConnect relay (if you connect via WalletConnect), IPFS
              gateways such as eth.limo (to serve the site), and Google Analytics (to
              count visits, as described above). These services may
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
