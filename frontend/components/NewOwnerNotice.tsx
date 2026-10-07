"use client";

import type { Address } from "viem";
import { robinhoodChain } from "@/lib/chains";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * Shown on /manage/ when the name's address record does not point at the wallet holding
 * it, and that wallet did not mint it — almost always a secondary purchase.
 *
 * The registry has no transfer hook: buying the NFT moves the token and nothing else, so
 * the name keeps resolving to the seller. Anyone paying the name pays the previous owner
 * until this is fixed, and nothing on any marketplace says so. This is the one place the
 * buyer is guaranteed to look.
 *
 * Presentational only — the reset itself goes through the editor's own save path so it
 * shares its chain switch, receipt handling and refetch.
 */
export function NewOwnerNotice({
  name,
  owner,
  pointsAt,
  from,
  date,
  inherited,
  busy,
  onReset,
  onKeep,
}: {
  name: string;
  owner: Address;
  /** The current EVM record, or "" if empty. */
  pointsAt: string;
  /** The wallet the name came from, when the transfer history could be read. */
  from: Address | null;
  date: string | null;
  /** Labels of the non-address records still holding the previous owner's values. */
  inherited: string[];
  busy: boolean;
  onReset: () => void;
  onKeep: () => void;
}) {
  const explorer = robinhoodChain.blockExplorers.default.url;
  const pointsAtSeller = Boolean(from && pointsAt && pointsAt === from);

  return (
    <section
      role="status"
      className="border border-[var(--line-card)] border-l-4 border-l-[color:var(--warn)] bg-[var(--paper-alt)] px-4 py-4 sm:px-5"
    >
      <div className="label" style={{ color: "var(--warn)" }}>
        New owner — update your records
      </div>
      <p className="mt-2 text-sm leading-relaxed">
        {from ? (
          <>
            {name} came to this wallet from{" "}
            <a
              className="link data"
              href={`${explorer}/address/${from}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              {short(from)}
            </a>
            {date ? ` on ${date}` : ""}.{" "}
          </>
        ) : (
          <>{name} is in this wallet, but its records weren&apos;t set by it. </>
        )}
        {pointsAt ? (
          <>
            It still resolves to{" "}
            <span className="data">{short(pointsAt)}</span>
            {pointsAtSeller ? ", the previous owner" : ""}, not to you
          </>
        ) : (
          <>It doesn&apos;t resolve to any address yet</>
        )}
        . Records don&apos;t move with the NFT, so anything sent to {name} goes to{" "}
        {pointsAt ? "that address" : "nobody"} until you change it.
      </p>
      {inherited.length > 0 && (
        <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
          Also left over from before: {inherited.join(", ")}.
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          className="btn btn-ink"
          onClick={onReset}
          disabled={busy}
        >
          {busy ? "Resetting…" : "Reset records to my wallet"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onKeep}
          disabled={busy}
        >
          Keep as is
        </button>
      </div>
      <p className="data mt-3 text-[11px] leading-relaxed text-[var(--faint)]">
        One transaction: clears every record, then points {name} at{" "}
        {short(owner)} on Ethereum and Robinhood Chain. Add your avatar, bio and other
        records again below afterwards.
      </p>
    </section>
  );
}
