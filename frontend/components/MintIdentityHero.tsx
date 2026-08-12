"use client";

import { useLayoutEffect, useRef, useState } from "react";
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
/** Past this the name can no longer hold 72px in its column, so it stops trying. */
const LONG_NAME = 16;
/** The old fixed ceiling, kept so short names render exactly as they did before. */
const MAX_SIZE = 72;
/**
 * The floor exists so a long name shrinks instead of wrapping, and 12px is where that
 * stops being worth it: 32 of Archivo's widest lowercase ("m", 0.82em apiece) fit a
 * 390px phone at 13.3px, so every valid name clears this on any phone worth naming.
 * Narrower than that and wrapping reads better than the type would.
 */
const MIN_SIZE = 12;

/**
 * Fit the name to the column it sits in.
 *
 * A 32-character label set 1328px at the old fixed 72px in a 612px column, so it
 * overflowed by more than its own width and `break-words` chopped it mid-word
 * ("averyveryverylon" / "gnamefortesting"). No fixed size survives a 32-character
 * label; it has to be sized to what it has to fit in.
 *
 * The width is measured rather than computed from the character count. Estimating it
 * from an average advance looked right and wasn't: calibrated on "a" it fits, and the
 * same 32 characters as "m" still ran 948px into a 612px column, because Archivo's
 * widest lowercase is over half again the width of its narrowest. Only the glyphs the
 * owner actually typed know how wide they are.
 */
function useFittedName(name: string, thin: boolean) {
  const columnRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(MAX_SIZE);

  useLayoutEffect(() => {
    const column = columnRef.current;
    const probe = probeRef.current;
    if (!column || !probe) return;

    const fit = () => {
      const available = column.clientWidth;
      // The probe carries the same family, weight and tracking at PROBE_SIZE, so this
      // ratio is exact for these glyphs rather than an average over the alphabet.
      const atProbeSize = probe.getBoundingClientRect().width;
      if (!available || !atProbeSize) return;
      const ceiling = Math.min(MAX_SIZE, Math.max(32, window.innerWidth * 0.056));
      const fitted = (available / atProbeSize) * PROBE_SIZE;
      setFontSize(Math.max(MIN_SIZE, Math.min(ceiling, fitted)));
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(column);
    // Measuring before Archivo lands sizes the name to the fallback's metrics.
    document.fonts?.ready.then(fit).catch(() => {});
    return () => observer.disconnect();
  }, [name, thin]);

  return { columnRef, probeRef, fontSize };
}

/** Large enough that rounding in the ratio is irrelevant. */
const PROBE_SIZE = 100;

export function MintIdentityHero() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const shared = useMintQuery();
  const check = checkLabel(shared?.query ?? "");
  const label = check.ok ? check.label : "";
  const name = label || "yourname";
  const thin = name.length > LONG_NAME;
  const { columnRef, probeRef, fontSize } = useFittedName(name, thin);

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
      <div ref={columnRef}>
        {/* Off-screen twin of the name at a known size. It is what makes the fit exact:
            same family, same weight, same tracking, never wrapped. */}
        <span
          ref={probeRef}
          aria-hidden
          className={`pointer-events-none absolute -left-[9999px] top-0 whitespace-nowrap tracking-[-0.04em] ${
            thin ? "font-semibold" : "font-extrabold"
          }`}
          style={{ fontSize: PROBE_SIZE }}
        >
          {name}
        </span>
        <div
          className={`mt-3 break-words leading-[0.92] tracking-[-0.04em] ${
            thin ? "font-semibold" : "font-extrabold"
          } ${label ? "" : "text-[var(--faint)]"}`}
          style={{ fontSize }}
        >
          {name}
          <wbr />
          <span className={label ? "text-[var(--dim)]" : ""}>.hoodfi.eth</span>
        </div>
      </div>
      <p className="mt-6 max-w-[46ch] text-[17px] font-medium leading-[1.5] text-pretty">
        Type a name beside this and watch it become yours. One transaction, no renewals,
        no expiry — you own the ERC-721 and every record on it.
      </p>
    </>
  );
}
