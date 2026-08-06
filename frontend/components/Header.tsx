"use client";

import Link from "next/link";
import { ConnectButton } from "./ConnectButton";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--ink)_88%,transparent)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="data text-[15px] font-semibold tracking-tight">
          HoodFi<span className="ok">.eth</span>
        </Link>
        <nav className="flex items-center gap-5 sm:gap-7">
          <Link href="/mint/" className="text-sm text-[var(--dim)] hover:text-[var(--paper)]">
            Mint
          </Link>
          <Link href="/manage/" className="text-sm text-[var(--dim)] hover:text-[var(--paper)]">
            Manage
          </Link>
          <Link href="/#extend" className="hidden text-sm text-[var(--dim)] hover:text-[var(--paper)] sm:block">
            Short names
          </Link>
          <Link href="/faq/" className="text-sm text-[var(--dim)] hover:text-[var(--paper)]">
            FAQ
          </Link>
          <ConnectButton />
        </nav>
      </div>
    </header>
  );
}
