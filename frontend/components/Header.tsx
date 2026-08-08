"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "./ConnectButton";

// Only Mint earns a slot on a 390px screen: logo + five pills + Connect overflows the
// bar and the items pile on top of each other. The rest appear from `sm` up, and all
// of them are reachable from the footer regardless.
const NAV = [
  { href: "/mint/", label: "Mint", desktopOnly: false },
  { href: "/search/", label: "Look up", desktopOnly: true },
  { href: "/manage/", label: "Manage", desktopOnly: true },
  { href: "/#extend", label: "Short names", desktopOnly: true },
  { href: "/faq/", label: "FAQ", desktopOnly: true },
];

export function Header() {
  // The current route's pill is filled, so it reads as "you are here" rather than as
  // one more thing to click. Compared with trailingSlash in mind — pathname is "/search/".
  const pathname = usePathname();
  const isActive = (href: string) =>
    href.startsWith("/") && href.length > 1 && !href.includes("#")
      ? pathname === href || pathname === href.replace(/\/$/, "")
      : false;

  return (
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
                item.desktopOnly ? "hidden sm:inline-flex" : "inline-flex"
              } ${isActive(item.href) ? "nav-pill-active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
          <ConnectButton />
        </nav>
      </div>
    </header>
  );
}
