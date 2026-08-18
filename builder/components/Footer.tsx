import { XLogo } from "./XLogo";
import { MANAGE_URL, MINT_URL } from "@/lib/site";

type Link = { label: string; href: string; external?: boolean };

const COLUMNS: { title: string; links: Link[] }[] = [
  {
    title: "Build",
    links: [
      { label: "Templates", href: "/#templates" },
      { label: "How it works", href: "/#how" },
      { label: "Pricing", href: "/#pricing" },
      { label: "FAQ", href: "/#faq" },
      { label: "Partner with us", href: "/partner/" },
    ],
  },
  {
    title: "Names",
    links: [
      { label: "Get a name", href: MINT_URL, external: true },
      { label: "Manage records", href: MANAGE_URL, external: true },
      { label: "hoodfi.name", href: "https://www.hoodfi.name/", external: true },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", href: "https://www.hoodfi.name/terms/", external: true },
      { label: "Privacy", href: "https://www.hoodfi.name/privacy/", external: true },
      { label: "Disclaimer", href: "https://www.hoodfi.name/disclaimer/", external: true },
    ],
  },
];

/**
 * `on-ink` re-points the role tokens rather than restyling anything: --fg, --dim and
 * --accent all take their dark-ground values, so the same markup that reads as ink on
 * paper above reads as paper on ink here. Nothing inside needs a colour of its own.
 *
 * Legal links point at the site's pages rather than duplicating them — one set of terms
 * covering both surfaces is the honest arrangement, and a second copy would drift.
 */
export function Footer() {
  return (
    <footer className="on-ink mt-[clamp(72px,9vw,112px)]">
      <div className="shell flex flex-wrap gap-10 pb-10 pt-16">
        <div className="min-w-0 flex-[2_1_280px]">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- static export, no optimizer */}
            <img src="/hoodfi-h.png" alt="" width={28} height={28} className="block h-7 w-7" />
            <span className="data text-[16px] font-semibold tracking-[0.18em]">
              HOODFI<span className="text-[var(--faint)]">/SITES</span>
            </span>
          </div>
          <p className="mt-4 max-w-[34ch] text-sm leading-relaxed text-[rgba(241,241,234,0.6)]">
            Turn a HoodFi name into a website. Published to IPFS, served by the name
            itself — no hosting bill and nothing to renew.
          </p>
          <a
            href="https://x.com/hoodfieth"
            target="_blank"
            rel="noreferrer"
            aria-label="HoodFi on X"
            className="mt-5 grid h-9 w-9 place-items-center border border-[rgba(241,241,234,0.28)] transition-colors hover:bg-[rgba(241,241,234,0.08)]"
          >
            <XLogo size={13} />
          </a>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title} className="min-w-0 flex-[1_1_160px]">
            <div className="label">{col.title}</div>
            <div className="mt-4 flex flex-col gap-2.5">
              {col.links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
                  className="w-fit text-sm text-[rgba(241,241,234,0.72)] transition-colors hover:text-[var(--lime)]"
                >
                  {link.label}
                </a>
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
