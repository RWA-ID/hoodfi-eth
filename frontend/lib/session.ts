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
   * Email and social logins are exempt.
   *
   * The method test above is a proxy for one specific fault: wagmi rehydrating a
   * WalletConnect connection into a `{id,name,type,uid}` stub because the relay session
   * never answered. AppKit's embedded wallet has no relay session to hang on — it is an
   * iframe on secure.walletconnect.org — so that fault cannot occur for it, and the
   * proxy stops meaning what it was written to mean.
   *
   * Observed live on www.hoodfi.name 2026-09-04: a healthy Google login (connector AUTH,
   * chainId 4663, funds on chain, minting fine) failed this predicate on every reload,
   * so ConnectionGuard told every social user their session was broken and signing would
   * fail. A false alarm on every page load is worse than the dead Disconnect button this
   * was built to catch.
   *
   * The cost is real and accepted: a genuinely broken auth connection now shows no
   * banner. Nothing observed suggests that state exists, and if it turns up it needs its
   * own detector rather than this one — the two failures have nothing in common.
   */
  if (c.id === AUTH_CONNECTOR_ID) return false;

  return typeof c.getChainId !== "function" || typeof c.disconnect !== "function";
}

/** localStorage keys belonging to wagmi, AppKit or WalletConnect. Nothing else. */
const KEY_PATTERN = /^(@appkit\/|wagmi\.|wc@|walletconnect)/i;

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
