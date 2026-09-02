import type { Metadata } from "next";
import { ogMetadata } from "@/lib/metadata";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = ogMetadata({
  title: "Disclaimer",
  description:
    "Unaudited contracts, no affiliation with Robinhood, and no guarantees — what you should know before minting.",
  path: "/disclaimer/",
  image: "/og/legal.png",
});

const UPDATED = "September 2, 2026";

export default function DisclaimerPage() {
  return (
    <LegalPage
      eyebrow="read before you donate"
      title="Disclaimer"
      updated={UPDATED}
      intro={
        <>
          HoodFi.eth is experimental, community-funded, open-source software. Everything
          it does is verifiable onchain — and everything you do with it is at your own
          risk. This page summarizes what this project is not.
        </>
      }
      sections={[
        {
          heading: "Not affiliated with Robinhood",
          paragraphs: [
            <>
              HoodFi.eth is an independent project. It is not affiliated with, endorsed
              by, sponsored by, or connected to Robinhood Markets, Inc. or any of its
              subsidiaries in any way. &ldquo;Robinhood&rdquo; is a trademark of
              Robinhood Markets, Inc.; it appears on this site solely to refer to the
              public Robinhood Chain network (chain id 4663) on which names are issued,
              and to the Robinhood Wallet app, which supports that network. The
              Robinhood Wallet name, app icon, and download links shown on this site
              point to the official Apple App Store and Google Play listings and are
              provided for your convenience only — they are not a partnership,
              sponsorship, or endorsement in either direction. Robinhood Wallet has not
              integrated ENS: a HoodFi name can be used to receive funds there, but the
              app cannot itself send to a name. Apple and the Apple logo are trademarks
              of Apple Inc.; Google Play and the Google Play logo are trademarks of
              Google LLC. HoodFi.eth is also not affiliated with ENS Labs, the ENS DAO,
              or the Ethereum Foundation.
            </>,
          ],
        },
        {
          /* Sits directly after the Robinhood disclaimer: same kind of statement —
             someone else's product named on this site — and the agent-spending
             paragraph is the one a reader most needs before wiring a wallet to a
             model. Wording supplied verbatim; do not paraphrase it. */
          heading: "PayBox",
          paragraphs: [
            <>
              PayBox is a non-custodial wallet and credential product operated by
              MoonPay Inc. It is referenced on this site with MoonPay&apos;s
              permission. HoodFi Names is an independent project, is not affiliated
              with or endorsed by MoonPay, receives no compensation for this
              reference, and has no control over PayBox&apos;s availability, pricing,
              verification requirements, or continued support for any network.
            </>,
            <>
              HoodFi Names never holds, custodies, or transmits user funds, and
              performs no identity verification. Funding a PayBox vault, and any
              purchase of crypto through MoonPay&apos;s ramp, is a transaction
              between you and MoonPay under their terms. Availability varies by
              jurisdiction.
            </>,
            <>
              The HoodFi MCP server holds no keys and broadcasts nothing. It returns
              unsigned transaction data for your agent or wallet to review and sign.
              You are responsible for what you sign. Registrations are final: a
              minted name cannot be refunded, reversed, or revoked by us, and
              transactions submitted to Robinhood Chain cannot be recalled.
            </>,
            <>
              Instructing an AI agent to spend funds carries risk. Set spending
              limits in PayBox, review calldata before approving, and understand that
              HoodFi Names is not responsible for actions taken by third-party agents
              or models.
            </>,
          ],
        },
        {
          heading: "Not an investment",
          paragraphs: [
            <>
              Donations extend the expiry of the ENS name hoodfi.eth — nothing more.
              They are not investments, securities, deposits, or purchases of equity,
              and carry no expectation of profit. Names are utility NFTs for identity
              and resolution; nothing on this site is financial, legal, or tax advice.
              Digital-asset prices are volatile and anything paid in ETH can change in
              fiat value.
            </>,
          ],
        },
        {
          heading: "No guarantees",
          paragraphs: [
            <>
              The 100-year goal may never be reached, and no date for opening short names to public sale is promised.
              If the goal is not reached, reserved names may never become claimable.
              Donations are non-refundable in all cases — each donation&apos;s effect
              (extending hoodfi.eth&apos;s expiry via the official ENS controller) is
              delivered immediately and irrevocably when the transaction confirms.
            </>,
          ],
        },
        {
          heading: "Experimental, unaudited software",
          paragraphs: [
            <>
              The smart contracts and this interface are open source and publicly
              verifiable, but they have not been formally audited. Smart contracts can
              contain bugs, and blockchain networks can fail, congest, reorganize, or
              change in ways nobody controls. Never commit funds you cannot afford to
              lose.
            </>,
          ],
        },
        {
          heading: "Third-party networks and services",
          paragraphs: [
            <>
              Ethereum, Robinhood Chain, the ENS protocol, IPFS, RPC providers, and
              wallet software are independent systems outside this project&apos;s
              control. Their availability, fees, rules, and continued existence are not
              guaranteed by HoodFi.eth.
            </>,
          ],
        },
        {
          heading: "Names and third-party rights",
          paragraphs: [
            <>
              Names are issued first come, first served, without screening. Registering
              a name grants no trademark or other rights in the underlying word, and
              you are solely responsible for claims arising from names you register.
            </>,
          ],
        },
        {
          heading: "The full terms",
          paragraphs: [
            <>
              This page is a summary. Your use of the site is governed by the{" "}
              <Link href="/terms/" className="underline hover:text-[var(--paper)]">
                Terms &amp; Conditions
              </Link>
              , including their disclaimers of warranties and limitations of liability,
              and by the{" "}
              <Link href="/privacy/" className="underline hover:text-[var(--paper)]">
                Privacy Policy
              </Link>
              .
            </>,
          ],
        },
      ]}
    />
  );
}
