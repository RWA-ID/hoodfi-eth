"use client";

import { useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { checkLabel } from "@/lib/labels";
import { track } from "@/lib/analytics";
import { useMintQuery } from "./MintQuery";

/**
 * The /mint hero: the hex string you hand people today, and the name that replaces it,
 * both at headline scale.
 *
 * It keeps its shape whether or not a wallet is connected — the comparison *is* the
 * pitch, so before connecting the top slot prompts for the wallet rather than dropping
 * back to a plain headline and leaving the page arguing for nothing.
 */
export function MintIdentityHero() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const shared = useMintQuery();
  const check = checkLabel(shared?.query ?? "");
  const label = check.ok ? check.label : "";

  return (
    <>
      <h1 className="sr-only">Mint your name — lifetime ENS names on Robinhood Chain</h1>

      <div className="eyebrow">your current wallet address</div>
      {isConnected && address ? (
        <div className="data mt-3 break-all text-[clamp(15px,2.6vw,30px)] leading-[1.2] text-[var(--dim)]">
          {address}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            track("connect_opened");
            open();
          }}
          className="data mt-3 block break-all text-left text-[clamp(15px,2.6vw,30px)] leading-[1.2] text-[var(--faint)] underline decoration-1 underline-offset-8 transition-colors hover:text-[var(--fg)]"
        >
          connect your wallet
        </button>
      )}

      <div className="mt-7 flex items-center gap-3" aria-hidden>
        <span className="data text-sm text-[var(--faint)]">↓</span>
        <span className="h-px w-24 bg-[var(--line-card)]" />
      </div>

      <div className="eyebrow mt-6">your new wallet address</div>
      {/* `<wbr>` and break-words, never break-all: the only sensible place for this
          line to wrap is between the name and the suffix, and break-all happily
          splits it as "yourname.hoodfi." / "eth". */}
      <div
        className={`mt-3 break-words text-[clamp(32px,5.6vw,72px)] font-extrabold leading-[0.92] tracking-[-0.04em] ${
          label ? "" : "text-[var(--faint)]"
        }`}
      >
        {label || "yourname"}
        <wbr />
        <span className={label ? "text-[var(--dim)]" : ""}>.hoodfi.eth</span>
      </div>
      <p className="mt-6 max-w-[46ch] text-[17px] font-medium leading-[1.5] text-pretty">
        Type a name beside this and watch it become yours. One transaction, no renewals,
        no expiry — you own the ERC-721 and every record on it.
      </p>
    </>
  );
}
