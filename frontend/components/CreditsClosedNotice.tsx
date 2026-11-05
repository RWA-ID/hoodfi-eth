"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount } from "wagmi";
import { useCreditsClosed, useUnusedCredits } from "@/lib/credits";
import { CONTACT_EMAIL, X_URL } from "@/lib/site";

const dismissKey = (address: string) => `hoodfi:credits-closed-notice:${address.toLowerCase()}`;

/**
 * A one-time popup for donors holding unused short-name credits after vouchers close.
 *
 * Mounted once in Providers so it reaches a donor on whatever page they land on: the two
 * wallets still holding credits own no hoodfi name, so they may never open the mint card
 * for a short name, which is the only other place credits appear. Renders nothing until
 * the registrar reports `creditSigner == 0` AND the gateway reports unused credits for
 * the connected wallet, so it is inert until the Safe disables vouchers.
 */
export function CreditsClosedNotice() {
  const { address } = useAccount();
  const closed = useCreditsClosed();
  const credits = useUnusedCredits(address, closed === true);
  const [dismissed, setDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!address) return;
    try {
      setDismissed(localStorage.getItem(dismissKey(address)) === "1");
    } catch {
      setDismissed(false);
    }
  }, [address]);

  if (!mounted || !address || closed !== true || !credits || credits < 1 || dismissed) return null;

  const close = () => {
    try {
      localStorage.setItem(dismissKey(address), "1");
    } catch {}
    setDismissed(true);
  };
  const plural = credits === 1 ? "credit" : "credits";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4"
      style={{ background: "rgba(11,14,8,0.6)" }}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-labelledby="credits-closed-title"
    >
      <div
        className="w-full max-w-[460px] border border-[color:var(--line-card)] bg-[color:var(--bg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--line)] px-6 py-4">
          <span
            id="credits-closed-title"
            className="data text-[11px] tracking-[0.12em] uppercase"
            style={{ color: "var(--warn)" }}
          >
            Short-name credits have closed
          </span>
          <button
            onClick={close}
            type="button"
            className="data cursor-pointer text-[12px] text-[color:var(--faint)] hover:text-[color:var(--fg)]"
          >
            Close ✕
          </button>
        </div>
        <div className="px-6 pt-5 pb-6 text-sm leading-relaxed">
          <p>
            This wallet has{" "}
            <strong>
              {credits} unused short-name {plural}
            </strong>{" "}
            from donating to hoodfi.eth. Free short-name mints with credits are no
            longer available.
          </p>
          <p className="mt-3">
            Thank you for supporting HoodFi. Contact us and we&apos;ll pay your {plural}{" "}
            back in ETH or USDG.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <a className="btn btn-ink" href={X_URL} target="_blank" rel="noreferrer noopener">
              Message @hoodfieth on X
            </a>
            <a
              className="btn btn-ghost"
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Short-name credit refund")}`}
            >
              {CONTACT_EMAIL}
            </a>
          </div>
          <p className="data mt-4 text-[11px] leading-relaxed break-all text-[color:var(--faint)]">
            Include this wallet address: {address}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
