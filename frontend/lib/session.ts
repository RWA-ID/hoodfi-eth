/**
 * Clearing a wallet session, all of it.
 *
 * There were two copies of this, in ConnectionGuard and in PublishPanel, and both swept
 * localStorage only — which is not where WalletConnect v2 keeps a session. Read off a
 * real stuck tab:
 *
 *   localStorage  wc@2:* keys → none
 *   indexedDB     WALLET_CONNECT_V2_INDEXED_DB → wc@2:client:0.3:session,
 *                 wc@2:core:0.3:keychain, wc@2:core:0.3:pairing, wc@2:core:0.3:history…
 *
 * So "Reset connection" removed wagmi's pointer to the session and left the session
 * itself intact, and the reload rebuilt the same broken link from the same data. The
 * button appeared to do nothing, which is worse than not offering it — it is the last
 * thing somebody tries before deciding the site is broken.
 *
 * Deliberately scoped to the wallet's own keys and its own database. Other state lives in
 * this origin's localStorage too, and losing somebody's work to a button labelled "reset
 * connection" would be its own bug.
 *
 * Shared with builder/lib/session.ts — keep the two in step. Confirmed against a real
 * stuck session on www.hoodfi.name, 2026-08-24: the sweep removed 13 keys and the reload
 * came back disconnected, while `deleteDatabase` returned **blocked** because a second
 * tab still held the database open. That is the case the timeout below exists for, and it
 * is the common one — the tab somebody is trying to fix is usually not the only tab.
 */

/**
 * True when `connector` is a rehydrated stub rather than a live connector instance.
 *
 * wagmi persists a connection with the connector flattened to `{id,name,type,uid}` and is
 * meant to re-link it to the live instance on rehydration. When the reconnect hangs — a
 * WalletConnect relay session that never answers — the store sits at "reconnecting" and
 * the stub is what every consumer sees, while `useAccount` still reports an address. The
 * UI renders as connected over an object with no methods on it.
 *
 * Tested against both halves of a capture taken on www.hoodfi.name, 2026-08-24.
 *
 * Checks both methods, because the two failures are separate: a missing `getChainId`
 * breaks writes and chain switching, a missing `disconnect` breaks the way out. Both were
 * absent in the captured case, but either alone leaves the session unusable.
 *
 * Lives here rather than beside the banner so it can be unit-tested without React, and so
 * the button and the guard cannot drift apart on what "dead" means.
 */
export const AUTH_CONNECTOR_ID = "AUTH";

export function isDeadConnector(connector: unknown): boolean {
  if (!connector || typeof connector !== "object") return false;
  const c = connector as Record<string, unknown>;

  /**
   * The auth connector is NOT exempt, though it briefly was — see below.
   *
   * An email or social login rehydrates into the same methodless stub as any other
   * connection, and the whole session behind it is gone with it. Captured on
   * www.hoodfi.name 2026-09-04, in this order:
   *
   *   fresh Google login   no banner, account view renders, methods present
   *   after one reload     banner, account view blank, "Wallet Load Failed" from the
   *                        auth iframe, AppKit's own account button empty
   *
   * So the predicate was right and the exemption added here earlier that day was wrong.
   * It read the banner as a false alarm because the connection looked healthy from the
   * outside — an address, a chain id, funds on chain — without checking whether anything
   * behind it could still sign. Nothing could. Suppressing the warning did not make the
   * session work, it only removed the last way out of it, because the cell in the header
   * had by then stopped disconnecting too.
   */
  return typeof c.getChainId !== "function" || typeof c.disconnect !== "function";
}

/**
 * localStorage keys belonging to wagmi, AppKit or WalletConnect. Nothing else.
 *
 * `@appkit-wallet/` is separate from `@appkit/` and was missing until 2026-09-04, so a
 * reset left the embedded wallet's own state behind — EMAIL, LAST_USED_CHAIN_KEY,
 * SMART_ACCOUNT_ENABLED_NETWORKS — and the reload rebuilt the same broken session from
 * it. That is the same bug this whole module exists to fix, one prefix over: the button
 * appeared to do nothing, for a social login specifically.
 */
const KEY_PATTERN = /^(@appkit\/|@appkit-wallet\/|wagmi\.|wc@|walletconnect)/i;

/** The database WalletConnect v2 keeps its session, keychain and pairings in. */
const WC_DATABASE = "WALLET_CONNECT_V2_INDEXED_DB";

/**
 * Removes the stored wallet session, then reloads.
 *
 * Reloads rather than returning, because there is no way to un-wire a connector that is
 * already live in memory — the whole point is to start the page over without it.
 */
export async function resetWalletSession(): Promise<void> {
  try {
    Object.keys(window.localStorage)
      .filter((k) => KEY_PATTERN.test(k))
      .forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // Private mode. The reload still helps more often than not.
  }

  // Bounded, because `deleteDatabase` does not resolve while any tab still holds the
  // database open — including this one, mid-teardown. Waiting forever on it would hang
  // the button that exists to un-hang everything else, so a blocked delete gives up and
  // reloads anyway: the localStorage sweep alone already breaks the bad link.
  try {
    await new Promise<void>((resolve) => {
      const request = window.indexedDB.deleteDatabase(WC_DATABASE);
      const done = () => resolve();
      request.onsuccess = done;
      request.onerror = done;
      request.onblocked = done;
      setTimeout(done, 1500);
    });
  } catch {
    // No IndexedDB, or a browser refusing it. Same fallback.
  }

  window.location.reload();
}
