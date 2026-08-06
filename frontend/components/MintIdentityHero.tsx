"use client";

import { useAccount } from "wagmi";
import { checkLabel } from "@/lib/labels";
import { useMintQuery } from "./MintQuery";

/**
 * The /mint hero: the hex string you hand people today, and the name that replaces it,
 * both at headline scale. Before a wallet connects there is no "current address" to
 * show, so it falls back to the plain offer.
 */
export function MintIdentityHero() {
  const { address, isConnected } = useAccount();
  const shared = useMintQuery();
  const check = checkLabel(shared?.query ?? "");
  const label = check.ok ? check.label : "";

  if (!isConnected || !address) {
    return (
      <>
        <div className="eyebrow">robinhood chain · chain id 4663</div>
        {/* `.bloom` is display:block so the two lines always land on their own rows —
            natural wrapping lets the minifier eat the separating space. */}
        <h1 className="statement mt-4 max-w-[14ch] text-[clamp(40px,6.4vw,88px)]">
          Mint your name.
          <span className="bloom">Keep it forever.</span>
        </h1>
        <p className="mt-5 max-w-[52ch] text-[clamp(16px,1.3vw,19px)] text-[var(--dim)]">
          A lifetime ENS name on Robinhood Chain. One transaction, no renewals, no
          expiry — you own the ERC-721 and every record on it.
        </p>
      </>
    );
  }

  return (
    <>
      <div className="eyebrow">your current wallet address</div>
      <div className="data mt-3 break-all text-[clamp(17px,3.1vw,40px)] leading-[1.15] text-[var(--dim)]">
        {address}
      </div>

      <div className="mt-7 flex items-center gap-3" aria-hidden>
        <span className="data text-sm text-[var(--faint)]">↓</span>
        <span className="h-px w-24 bg-[var(--line)]" />
      </div>

      <div className="eyebrow mt-6">your new wallet address</div>
      <h1 className="statement mt-3 break-all text-[clamp(34px,6.4vw,88px)]">
        <span className="bloom">
          <span className={label ? "" : "opacity-45"}>{label || "yourname"}</span>
          .hoodfi.eth
        </span>
      </h1>
      <p className="mt-5 max-w-[52ch] text-[clamp(16px,1.3vw,19px)] text-[var(--dim)]">
        Type a name below and watch it become yours. One transaction, no renewals, no
        expiry — you own the ERC-721 and every record on it.
      </p>
    </>
  );
}
