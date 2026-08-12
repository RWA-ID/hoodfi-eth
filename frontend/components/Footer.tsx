import Link from "next/link";

type FooterLink = { href: string; label: string; external?: boolean };

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/mint/", label: "Mint" },
      { href: "/manage/", label: "Manage records" },
      { href: "/search/", label: "Search a name" },
      { href: "/short-names/", label: "Short names" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/how-it-works/", label: "How it works" },
      { href: "/faq/", label: "FAQ" },
      { href: "/#verify", label: "Contracts" },
      {
        href: "https://github.com/RWA-ID/hoodfi-eth",
        label: "GitHub ↗",
        external: true,
      },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy/", label: "Privacy" },
      { href: "/terms/", label: "Terms" },
      { href: "/disclaimer/", label: "Disclaimer" },
      { href: "https://x.com/hoodfieth", label: "X ↗", external: true },
    ],
  },
];

function FooterLinkItem({ href, label, external }: FooterLink) {
  const className = "text-sm text-[rgba(241,241,234,0.8)] transition-colors hover:text-[var(--lime)]";
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {label}
    </a>
  ) : (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

export function Footer() {
  return (
    // No top margin of its own: the homepage hands over from a full-bleed lime band
    // with no gap, and every other route ends on its own bottom padding.
    <footer className="on-ink">
      <div className="shell flex flex-wrap gap-10 pb-10 pt-16">
        {/* Brand column takes twice the growth of a link column, so the three
            columns stay a readable width once they wrap onto their own row. */}
        <div className="min-w-0 flex-[2_1_280px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export, no optimizer */}
          <img src="/hoodfi-logo.png" alt="HoodFi Names" className="block h-10 w-auto" />
          <p className="mt-4 max-w-[32ch] text-sm leading-relaxed text-[rgba(241,241,234,0.6)]">
            Lifetime ENS names on Robinhood Chain. Minted once, owned forever.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title} className="min-w-0 flex-[1_1_160px]">
            <div className="label">{col.title}</div>
            <div className="mt-4 flex flex-col gap-2.5">
              {col.links.map((link) => (
                <FooterLinkItem key={link.label} {...link} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="shell data flex flex-wrap justify-between gap-6 border-t border-[var(--line-soft)] pb-14 pt-6 text-[11px] tracking-[0.06em] text-[var(--faint)]">
        <span>
          Independent project. Not affiliated with, endorsed by, or connected to
          Robinhood Markets, Inc.
        </span>
        <span>© {new Date().getFullYear()} hoodfi.eth</span>
      </div>
    </footer>
  );
}
