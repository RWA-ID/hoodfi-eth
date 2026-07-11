import Link from "next/link";

export function Footer() {
  return (
    <footer className="hairline-t mt-24">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="data text-sm font-semibold">
              hoodfi<span className="ok">.eth</span>
            </div>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-[var(--faint)]">
              An independent, community-funded name service. Not affiliated with,
              endorsed by, or connected to Robinhood Markets, Inc. Every donation is an
              onchain transaction to the official ENS controller — verify everything
              yourself.
            </p>
          </div>
          <nav className="flex gap-6 text-sm text-[var(--dim)]">
            <Link href="/claim/" className="hover:text-[var(--paper)]">
              Claim
            </Link>
            <Link href="/faq/" className="hover:text-[var(--paper)]">
              FAQ
            </Link>
            <a
              href="https://app.ens.domains/hoodfi.eth"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[var(--paper)]"
            >
              hoodfi.eth on ENS
            </a>
          </nav>
        </div>
        <p className="data mt-8 text-[11px] text-[var(--faint)]">
          © {new Date().getFullYear()} hoodfi.eth — names live on Robinhood Chain,
          donations settle on Ethereum
        </p>
      </div>
    </footer>
  );
}
