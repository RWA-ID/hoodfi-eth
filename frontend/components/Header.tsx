"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ConnectButton } from "./ConnectButton";

/**
 * Every destination, in one list.
 *
 * `Mint` keeps its own slot in the bar at every width because it is the conversion
 * action; the rest are desktop pills that collapse into the drawer on mobile. There is
 * no longer a mobile-only subset — the drawer carries the whole list, so nothing is
 * reachable on a laptop and invisible on a phone.
 */
const NAV = [
  { href: "/mint/", label: "Mint", always: true },
  { href: "/search/", label: "Look up", always: false },
  { href: "/manage/", label: "Manage", always: false },
  // On a desktop this scrolls to the section that carries the offer. That section is
  // hidden below `sm` — a phone lands on a mint screen — so the drawer has to send
  // mobile to the route that carries the same thing, or the link scrolls to nothing.
  { href: "/#extend", mobileHref: "/short-names/", label: "Short names", always: false },
  { href: "/faq/", label: "FAQ", always: false },
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
  // The current route's pill is filled, so it reads as "you are here" rather than as
  // one more thing to click. Compared with trailingSlash in mind — pathname is "/search/".
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  const isActive = (href: string) =>
    href.startsWith("/") && href.length > 1 && !href.includes("#")
      ? pathname === href || pathname === href.replace(/\/$/, "")
      : false;

  // Navigating closes the drawer. Covers the case a plain onClick misses: tapping
  // "Short names" from /faq/ changes the route to "/" with a hash, and tapping it again
  // from "/" changes nothing at all, so the click handler alone can leave it open.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // A drawer is only shown under `sm`. Resizing past that while it is open would leave
  // the scroll lock on with nothing visible holding it.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const mq = window.matchMedia("(min-width: 640px)");
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
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--ink)_88%,transparent)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 2xl:px-12">
        <Link href="/" className="shrink-0" aria-label="HoodFi Names — home">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export, no optimizer */}
          <img
            src="/hoodfi-logo.png"
            alt="HoodFi Names"
            width={480}
            height={195}
            className="block h-7 w-auto sm:h-8"
          />
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`nav-pill items-center ${
                item.always ? "inline-flex" : "hidden sm:inline-flex"
              } ${isActive(item.href) ? "nav-pill-active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
          <ConnectButton />
          <button
            type="button"
            className="nav-pill inline-flex items-center justify-center px-2.5 text-[var(--paper)] sm:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <MenuIcon open={open} />
          </button>
        </nav>
      </div>

    </header>

      {/*
        The drawer sits below the bar rather than over it, so the close control never
        moves and never gets covered. `top-16` matches the bar's h-16.

        It is a SIBLING of <header>, not a child, and that is load-bearing rather than
        stylistic. The bar carries `backdrop-blur`, and a backdrop-filter makes an
        element the containing block for every position:fixed descendant — so nested
        inside, `top-16 bottom-0` resolved against the 64px bar instead of the viewport
        and collapsed the drawer to a single visible row.

        Hidden with `invisible` instead of unmounting: visibility:hidden takes the links
        out of the tab order and the accessibility tree, which `opacity-0` alone does
        not, while still leaving something in the DOM to transition.
      */}
      <div
        className={`fixed inset-x-0 bottom-0 top-16 z-50 sm:hidden ${
          open ? "visible" : "invisible"
        }`}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-hidden={!open}
          className={`absolute inset-0 bg-[rgba(4,8,5,0.66)] transition-opacity duration-200 ${
            open ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setOpen(false)}
        />
        {/* Opaque, not a tint. The hero behind it is high-contrast display type, and
            even a few percent of it showing through the menu reads as a rendering
            fault rather than as depth. */}
        <div
          id="mobile-nav"
          ref={panel}
          className={`relative max-h-full overflow-y-auto border-b border-[var(--line)] bg-[var(--ink)] px-4 pb-6 pt-2 transition-transform duration-200 ease-out ${
            open ? "translate-y-0" : "-translate-y-3"
          }`}
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.mobileHref ?? item.href}
              aria-current={isActive(item.mobileHref ?? item.href) ? "page" : undefined}
              onClick={() => setOpen(false)}
              className={`flex items-center justify-between border-b border-[color-mix(in_srgb,var(--line)_70%,transparent)] py-4 text-[15px] ${
                isActive(item.mobileHref ?? item.href)
                  ? "text-[var(--green)]"
                  : "text-[var(--paper)]"
              }`}
            >
              {item.label}
              <span className="data text-[var(--faint)]" aria-hidden>
                →
              </span>
            </Link>
          ))}
          <Link
            href="/claim/"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between py-4 text-[15px] text-[var(--paper)]"
          >
            Claim a credit
            <span className="data text-[var(--faint)]" aria-hidden>
              →
            </span>
          </Link>
        </div>
      </div>
    </>
  );
}
