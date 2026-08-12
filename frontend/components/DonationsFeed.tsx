"use client";

import { useEffect, useState } from "react";
import { DONATIONS_URL } from "@/lib/site";
import { formatAddress, formatEth } from "@/lib/format";

type FeedEntry = {
  donor: string;
  years: number;
  ethPaid: bigint;
  credits: number;
  txHash: string;
};

/** Distinguished on purpose: an empty ledger and an unreachable one are different
 *  facts, and only one of them is an invitation to donate. */
type FeedState =
  | { kind: "loading" }
  | { kind: "ready"; entries: FeedEntry[] }
  | { kind: "error" };

/**
 * Onchain transparency: the ledger is rebuilt from mainnet logs, and every row links
 * to its transaction so nothing here has to be taken on trust.
 *
 * The log query runs on the gateway rather than in the browser. A wide `eth_getLogs`
 * needs an archive-capable RPC, and the only way to hand the browser one is to inline
 * the key into the bundle — `NEXT_PUBLIC_*` is public by construction. Reading it
 * through the worker keeps the key private. Before this, the browser fell back to a
 * public endpoint that refuses archive queries, and the failure rendered as
 * "No donations yet" — while the counter beside it correctly read 1.
 */
export function DonationsFeed() {
  const [state, setState] = useState<FeedState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(DONATIONS_URL);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as {
          donations: {
            donor: string;
            numYears: string;
            ethPaid: string;
            txHash: string;
          }[];
        };
        const entries: FeedEntry[] = data.donations
          .map((d) => ({
            donor: d.donor,
            years: Number(d.numYears),
            ethPaid: BigInt(d.ethPaid),
            credits: Number(d.numYears),
            txHash: d.txHash,
          }))
          .reverse()
          .slice(0, 24);
        if (!cancelled) setState({ kind: "ready", entries });
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    }

    void load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="border border-[var(--line-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3.5">
        <span className="label flex items-center gap-2">
          <span className="chip-square" aria-hidden />
          donation ledger
        </span>
        <span className="label">read from Ethereum logs</span>
      </div>
      <div className="max-h-[380px] overflow-y-auto">
        {state.kind === "loading" ? (
          <div className="data px-5 py-8 text-center text-sm text-[var(--faint)]">
            reading chain…
          </div>
        ) : state.kind === "error" ? (
          <div className="px-5 py-10 text-center">
            <div className="data text-sm" style={{ color: "var(--warn)" }}>Couldn&apos;t reach Ethereum.</div>
            <div className="mt-1 text-xs text-[var(--faint)]">
              The ledger is unavailable right now — this doesn&apos;t mean there are no
              donations.
            </div>
          </div>
        ) : state.entries.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="data text-sm text-[var(--dim)]">No donations yet.</div>
            <div className="mt-1 text-xs text-[var(--faint)]">
              The first entry in this ledger could be yours.
            </div>
          </div>
        ) : (
          state.entries.map((e) => (
            <a
              key={e.txHash}
              href={`https://etherscan.io/tx/${e.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-baseline justify-between gap-4 border-b border-[var(--line-soft)] px-5 py-3.5 transition-colors last:border-b-0 hover:bg-[var(--paper-alt)]"
            >
              <div className="min-w-0">
                <span className="data text-sm">{formatAddress(e.donor)}</span>
                <span className="data ml-3 truncate text-xs text-[var(--dim)]">
                  earned {e.credits} short-name credit{e.credits === 1 ? "" : "s"}
                </span>
              </div>
              <div className="data shrink-0 text-right text-sm">
                <span style={{ color: "var(--olive)" }}>+{e.years}y</span>
                <span className="ml-3 text-[var(--faint)]">{formatEth(e.ethPaid, 4)} ETH</span>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
