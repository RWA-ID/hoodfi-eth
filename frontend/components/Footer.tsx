import Link from "next/link";

function GitHubIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="hairline-t mt-24">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element -- static export, no optimizer */}
            <img
              src="/hoodfi-logo.png"
              alt="HoodFi Names"
              className="block h-12 w-auto"
            />
            <p className="mt-4 max-w-md text-xs leading-relaxed text-[var(--faint)]">
              An independent, community-funded name service. Not affiliated with,
              endorsed by, or connected to Robinhood Markets, Inc. Every donation is an
              onchain transaction to the official ENS controller — verify everything
              yourself.{" "}
              <Link href="/disclaimer/" className="underline hover:text-[var(--dim)]">
                Full disclaimer
              </Link>
              .
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:items-end">
            <nav className="flex flex-wrap gap-6 text-sm text-[var(--dim)]">
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
                HoodFi.eth on ENS
              </a>
            </nav>
            <div className="flex items-center gap-5">
              <a
                href="https://github.com/RWA-ID/hoodfi-eth"
                target="_blank"
                rel="noreferrer"
                className="data flex items-center gap-2 text-xs text-[var(--dim)] hover:text-[var(--paper)]"
              >
                <GitHubIcon />
                RWA-ID/hoodfi-eth
              </a>
              <a
                href="https://x.com/hoodfieth"
                target="_blank"
                rel="noreferrer"
                className="data flex items-center gap-2 text-xs text-[var(--dim)] hover:text-[var(--paper)]"
              >
                <XIcon />
                @hoodfieth
              </a>
            </div>
            <nav className="flex flex-wrap gap-6 text-xs text-[var(--faint)]">
              <Link href="/terms/" className="hover:text-[var(--dim)]">
                Terms &amp; Conditions
              </Link>
              <Link href="/privacy/" className="hover:text-[var(--dim)]">
                Privacy Policy
              </Link>
              <Link href="/disclaimer/" className="hover:text-[var(--dim)]">
                Disclaimer
              </Link>
            </nav>
          </div>
        </div>
        <p className="data mt-8 text-[11px] text-[var(--faint)]">
          © {new Date().getFullYear()} HoodFi.eth — names live on Robinhood Chain,
          donations settle on Ethereum
        </p>
      </div>
    </footer>
  );
}
