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
 * Deliberately scoped to the wallet's own keys and its own database. A visitor's drafts
 * live in this origin's localStorage too, and losing the site they just wrote to a
 * button labelled "reset connection" would be its own bug.
 *
 * Shared with frontend/lib/session.ts — keep the two in step. Confirmed against a real
 * stuck session 2026-08-24: the sweep removed 13 keys and the reload came back
 * disconnected, while `deleteDatabase` returned **blocked** because a second tab still
 * held the database open. That is the case the timeout below exists for, and it is the
 * common one — the tab somebody is trying to fix is usually not their only tab.
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
 * absent in the captured case, but either alone leaves the session unusable. This started
 * as a getChainId-only check, which would have caught the failed publish but not the dead
 * Disconnect button.
 *
 * Lives here rather than beside the banner so it can be unit-tested without React, and so
 * every caller agrees on what "dead" means.
 */
export function isDeadConnector(connector: unknown): boolean {
  if (!connector || typeof connector !== "object") return false;
  const c = connector as Record<string, unknown>;
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

/**
 * How long a session restore gets before we stop believing in it.
 *
 * Long enough that a healthy reconnect — measured at about half a second on a warm
 * session — is never interrupted, short enough that nobody reads it as a broken page.
 */
export const RECONNECT_GRACE_MS = 4000;

/**
 * Whether to show "restoring your session" rather than the connected or connect UI.
 *
 * A mount-time reconnect is not guaranteed to finish. wagmi's `reconnect` walks the
 * connectors and awaits `connect({isReconnecting:true})` on each one in turn, and an
 * injected provider that answers nothing stalls that loop forever — no rejection, no
 * timeout, so `status` never leaves "reconnecting".
 *
 * Captured on build.hoodfi.name, 2026-08-24, with Rabby and MetaMask both installed:
 * Rabby defines `window.ethereum` as a getter-only property, MetaMask's inpage script
 * fails to install over it ("Cannot set property ethereum of #<Window> which has only a
 * getter"), and the provider it announces over EIP-6963 then never answers even a bare
 * `eth_accounts`. Rabby replied instantly; `io.metamask` was still silent at 4s, and the
 * page still said "Reconnecting" 154 seconds after load.
 *
 * Two things follow, and this predicate is both of them.
 *
 * `address` first: during "reconnecting" wagmi's `getAccount` returns the restored
 * address and `isConnected: !!address`. So a stalled reconnect that has already restored
 * the account renders the header and the status dot as CONNECTED while the panel body
 * still shows "Reconnecting your wallet…" — connected and reconnecting at once, with no
 * name picker underneath. Once there is an address there is nothing left to wait for:
 * reads go through `usePublicClient` and never touch the connector, and a connector that
 * came back without its methods is `isDeadConnector`'s job, not this one's.
 *
 * Then the grace: with no address restored yet, the same stall leaves a first-time
 * visitor staring at "your names will appear in a moment" — a promise the page cannot
 * keep — with no way to connect. After the grace we drop through to the connect UI,
 * which is both true and actionable.
 *
 * "connecting" is deliberately not bounded. It only happens because somebody clicked
 * Connect, it settles when they approve or reject, and expiring it mid-approval would
 * pull the page out from under a wallet prompt that is still open.
 */
export function isRestoringSession(
  status: string,
  address: string | undefined,
  graceExpired: boolean
): boolean {
  if (address) return false;
  if (status === "connecting") return true;
  return status === "reconnecting" && !graceExpired;
}
