"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { useMyNames, type OwnedName } from "./useMyNames";
import { MINT_URL } from "@/lib/site";

type Props = {
  selected: OwnedName | null;
  onSelect: (name: OwnedName | null) => void;
};

/**
 * Step one: which name is this site for.
 *
 * One name per site, chosen explicitly — a site is published by writing a contenthash
 * onto exactly one node, so anything vaguer than a single selection would have to be
 * resolved later anyway, at the point where money has already changed hands.
 */
export function NamePicker({ selected, onSelect }: Props) {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const { names, loading, error, reload } = useMyNames(address);

  // A name that is no longer in the list (disconnected, switched account, sold it
  // mid-session) must not stay selected — every later step reads this as proof of
  // ownership.
  useEffect(() => {
    if (selected && !names.some((n) => n.node === selected.node)) onSelect(null);
  }, [names, selected, onSelect]);

  if (!isConnected) {
    return (
      <div className="panel p-6">
        <p className="label">01 — your name</p>
        <p className="lede mt-3">
          Connect the wallet holding your HoodFi name to start. Nothing is charged until
          you publish.
        </p>
        <button className="btn btn-ink btn-lg mt-5" onClick={() => open()} type="button">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="panel p-6">
      <p className="label">01 — your name</p>

      {loading && names.length === 0 ? (
        <p className="lede mt-3">Reading your names off Robinhood Chain…</p>
      ) : null}

      {error ? (
        <div className="mt-3">
          {/* Never rendered as "you have no names" — see the note in useMyNames. */}
          <p className="warn">{error}</p>
          <button className="btn btn-ghost btn-sm mt-3" onClick={reload} type="button">
            Try again
          </button>
        </div>
      ) : null}

      {!loading && !error && names.length === 0 ? (
        <div className="mt-3">
          <p className="lede">
            This wallet doesn&rsquo;t hold a HoodFi name yet. You can design your whole
            site first — you&rsquo;ll need a name at the point you publish it.
          </p>
          <a className="btn btn-lime btn-lg mt-5" href={MINT_URL}>
            Get a name
          </a>
        </div>
      ) : null}

      {names.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {names.map((name) => {
            const isSelected = selected?.node === name.node;
            return (
              <button
                aria-pressed={isSelected}
                className={`data cursor-pointer border px-4 py-3 text-left text-[14px] transition-colors ${
                  isSelected
                    ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
                    : "border-[color-mix(in_srgb,var(--ink)_35%,transparent)] hover:bg-[var(--hover-fill)]"
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
      ) : null}
    </div>
  );
}
