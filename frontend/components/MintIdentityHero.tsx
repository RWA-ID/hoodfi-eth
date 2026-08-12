"use client";

import { useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { checkLabel } from "@/lib/labels";
import { track } from "@/lib/analytics";
import { PROBE_SIZE, useFitText } from "@/lib/useFitText";
import { useMintQuery } from "./MintQuery";

const SUFFIX = ".hoodfi.eth";

/**
 * The /mint hero: the hex string you hand people today, and the name that replaces it,
 * both at headline scale.
 *
 * It keeps its shape whether or not a wallet is connected — the comparison *is* the
 * pitch, so before connecting the top slot prompts for the wallet rather than dropping
 * back to a plain headline and leaving the page arguing for nothing.
 */
/** The old fixed ceiling, kept so short names render exactly as they did before. */
const MAX_SIZE = 72;
/** The name is one line at any length, so it may have to get genuinely small. */
const MIN_SIZE = 10;
/** The hero's own line-height, and what the reserved height is built from. */
const LEADING = 0.92;
/** Matches `clamp(32px, 5.6vw, 72px)` — the ceiling the design already used. */
const ceilingFor = (viewport: number) => Math.min(MAX_SIZE, Math.max(32, viewport * 0.056));

export function MintIdentityHero() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const shared = useMintQuery();
  const check = checkLabel(shared?.query ?? "");
  const label = check.ok ? check.label : "";
  const name = label || "yourname";
  // The lockup is measured whole: it is one line, so the suffix is part of what has to
  // fit, not something that can be pushed onto a line of its own.
  const lockup = `${name}${SUFFIX}`;
  const { columnRef, probeRef, fontSize } = useFitText<HTMLDivElement>(
    lockup,
    () => ceilingFor(window.innerWidth),
    MIN_SIZE,
    MAX_SIZE
  );

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
      {/* One line, always. The name and its suffix are a lockup, so this reserves the
          height of the tallest it can be and sits the type on the bottom of that box:
          the size changes as you type, the layout underneath never does. */}
      {/* `overflow-hidden` is the guarantee, not the mechanism. The fit keeps the name
          inside this box at every realistic size; below about 320px the floor stops
          shrinking before a 32-character name of Archivo's widest glyph would fit, and
          without this that residue pushed the whole page 37px wide. A name clipped on a
          320px phone is a far smaller fault than every page scrolling sideways — and
          the field above it shows the name in full either way. */}
      <div
        ref={columnRef}
        className="mt-3 flex items-end overflow-hidden"
        style={{ height: `calc(clamp(32px, 5.6vw, ${MAX_SIZE}px) * ${LEADING})` }}
      >
        {/* Off-screen twin of the lockup at a known size. It is what makes the fit
            exact: same family, same weight, same tracking, never wrapped. */}
        <span
          ref={probeRef}
          aria-hidden
          className="pointer-events-none absolute -left-[9999px] top-0 whitespace-nowrap font-extrabold tracking-[-0.04em]"
          style={{ fontSize: PROBE_SIZE }}
        >
          {lockup}
        </span>
        <div
          className={`whitespace-nowrap font-extrabold leading-[0.92] tracking-[-0.04em] ${
            label ? "" : "text-[var(--faint)]"
          }`}
          style={{ fontSize }}
        >
          {name}
          <span className={label ? "text-[var(--dim)]" : ""}>{SUFFIX}</span>
        </div>
      </div>
      <p className="mt-6 max-w-[46ch] text-[17px] font-medium leading-[1.5] text-pretty">
        Type a name beside this and watch it become yours. One transaction, no renewals,
        no expiry — you own the ERC-721 and every record on it.
      </p>
    </>
  );
}
