"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

/**
 * The phantom WalletConnect connection, detected by what actually breaks.
 *
 * Symptom: you look connected, and a write throws
 * `connector.getChainId is not a function`.
 *
 * Cause, from a real capture: wagmi persists a connection with the connector SERIALISED
 * down to four fields —
 *
 *   "connector":{"id":"walletConnect","name":"WalletConnect","type":"walletConnect","uid":"…"}
 *
 * — and on rehydration is meant to re-link that to the live connector instance. When it
 * does not, what remains is a plain object with no methods on it. Every stored record
 * still reads healthy: status connected, a live connection on the right chain, both
 * chains in requestedChains, nothing in the disconnected list. That is why an earlier
 * version of this guard, which sniffed localStorage for a contradiction, never fired —
 * there is no contradiction to find. The fault is in memory.
 *
 * So the test is the method itself. A live connector has getChainId; a rehydrated stub
 * does not. No heuristics, no key-matching, no false positives.
 */
const KEY_PATTERN = /^(@appkit\/|wagmi\.|wc@|walletconnect)/i;

export function ConnectionGuard() {
  const { connector, isConnected } = useAccount();
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const check = () =>
      setStuck(
        Boolean(isConnected && connector && typeof connector.getChainId !== "function")
      );
    check();
    // Re-check on focus: the state usually goes bad while the tab sat in the background
    // waiting on a wallet app.
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, [connector, isConnected]);

  if (!stuck) return null;

  const reset = () => {
    try {
      Object.keys(window.localStorage)
        .filter((k) => KEY_PATTERN.test(k))
        .forEach((k) => window.localStorage.removeItem(k));
    } catch {
      // Private mode. The reload below still helps more often than not.
    }
    window.location.reload();
  };

  return (
    <div className="border-b border-[var(--ink)] bg-[var(--status-warn)]">
      <div className="shell flex flex-wrap items-center justify-between gap-4 py-3">
        <p className="max-w-[70ch] text-[14px] leading-[1.55] text-[var(--ink)]">
          <strong>Your wallet session needs reconnecting.</strong> It reads as connected,
          but the connection was restored without a working link to your wallet, so
          signing will fail. Resetting clears the stored session only — it cannot touch
          your wallet, your names or your drafts.
        </p>
        <button className="btn btn-ink btn-sm shrink-0" onClick={reset} type="button">
          Reset connection
        </button>
      </div>
    </div>
  );
}
