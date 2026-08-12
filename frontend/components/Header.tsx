"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ConnectButton } from "./ConnectButton";
import { XLogo } from "./ShareOnX";

/**
 * Every destination, in one list.
 *
 * The bar is a single hairline-divided strip of cells — one border-left on the nav
 * plus a border-right on each cell, so the dividers never double up. Below 880px the
 * whole strip would wrap to a second row, which is why it collapses into a drawer
 * instead: five uppercase mono labels at .16em tracking need ~560px of their own.
 */
const NAV = [
  { href: "/mint/", label: "Mint" },
  { href: "/search/", label: "Look up" },
  { href: "/manage/", label: "Manage" },
  { href: "/short-names/", label: "Short names" },
  { href: "/faq/", label: "FAQ" },
];

/** Reachable from the drawer only — the bar has no room and these are secondary. */
const DRAWER_EXTRA = [
  { href: "/how-it-works/", label: "How it works" },
  { href: "/claim/", label: "Claim a credit" },
  { href: "/mcp/", label: "MCP for agents" },
];

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      {open ? (
        <>
          <path d="M4 4l10 10" />
          <path d="M14 4L4 14" />
        </>
      ) : (
        <>
          <path d="M2.5 5h13" />
          <path d="M2.5 9h13" />
          <path d="M2.5 13h13" />
        </>
      )}
    </svg>
  );
}

export function Header() {
  // The current route's cell is filled lime, so it reads as "you are here" rather
  // than as one more thing to click. Compared with trailingSlash in mind — pathname
  // is "/search/".
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  const isActive = (href: string) =>
    pathname === href || pathname === href.replace(/\/$/, "");

  // Navigating closes the drawer. Covers the case a plain onClick misses: tapping a
  // link that leads to the route you are already on changes nothing at all, so the
  // click handler alone can leave it open.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // The drawer only exists below 880px. Resizing past that while it is open would
  // leave the scroll lock on with nothing visible holding it.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const mq = window.matchMedia("(min-width: 880px)");
    const onWide = () => {
      if (mq.matches) setOpen(false);
    };

    // Lock the page behind the drawer. Restores whatever was there rather than
    // hardcoding "", so this can't clobber an overflow set by something else.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onWide);
    panel.current?.querySelector<HTMLElement>("a")?.focus();

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onWide);
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--line-soft)] bg-[rgba(241,241,234,0.92)] backdrop-blur-[10px]">
        <div className="shell flex min-h-[68px] items-center justify-between gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="HoodFi Names — home">
            {/* eslint-disable-next-line @next/next/no-img-element -- static export, no optimizer */}
            <img src="/hoodfi-h.png" alt="" width={26} height={26} className="block h-[26px] w-[26px]" />
            <span className="data text-[16px] font-semibold tracking-[0.18em]">HOODFI.NAME</span>
          </Link>

          <nav className="hidden items-stretch border-l border-[var(--line)] min-[880px]:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`data border-r border-[var(--line)] px-[18px] py-1.5 text-[11.5px] font-medium uppercase tracking-[0.16em] transition-colors ${
                  isActive(item.href)
                    ? "bg-[var(--lime)]"
                    : "hover:bg-[var(--hover-fill)]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <a
              href="https://x.com/hoodfieth"
              target="_blank"
              rel="noreferrer"
              aria-label="HoodFi on X"
              className="grid h-9 w-9 place-items-center border border-[color-mix(in_srgb,var(--ink)_35%,transparent)] transition-colors hover:bg-[var(--hover-fill)]"
            >
              <XLogo size={13} />
            </a>
            <ConnectButton />
            <button
              type="button"
              className="grid h-9 w-9 place-items-center border border-[color-mix(in_srgb,var(--ink)_35%,transparent)] min-[880px]:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
            >
              <MenuIcon open={open} />
            </button>
          </div>
        </div>
      </header>

      {/*
        The drawer sits below the bar rather than over it, so the close control never
        moves and never gets covered. `top-[68px]` matches the bar's min-height.

        It is a SIBLING of <header>, not a child, and that is load-bearing rather than
        stylistic. The bar carries `backdrop-blur`, and a backdrop-filter makes an
        element the containing block for every position:fixed descendant — so nested
        inside, `top-[68px] bottom-0` would resolve against the 68px bar instead of the
        viewport and collapse the drawer to a single visible row.

        Hidden with `invisible` instead of unmounting: visibility:hidden takes the links
        out of the tab order and the accessibility tree, which `opacity-0` alone does
        not, while still leaving something in the DOM to transition.
      */}
      <div
        className={`fixed inset-x-0 bottom-0 top-[68px] z-50 min-[880px]:hidden ${
          open ? "visible" : "invisible"
        }`}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-hidden={!open}
          className={`absolute inset-0 bg-[rgba(11,14,8,0.55)] transition-opacity duration-200 ${
            open ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setOpen(false)}
        />
        {/* Opaque paper, not a tint. The hero behind it is a lime field carrying
            display type, and even a few percent of it showing through the menu reads
            as a rendering fault rather than as depth. */}
        <div
          id="mobile-nav"
          ref={panel}
          className={`relative max-h-full overflow-y-auto border-b border-[var(--line)] bg-[var(--paper)] px-[clamp(20px,4vw,40px)] pb-8 pt-1 transition-transform duration-200 ease-out ${
            open ? "translate-y-0" : "-translate-y-3"
          }`}
        >
          {[...NAV, ...DRAWER_EXTRA].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              onClick={() => setOpen(false)}
              className={`flex items-center justify-between border-b border-[var(--line-soft)] py-4 text-[17px] font-semibold tracking-[-0.02em] ${
                isActive(item.href) ? "text-[var(--olive)]" : ""
              }`}
            >
              {item.label}
              <span className="data text-[var(--faint)]" aria-hidden>
                →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
