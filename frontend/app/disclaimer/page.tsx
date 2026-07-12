import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Disclaimer — HoodFi.eth",
  description:
    "HoodFi.eth is an independent community project — not affiliated with Robinhood Markets, Inc. Names are utility, not investments. Use at your own risk.",
};

const UPDATED = "July 11, 2026";

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
              public Robinhood Chain network (chain id 4663) on which names are issued.
              HoodFi.eth is also not affiliated with ENS Labs, the ENS DAO, or the
              Ethereum Foundation.
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
              The 1,000-year goal may never be reached, and no launch date is promised.
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
