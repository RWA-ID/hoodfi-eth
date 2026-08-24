"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { isDeadConnector, resetWalletSession } from "@/lib/session";

/**
 * The phantom WalletConnect connection, detected by what actually breaks.
 *
 * Symptom: you look connected, Disconnect does nothing at all, and a write throws
 * `connector.getChainId is not a function`.
 *
 * Cause, captured live on www.hoodfi.name 2026-08-24:
 *
 *   storeStatus:          "reconnecting"          ← never completed
 *   active connector:     ["id","name","type","uid"]   ← the serialised stub
 *   getChainId/disconnect: absent
 *   stub uid:             f7136b8a860
 *   live walletConnect:   6693624bb91             ← never re-linked
 *
 * wagmi persists a connection with the connector flattened to those four fields and is
 * meant to re-link it to the live instance on rehydration. When the reconnect hangs — a
 * WalletConnect relay session that never answers — the store sits at "reconnecting"
 * forever and the stub is what every consumer sees. `useAccount` still reports an
 * address, so the UI renders as connected over an object with no methods on it.
 *
 * Every stored record reads healthy in this state: status connected, both chains in
 * requestedChains, nothing in disconnected_connector_ids. That is why an earlier version
 * of this guard, which sniffed localStorage for a contradiction, never fired — there is
 * no contradiction to find. The fault is in memory.
 *
 * So the test is the methods themselves. A live connector has them; a rehydrated stub
 * does not. No heuristics, no key-matching, no false positives.
 */

export function ConnectionGuard() {
  const { connector, isConnected } = useAccount();
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const check = () => setStuck(Boolean(isConnected && isDeadConnector(connector)));
    check();
    // Re-check on focus: the state usually goes bad while the tab sat in the background
    // waiting on a wallet app.
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, [connector, isConnected]);

  if (!stuck) return null;

  return (
    <div className="border-b border-[var(--ink)] bg-[var(--status-warn)]">
      <div className="shell flex flex-wrap items-center justify-between gap-4 py-3">
        <p className="max-w-[70ch] text-[14px] leading-[1.55] text-[var(--ink)]">
          <strong>Your wallet session needs reconnecting.</strong> It reads as connected,
          but the connection was restored without a working link to your wallet, so
          signing will fail. Resetting clears the stored session only — it cannot touch
          your wallet or your names.
        </p>
        <button
          className="btn btn-ink btn-sm shrink-0"
          onClick={() => void resetWalletSession()}
          type="button"
        >
          Reset connection
        </button>
      </div>
    </div>
  );
}
