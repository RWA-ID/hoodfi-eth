"use client";

import { useEffect, useRef, useState } from "react";
import { ROBINHOOD_EXPLORER } from "@/lib/chains";
import {
  DONATIONS_ADDRESS,
  L1_RESOLVER_ADDRESS,
  L2_REGISTRY_ADDRESS,
  REGISTRAR_ADDRESS,
} from "@/lib/contracts";
import { ArrowNE } from "./ArrowNE";

type Row = { name: string; address?: string; explorer: "l2" | "l1" };

const ROWS: Row[] = [
  { name: "Registrar", address: REGISTRAR_ADDRESS, explorer: "l2" },
  { name: "L2 Registry", address: L2_REGISTRY_ADDRESS, explorer: "l2" },
  { name: "Donations (L1)", address: DONATIONS_ADDRESS, explorer: "l1" },
  { name: "L1 Resolver", address: L1_RESOLVER_ADDRESS, explorer: "l1" },
];

/**
 * Every address the site depends on, with a copy button and a link to the explorer
 * that actually hosts it — Blockscout for the two Robinhood Chain contracts, Etherscan
 * for the two on mainnet. Sending a mainnet address to an L2 explorer produces a
 * convincing empty page, which is worse than no link.
 *
 * Addresses come from the same env the app transacts against, so this table cannot
 * drift from what the mint button is calling.
 */
export function ContractsTable() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function copy(row: Row) {
    if (!row.address) return;
    try {
      navigator.clipboard.writeText(row.address);
    } catch {
      /* clipboard blocked — the address is on screen and selectable anyway */
    }
    setCopied(row.name);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 1400);
  }

  return (
    <div className="mt-11 border border-[var(--line-card)]">
      {ROWS.map((row) => {
        const href = row.address
          ? row.explorer === "l1"
            ? `https://etherscan.io/address/${row.address}`
            : `${ROBINHOOD_EXPLORER}/address/${row.address}`
          : undefined;
        return (
          <div
            key={row.name}
            className="grid min-h-[58px] grid-cols-[minmax(110px,200px)_minmax(0,1fr)_92px_56px] items-center border-b border-[var(--line-soft)] last:border-b-0"
          >
            <span className="min-w-0 px-[22px] text-sm font-bold">{row.name}</span>
            <span className="data min-w-0 truncate text-[12.5px] text-[var(--dim)]">
              {row.address ?? "not deployed"}
            </span>
            <button
              type="button"
              onClick={() => copy(row)}
              disabled={!row.address}
              aria-label={`Copy the ${row.name} address`}
              className="data h-[58px] border-l border-[var(--line-soft)] text-[11.5px] tracking-[0.08em] transition-colors hover:bg-[var(--paper-alt)] disabled:opacity-40 disabled:hover:bg-transparent"
              style={{ color: copied === row.name ? "var(--olive)" : "var(--dim)" }}
            >
              {copied === row.name ? "Copied" : "Copy"}
            </button>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={`${row.name} on the block explorer`}
                className="grid h-[58px] place-items-center border-l border-[var(--line-soft)] text-sm transition-colors hover:bg-[var(--lime)]"
              >
                <ArrowNE />
              </a>
            ) : (
              <span className="grid h-[58px] place-items-center border-l border-[var(--line-soft)] text-sm text-[var(--faint)]">
                <ArrowNE />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
