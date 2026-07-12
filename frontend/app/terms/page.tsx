import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms & Conditions — HoodFi.eth",
  description:
    "Terms and conditions for using the HoodFi.eth interface: donations, name reservations, risks and limitations of liability.",
};

const UPDATED = "July 11, 2026";

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="the fine print"
      title="Terms & Conditions"
      updated={UPDATED}
      intro={
        <>
          These Terms govern your use of the HoodFi.eth website and interface (the
          &ldquo;Interface&rdquo;). By accessing the Interface or interacting with the
          smart contracts it presents, you agree to these Terms in full. If you do not
          agree, do not use the Interface.
        </>
      }
      sections={[
        {
          heading: "What HoodFi.eth is",
          paragraphs: [
            <>
              HoodFi.eth is an independent, open-source, non-custodial web interface to
              smart contracts deployed on Ethereum mainnet and Robinhood Chain (chain id
              4663). The Interface is a static website served over IPFS; it has no
              backend, holds no user funds, and never has access to your private keys.
              All actions you take are transactions you sign yourself, from your own
              wallet, directly with public smart contracts.
            </>,
            <>
              HoodFi.eth is not a bank, exchange, broker, custodian, money transmitter,
              or investment platform, and provides no financial services of any kind.
            </>,
          ],
        },
        {
          heading: "No affiliation",
          paragraphs: [
            <>
              HoodFi.eth is an independent community project. It is not affiliated with,
              endorsed by, sponsored by, or connected to Robinhood Markets, Inc. or any
              of its subsidiaries. &ldquo;Robinhood&rdquo; is a trademark of Robinhood
              Markets, Inc., used here only to refer to the public Robinhood Chain
              network. HoodFi.eth is likewise not affiliated with ENS Labs, the ENS DAO,
              or the Ethereum Foundation.
            </>,
          ],
        },
        {
          heading: "Eligibility",
          paragraphs: [
            <>
              You may use the Interface only if you are at least 18 years old, have the
              legal capacity to enter into these Terms, are not subject to economic or
              trade sanctions, and your use is lawful where you live. You are solely
              responsible for complying with the laws of your jurisdiction, including
              any restrictions on interacting with blockchain networks or digital
              assets.
            </>,
          ],
        },
        {
          heading: "Donations",
          paragraphs: [
            <>
              A &ldquo;donation&rdquo; through the Interface is a voluntary onchain
              payment that renews the ENS name hoodfi.eth via the official ENS
              registrar controller. The donation contract quotes ENS&apos;s live price,
              calls the controller atomically in your transaction, and refunds any
              excess in the same transaction. It has no withdraw function and cannot
              hold funds.
            </>,
            <>
              Donations are not deposits, investments, securities, loans, or purchases
              of equity, and carry no expectation of profit, yield, or return of any
              kind. Each donation&apos;s onchain effect — extending hoodfi.eth&apos;s
              expiry — is delivered immediately and irrevocably when your transaction
              confirms. Beyond the automatic same-transaction excess refund, donations
              are non-refundable under all circumstances.
            </>,
          ],
        },
        {
          heading: "Name slots, reservations and launch",
          paragraphs: [
            <>
              Each donated year credits one reservation slot, a utility credit
              redeemable for reserving one subname of 4+ characters, first come, first
              served. Slots and reservations are recorded onchain and are not
              transferable financial instruments.
            </>,
            <>
              Free claiming of reserved names opens only if and when total donations
              reach the 1,000-year goal and the snapshot is finalized. No date is
              promised and the goal may never be reached. If it is not reached,
              reserved names may never become claimable — donations remain
              non-refundable because their stated effect (extending hoodfi.eth&apos;s
              expiry) has already been delivered. Reserved names remain protected from
              public sale for a limited claim window after launch, as described in the{" "}
              <Link href="/faq/" className="underline hover:text-[var(--paper)]">
                FAQ
              </Link>
              ; unclaimed names may be released for public registration after that
              window.
            </>,
          ],
        },
        {
          heading: "Names and acceptable use",
          paragraphs: [
            <>
              Names are registered first come, first served, with no screening for
              trademarks, personal names, or other third-party rights. You are solely
              responsible for the names you reserve or register and for any claims
              arising from them. Registering a name grants you the onchain token and
              its ENS resolution — it grants no trademark or other intellectual-property
              rights in the underlying word.
            </>,
            <>
              You agree not to use the Interface for any unlawful purpose, including
              sanctions evasion, fraud, phishing, or infringement of others&apos;
              rights.
            </>,
          ],
        },
        {
          heading: "Non-custodial; your wallet, your responsibility",
          paragraphs: [
            <>
              You are solely responsible for your wallet, private keys, and the
              transactions you sign. Blockchain transactions are irreversible: neither
              HoodFi.eth nor anyone else can cancel, reverse, or recover a confirmed
              transaction, a mistyped name, or funds sent to a wrong address. Network
              gas fees are set by the underlying networks and are outside our control.
            </>,
          ],
        },
        {
          heading: "Assumption of risk",
          paragraphs: [
            <>
              Interacting with blockchain systems involves significant risk, which you
              accept in full by using the Interface. Risks include, without limitation:
              bugs or vulnerabilities in smart contracts (the HoodFi.eth contracts are
              open source but have not been formally audited); failures, congestion,
              reorganizations or discontinuation of Ethereum, Robinhood Chain, or their
              bridges; changes to the ENS protocol or the .eth registrar; volatility in
              the price of ETH and other assets; loss of access to your wallet; IPFS or
              gateway unavailability; and regulatory changes affecting digital assets.
            </>,
          ],
        },
        {
          heading: "No advice",
          paragraphs: [
            <>
              Nothing on the Interface is financial, investment, legal, accounting, or
              tax advice. You are solely responsible for evaluating your participation
              and for any taxes arising from your transactions.
            </>,
          ],
        },
        {
          heading: "Disclaimer of warranties",
          paragraphs: [
            <>
              THE INTERFACE AND THE SMART CONTRACTS ARE PROVIDED &ldquo;AS IS&rdquo; AND
              &ldquo;AS AVAILABLE&rdquo;, WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
              IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
              PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE INTERFACE
              WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT THE 1,000-YEAR GOAL
              WILL BE REACHED OR ANY LAUNCH WILL OCCUR.
            </>,
          ],
        },
        {
          heading: "Limitation of liability",
          paragraphs: [
            <>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE OPERATORS AND CONTRIBUTORS OF
              HOODFI.ETH SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
              CONSEQUENTIAL, OR EXEMPLARY DAMAGES, OR FOR ANY LOSS OF PROFITS, DIGITAL
              ASSETS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE INTERFACE OR THE
              SMART CONTRACTS. IN NO EVENT SHALL AGGREGATE LIABILITY EXCEED THE GREATER
              OF USD $100 OR THE AMOUNTS YOU PAID DIRECTLY TO THE OPERATORS (WHICH, FOR
              DONATIONS ROUTED TO THE ENS CONTROLLER, IS ZERO).
            </>,
          ],
        },
        {
          heading: "Indemnification",
          paragraphs: [
            <>
              You agree to indemnify and hold harmless the operators and contributors of
              HoodFi.eth from any claims, damages, or expenses (including reasonable
              legal fees) arising from your use of the Interface, the names you
              register, or your violation of these Terms or applicable law.
            </>,
          ],
        },
        {
          heading: "Changes, severability, governing law",
          paragraphs: [
            <>
              We may update these Terms at any time by publishing a revised version at
              this address; continued use after a change constitutes acceptance. If any
              provision is held unenforceable, the remainder stays in effect. These
              Terms are governed by the laws of the jurisdiction in which the operator
              resides, without regard to conflict-of-law rules, and any dispute shall
              be brought in the courts of that jurisdiction.
            </>,
            <>
              Questions about these Terms can be raised on{" "}
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
