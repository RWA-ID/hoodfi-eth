"use client";

import { useEffect, useRef, useState } from "react";
import { ConnectButton } from "./ConnectButton";
import { XLogo } from "./XLogo";
import { ConnectionGuard } from "./ConnectionGuard";
import { MANAGE_URL, MINT_URL } from "@/lib/site";

/**
 * The same strip as the site's header, with one deliberate difference: this app is a
 * single page, so its nav points at anchors rather than routes, and the last cell
 * leaves for hoodfi.name. Keeping the geometry identical matters more than keeping the
 * links identical — a visitor arriving from the site should not feel handed to a
 * different product halfway through buying something.
 *
 * One border-left on the nav plus a border-right per cell, so dividers never double up.
 * Collapses to a drawer below 880px for the same reason the site does: uppercase mono
 * at .16em tracking needs more width than a phone has.
 */
const NAV = [
  { href: "/build/", label: "Build" },
  { href: "/#how", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
  { href: "/partner/", label: "Partners" },
];

const DRAWER_EXTRA = [
  { href: MINT_URL, label: "Get a name", external: true },
  { href: MANAGE_URL, label: "Manage records", external: true },
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
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const mq = window.matchMedia("(min-width: 880px)");
    const onWide = () => {
      if (mq.matches) setOpen(false);
    };

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
      {/* Above the bar, so it cannot be missed and cannot be scrolled past. */}
      <ConnectionGuard />
      <header className="sticky top-0 z-40 border-b border-[var(--line-soft)] bg-[rgba(241,241,234,0.92)] backdrop-blur-[10px]">
        <div className="shell flex min-h-[68px] items-center justify-between gap-6">
          <a href="/" className="flex shrink-0 items-center gap-2.5" aria-label="HoodFi Sites — home">
            {/* eslint-disable-next-line @next/next/no-img-element -- static export, no optimizer */}
            <img src="/hoodfi-h.png" alt="" width={26} height={26} className="block h-[26px] w-[26px]" />
            <span className="data text-[16px] font-semibold tracking-[0.18em]">
              HOODFI<span className="text-[var(--faint)]">/SITES</span>
            </span>
          </a>

          <nav className="hidden items-stretch border-l border-[var(--line)] min-[880px]:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="data border-r border-[var(--line)] px-[18px] py-1.5 text-[11.5px] font-medium uppercase tracking-[0.16em] transition-colors hover:bg-[var(--hover-fill)]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <a
              href="https://x.com/hoodfieth"
              target="_blank"
              rel="noreferrer"
              aria-label="HoodFi on X"
              className="hidden h-9 w-9 place-items-center border border-[color-mix(in_srgb,var(--ink)_35%,transparent)] transition-colors hover:bg-[var(--hover-fill)] sm:grid"
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
        A SIBLING of <header>, not a child. The bar carries backdrop-blur, and a
        backdrop-filter makes an element the containing block for every fixed
        descendant — nested inside, `top-[68px] bottom-0` would resolve against the
        68px bar and collapse the drawer to one visible row.
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
        <div
          id="mobile-nav"
          ref={panel}
          className={`relative max-h-full overflow-y-auto border-b border-[var(--line)] bg-[var(--paper)] px-[clamp(20px,4vw,40px)] pb-8 pt-1 transition-transform duration-200 ease-out ${
            open ? "translate-y-0" : "-translate-y-3"
          }`}
        >
          {[...NAV, ...DRAWER_EXTRA].map((item) => (
            <a
              key={item.href}
              href={item.href}
              {...("external" in item && item.external
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between border-b border-[var(--line-soft)] py-4 text-[17px] font-semibold tracking-[-0.02em]"
            >
              {item.label}
              <span className="data text-[var(--faint)]" aria-hidden>
                →
              </span>
            </a>
          ))}
        </div>
      </div>
    </>
  );
}
