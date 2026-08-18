"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { useMyNames, type OwnedName } from "./useMyNames";
import { ArrowNE } from "./ArrowNE";
import { MINT_URL } from "@/lib/site";

type Props = {
  selected: OwnedName | null;
  onSelect: (name: OwnedName | null) => void;
};

/**
 * The one dark object in the lime hero — the same role the site's MintPanel plays, so
 * the two pages read as one product. Everything inside is `.on-ink`, which re-points
 * the role tokens; no child needs a colour of its own.
 *
 * Its height is the hero's height. Anything conditional in here moves the whole band,
 * which is a bug the site paid for once already on the mint card — so the states below
 * are kept close in height rather than free to grow.
 */
export function StartPanel({ selected, onSelect }: Props) {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const { names, loading, error, unconfigured, reload } = useMyNames(address);

  // A name that leaves the list — disconnect, account switch, sold mid-session — must
  // not stay selected. Everything downstream treats this as proof of ownership.
  useEffect(() => {
    if (selected && !names.some((n) => n.node === selected.node)) onSelect(null);
  }, [names, selected, onSelect]);

  return (
    <div className="on-ink panel-ink shadow-hero min-h-[380px] border border-[var(--ink)] p-7">
      <div className="flex items-baseline justify-between gap-4">
        <span className="label">Start a site</span>
        <span className="data flex items-center gap-2 text-[11px] tracking-[0.14em] text-[var(--faint)]">
          <span
            aria-hidden
            className="inline-block h-[7px] w-[7px]"
            style={{ background: isConnected ? "var(--lime)" : "rgba(241,241,234,0.3)" }}
          />
          {isConnected ? "CONNECTED" : "NOT CONNECTED"}
        </span>
      </div>

      {!isConnected ? (
        <div className="mt-7">
          <p className="text-[19px] font-semibold leading-[1.35] tracking-[-0.02em] text-[var(--fg)]">
            Connect the wallet holding your name.
          </p>
          <p className="mt-3 max-w-[38ch] text-[15px] leading-[1.6] text-[var(--dim)]">
            We read your names straight off Robinhood Chain. Designing is free — nothing
            is charged until you publish.
          </p>
          <button className="btn btn-lime mt-7 w-full" onClick={() => open()} type="button">
            Connect Wallet <ArrowNE />
          </button>
          <p className="mt-4 text-[13px] leading-[1.6] text-[var(--faint)]">
            No name yet?{" "}
            <a className="text-[var(--lime)] underline underline-offset-4" href={MINT_URL}>
              Mint one from $3
            </a>
            .
          </p>
        </div>
      ) : (
        <div className="mt-7">
          <p className="label">Choose a name</p>

          {loading && names.length === 0 ? (
            <p className="mt-4 text-[15px] text-[var(--dim)]">Reading Robinhood Chain…</p>
          ) : null}

          {/* Never rendered as "you own nothing" — see the note in useMyNames. */}
          {error ? (
            <div className="mt-4">
              <p className="text-[15px] leading-[1.6] text-[var(--bad)]">{error}</p>
              <button className="btn btn-ghost btn-sm mt-4" onClick={reload} type="button">
                Try again
              </button>
            </div>
          ) : null}

          {unconfigured ? <div className="mt-4">
              <p className="text-[15px] leading-[1.6] text-[var(--bad)]">
                This deployment isn&rsquo;t configured to read names yet, so we can&rsquo;t
                tell what you hold. This is our problem, not your wallet&rsquo;s.
              </p>
            </div> : null}

          {!unconfigured && !loading && !error && names.length === 0 ? (
            <div className="mt-4">
              <p className="text-[15px] leading-[1.6] text-[var(--dim)]">
                This wallet doesn&rsquo;t hold a HoodFi name yet. You can design the whole
                site first — you&rsquo;ll need a name at the point you publish.
              </p>
              <a className="btn btn-lime mt-6 w-full" href={MINT_URL}>
                Get a name <ArrowNE />
              </a>
            </div>
          ) : null}

          {names.length > 0 ? (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                {names.map((name) => {
                  const isSelected = selected?.node === name.node;
                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`data cursor-pointer border px-4 py-2.5 text-[13.5px] transition-colors ${
                        isSelected
                          ? "border-[var(--lime)] bg-[var(--lime)] text-[var(--ink)]"
                          : "border-[var(--line-card)] text-[var(--fg)] hover:bg-[var(--hover-fill)]"
                      }`}
                      key={name.node}
                      onClick={() => onSelect(name)}
                      type="button"
                    >
                      <span className="font-semibold">{name.label}</span>
                      <span className="opacity-50">.hoodfi.eth</span>
                    </button>
                  );
                })}
              </div>

              {selected ? (
                <a
                  className="btn btn-lime mt-7 w-full"
                  href={`/build/?name=${encodeURIComponent(selected.label)}`}
                >
                  Build on {selected.label} <ArrowNE />
                </a>
              ) : (
                <button className="btn btn-lime mt-7 w-full" disabled type="button">
                  Pick a name to continue
                </button>
              )}

              {selected ? (
                <p className="mt-4 text-[13px] leading-[1.6] text-[var(--faint)]">
                  Your site will live at{" "}
                  <span className="data text-[var(--lime)]">
                    {selected.label}.hoodfi.eth.link
                  </span>
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
