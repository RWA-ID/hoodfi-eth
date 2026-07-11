"use client";

import { useEffect, useState } from "react";
import { parseAbiItem, type Log } from "viem";
import { publicClient } from "@/lib/wagmi";
import { DONATIONS_ADDRESS, DONATIONS_DEPLOY_BLOCK } from "@/lib/contracts";
import { formatAddress, formatEth } from "@/lib/format";

const donatedEvent = parseAbiItem(
  "event Donated(address indexed donor, uint256 numYears, uint256 ethPaid, uint256 newExpiry)"
);
const reservedEvent = parseAbiItem(
  "event NameReserved(address indexed donor, bytes32 indexed labelhash, string label)"
);

type FeedEntry = {
  donor: string;
  years: number;
  ethPaid: bigint;
  labels: string[];
  txHash: string;
  blockNumber: bigint;
};

/**
 * Onchain transparency: the feed is rebuilt from mainnet logs in the browser —
 * no indexer, no backend, nothing to trust.
 */
export function DonationsFeed() {
  const [entries, setEntries] = useState<FeedEntry[] | null>(null);

  useEffect(() => {
    if (!DONATIONS_ADDRESS) {
      setEntries([]);
      return;
    }
    let cancelled = false;

    async function load() {
      try {
        const [donations, reservations] = await Promise.all([
          publicClient.getLogs({
            address: DONATIONS_ADDRESS,
            event: donatedEvent,
            fromBlock: DONATIONS_DEPLOY_BLOCK,
            toBlock: "latest",
          }),
          publicClient.getLogs({
            address: DONATIONS_ADDRESS,
            event: reservedEvent,
            fromBlock: DONATIONS_DEPLOY_BLOCK,
            toBlock: "latest",
          }),
        ]);

        const labelsByTx = new Map<string, string[]>();
        for (const log of reservations) {
          const list = labelsByTx.get(log.transactionHash) ?? [];
          list.push(log.args.label as string);
          labelsByTx.set(log.transactionHash, list);
        }

        const feed = donations
          .map((log) => ({
            donor: log.args.donor as string,
            years: Number(log.args.numYears),
            ethPaid: log.args.ethPaid as bigint,
            labels: labelsByTx.get(log.transactionHash) ?? [],
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
          }))
          .reverse()
          .slice(0, 24);

        if (!cancelled) setEntries(feed);
      } catch {
        if (!cancelled) setEntries([]);
      }
    }

    load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
        <span className="eyebrow flex items-center gap-2">
          <span className="live-dot" aria-hidden />
          donation ledger
        </span>
        <span className="data text-xs text-[var(--faint)]">read from Ethereum logs</span>
      </div>
      <div className="max-h-[380px] overflow-y-auto">
        {entries === null ? (
          <div className="data px-5 py-8 text-center text-sm text-[var(--faint)]">
            reading chain…
          </div>
        ) : entries.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="data text-sm text-[var(--dim)]">No donations yet.</div>
            <div className="mt-1 text-xs text-[var(--faint)]">
              The first entry in this ledger could be yours.
            </div>
          </div>
        ) : (
          entries.map((e) => (
            <a
              key={e.txHash}
              href={`https://etherscan.io/tx/${e.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] px-5 py-3 last:border-b-0 hover:bg-[var(--panel-2)]"
            >
              <div className="min-w-0">
                <span className="data text-sm">{formatAddress(e.donor)}</span>
                {e.labels.length > 0 && (
                  <span className="data ml-3 truncate text-xs text-[var(--dim)]">
                    {e.labels.map((l) => `${l}.hoodfi.eth`).join(", ")}
                  </span>
                )}
              </div>
              <div className="data shrink-0 text-right text-sm">
                <span className="ok">+{e.years}y</span>
                <span className="ml-3 text-[var(--faint)]">{formatEth(e.ethPaid, 4)} ETH</span>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
