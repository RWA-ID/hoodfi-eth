"use client";

import { useEffect, useState } from "react";

/**
 * The phantom WalletConnect connection, and a way out of it.
 *
 * Symptom: you look connected, the chain will not switch, and Disconnect does nothing.
 * Captured state from a real occurrence shows why — AppKit holds the same connector in
 * two contradictory places at once:
 *
 *   "@appkit/connection_status":             "connected"
 *   "@appkit/eip155:connected_connector_id": "walletConnect"
 *   "@appkit/disconnected_connector_ids":    {"eip155":["","walletConnect"]}
 *
 * Disconnect short-circuits because the connector is already in the disconnected set,
 * while wagmi.store still carries a live connection. Nothing in the UI can reconcile
 * that, because the two halves disagree about what the truth is.
 *
 * This detects the contradiction and offers the only fix that works: clear the session
 * keys and reload. Deliberately NOT automatic — silently wiping a connection someone
 * believes is live is its own kind of confusing, and a false positive would log people
 * out mid-flow. It offers, and explains.
 */
const APPKIT_KEY_PATTERN = /^(@appkit\/|wagmi\.|wc@|walletconnect)/i;

function readPhantom(): boolean {
  try {
    const status = window.localStorage.getItem("@appkit/connection_status");
    const active = window.localStorage.getItem("@appkit/eip155:connected_connector_id");
    const disconnectedRaw = window.localStorage.getItem("@appkit/disconnected_connector_ids");
    if (status !== "connected" || !active || !disconnectedRaw) return false;

    const disconnected = JSON.parse(disconnectedRaw) as Record<string, string[]>;
    const list = disconnected?.eip155 ?? [];
    // The contradiction itself: the active connector is also listed as disconnected.
    return Array.isArray(list) && list.includes(active);
  } catch {
    return false;
  }
}

export function ConnectionGuard() {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    setStuck(readPhantom());
    // Re-check when the tab regains focus: the state usually goes bad while the page
    // sat in the background waiting for a wallet app that never came back.
    const onFocus = () => setStuck(readPhantom());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  if (!stuck) return null;

  const reset = () => {
    try {
      Object.keys(window.localStorage)
        .filter((k) => APPKIT_KEY_PATTERN.test(k))
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
          <strong>Your wallet session is stuck.</strong> It reads as connected and
          disconnected at the same time, which is why the network won&rsquo;t switch and
          Disconnect does nothing. Resetting clears the session only — it cannot touch
          your wallet, your names or your drafts.
        </p>
        <button className="btn btn-ink btn-sm shrink-0" onClick={reset} type="button">
          Reset connection
        </button>
      </div>
    </div>
  );
}
