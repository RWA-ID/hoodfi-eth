import Link from "next/link";
import { ArrowNE } from "./ArrowNE";
import { XLogo } from "./ShareOnX";
import { DiscordLogo } from "./DiscordLogo";
import { GitHubLogo } from "./GitHubLogo";
import { BUILDER_URL, DISCORD_URL, REPO_URL, X_URL } from "@/lib/site";

type FooterLink = { href: string; label: string; external?: boolean };

/**
 * The three places to find us, as marks rather than words — the same row the builder's
 * footer carries, so the two surfaces agree.
 *
 * X used to sit under "Legal", which it is not, and GitHub under "Learn" beside the
 * contract links. Both are places to find the project rather than things to read, and
 * as marks they stop competing with the rows around them for the same glance.
 *
 * Each link carries an `aria-label`: the SVGs are `aria-hidden`, and an icon-only link
 * with no accessible name is announced as its URL.
 */
const SOCIALS: { label: string; href: string; icon: React.ReactNode }[] = [
  { label: "HoodFi on X", href: X_URL, icon: <XLogo size={13} /> },
  { label: "HoodFi on Discord", href: DISCORD_URL, icon: <DiscordLogo size={15} /> },
  { label: "HoodFi on GitHub", href: REPO_URL, icon: <GitHubLogo size={14} /> },
];

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/mint/", label: "Mint" },
      { href: "/manage/", label: "Manage records" },
      { href: "/search/", label: "Search a name" },
      // Its own deployment, so external — but a product link, not a "learn" one: it is
      // the second thing you do with a name, after pointing it at a wallet.
      { href: BUILDER_URL, label: "Build a website", external: true },
      { href: "/short-names/", label: "Short names" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/how-it-works/", label: "How it works" },
      { href: "/faq/", label: "FAQ" },
      { href: "/mcp/", label: "MCP for agents" },
      { href: "/partner/", label: "Become a partner" },
      { href: "/#verify", label: "Contracts" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy/", label: "Privacy" },
      { href: "/terms/", label: "Terms" },
      { href: "/disclaimer/", label: "Disclaimer" },
    ],
  },
];

function FooterLinkItem({ href, label, external }: FooterLink) {
  // The arrow marks the link as leaving the site, so it belongs to `external` rather
  // than to the label — a label that carried its own arrow was a label that could
  // disagree with the flag.
  const className =
    "inline-flex w-fit items-center gap-1.5 text-sm text-[rgba(241,241,234,0.8)] transition-colors hover:text-[var(--lime)]";
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {label}
      <ArrowNE />
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
          <div className="mt-5 flex flex-wrap gap-2">
            {SOCIALS.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noreferrer"
                aria-label={social.label}
                className="grid h-9 w-9 place-items-center border border-[rgba(241,241,234,0.28)] transition-colors hover:bg-[rgba(241,241,234,0.08)] hover:text-[var(--lime)]"
              >
                {social.icon}
              </a>
            ))}
          </div>
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
