/**
 * Regression test for the phantom-connector detector.
 *
 * Run it from `builder/`: `node --experimental-strip-types lib/session.test.mjs`, or
 * `npm test`. `session.ts` touches `window` only inside `resetWalletSession`, never at
 * module scope, so importing it under node needs no DOM and no install.
 *
 * Worth having because this predicate is the only thing standing between somebody and a
 * dead Disconnect button, and it is not reachable from a normal test run in the browser:
 * the state it detects needs a WalletConnect reconnect that hangs rather than fails, and
 * a hang cannot be staged on demand. Injecting a fabricated `wagmi.store` does not
 * reproduce it — wagmi finds no relay session, the reconnect fails *cleanly*, and the
 * connection is dropped (verified 2026-08-24: `current: null`, 0 connections). So the
 * fixtures below are transcribed from a real capture taken off the live site instead.
 */
import assert from "node:assert";
import { isDeadConnector, isRestoringSession } from "./session.ts";

/* The stub, exactly as read out of the stuck store on www.hoodfi.name 2026-08-24.
   Four fields, no prototype, no methods. */
const CAPTURED_STUB = {
  id: "walletConnect",
  name: "WalletConnect",
  type: "walletConnect",
  uid: "f7136b8a860",
};

/* A live connector, shaped like the ones sitting in config.connectors during that same
   capture — the walletConnect entry there had uid 6693624bb91 and real methods. */
const liveConnector = () => ({
  id: "walletConnect",
  name: "WalletConnect",
  type: "walletConnect",
  uid: "6693624bb91",
  getChainId: async () => 4663,
  disconnect: async () => {},
  getAccounts: async () => [],
});

// The case that shipped this fix.
assert.equal(isDeadConnector(CAPTURED_STUB), true, "captured stub must read as dead");

// The case that must never show a banner.
assert.equal(isDeadConnector(liveConnector()), false, "live connector must read as alive");

// Either method missing on its own is still unusable: no getChainId means writes and
// chain switches throw, no disconnect means the button is a no-op.
const noChainId = liveConnector();
delete noChainId.getChainId;
assert.equal(isDeadConnector(noChainId), true, "missing getChainId must read as dead");

const noDisconnect = liveConnector();
delete noDisconnect.disconnect;
assert.equal(isDeadConnector(noDisconnect), true, "missing disconnect must read as dead");

// Not connected at all. `useAccount` gives undefined here on every normal page load, and
// treating that as dead would show the banner to every disconnected visitor.
assert.equal(isDeadConnector(undefined), false, "undefined must not read as dead");
assert.equal(isDeadConnector(null), false, "null must not read as dead");

// A non-object can't be a connector; it must not throw on the property reads either.
assert.equal(isDeadConnector("walletConnect"), false, "a string must not read as dead");

/* ------------------------------------------------------------------------------------
 * isRestoringSession — the reconnect that never lands.
 *
 * Transcribed from build.hoodfi.name 2026-08-24, Rabby + MetaMask both installed. Rabby
 * owns `window.ethereum` as a getter-only property, MetaMask cannot install over it, and
 * the provider it still announces over EIP-6963 never answers `eth_accounts` — so wagmi's
 * reconnect loop never finishes and `status` never leaves "reconnecting". Measured: Rabby
 * replied instantly, `io.metamask` was silent past 4s, the page said "Reconnecting" 154
 * seconds after load.
 * ---------------------------------------------------------------------------------- */

const ADDR = "0xc32A9e2f1092F1D57D3267C2E70b80DA9De06D59";

// The reported bug. wagmi's `getAccount` hands back the restored address during
// "reconnecting" and reports isConnected from it, so the header and the status dot said
// CONNECTED while the body sat on "Reconnecting your wallet…" and never offered the name
// picker. With an address there is nothing left to wait for.
assert.equal(
  isRestoringSession("reconnecting", ADDR, false),
  false,
  "an address restored mid-reconnect must not hold the connected UI shut"
);

// The other half of the same stall: nothing restored yet, so the panel promised names
// that were never going to arrive, with no way to connect. The grace ends that.
assert.equal(
  isRestoringSession("reconnecting", undefined, false),
  true,
  "a fresh reconnect must show the restoring state"
);
assert.equal(
  isRestoringSession("reconnecting", undefined, true),
  false,
  "an expired reconnect must fall through to the connect UI"
);

// "connecting" is user-initiated and settles on approve or reject. Expiring it would pull
// the page out from under a wallet prompt that is still open, so the grace never applies.
assert.equal(
  isRestoringSession("connecting", undefined, true),
  true,
  "connecting must not be bounded by the grace"
);

// The two settled states are never the restoring state, expired or not.
assert.equal(isRestoringSession("connected", ADDR, false), false, "connected is not restoring");
assert.equal(
  isRestoringSession("disconnected", undefined, false),
  false,
  "disconnected must offer the connect UI immediately"
);

console.log("session: 13 assertions passed");
