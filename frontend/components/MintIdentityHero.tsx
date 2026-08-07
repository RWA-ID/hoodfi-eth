"use client";

import { useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { checkLabel } from "@/lib/labels";
import { track } from "@/lib/analytics";
import { useMintQuery } from "./MintQuery";

/**
 * The /mint hero: the hex string you hand people today, and the name that replaces it,
 * both at headline scale. Keeps its shape whether or not a wallet is connected — the
 * comparison is the pitch, so before connecting the top slot prompts for the wallet
 * rather than dropping back to a plain headline.
 */
export function MintIdentityHero() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const shared = useMintQuery();
  const check = checkLabel(shared?.query ?? "");
  const label = check.ok ? check.label : "";

  return (
    <>
      <h1 className="sr-only">
        Mint your name — lifetime ENS names on Robinhood Chain
      </h1>
      <div className="eyebrow">your current wallet address</div>
      {isConnected && address ? (
        <div className="data mt-3 break-all text-[clamp(17px,3.1vw,40px)] leading-[1.15] text-[var(--dim)]">
          {address}
        </div>
      ) : (
        // The comparison is the pitch, so it holds its shape before connecting too —
        // this slot prompts for the wallet instead of collapsing the hero.
        <button
          type="button"
          onClick={() => {
            track("connect_opened");
            open();
          }}
          className="data mt-3 block break-all text-left text-[clamp(17px,3.1vw,40px)] leading-[1.15] text-[var(--faint)] underline decoration-[var(--line-strong)] underline-offset-8 hover:text-[var(--dim)]"
        >
          connect your wallet
        </button>
      )}

      <div className="mt-7 flex items-center gap-3" aria-hidden>
        <span className="data text-sm text-[var(--faint)]">↓</span>
        <span className="h-px w-24 bg-[var(--line)]" />
      </div>

      <div className="eyebrow mt-6">your new wallet address</div>
      {/* Dim the whole line for the placeholder, never a span inside `.bloom`:
          opacity on a child of gradient-clipped text opens a stacking context, and
          the child renders as transparent glyphs with no background painted into
          them — the word vanishes entirely. */}
      <div
        className={`statement mt-3 break-all text-[clamp(34px,6.4vw,88px)] ${
          label ? "" : "opacity-55"
        }`}
      >
        <span className="bloom">{label || "yourname"}.hoodfi.eth</span>
      </div>
      <p className="mt-5 max-w-[52ch] text-[clamp(16px,1.3vw,19px)] text-[var(--dim)]">
        Type a name below and watch it become yours. One transaction, no renewals, no
        expiry — you own the ERC-721 and every record on it.
      </p>
    </>
  );
}
