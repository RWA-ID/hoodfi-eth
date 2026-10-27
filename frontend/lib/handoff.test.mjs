/**
 * The /mint query handoff. Run from `frontend/`: `node --experimental-strip-types
 * lib/handoff.test.mjs`, or `npm test`.
 */
import assert from "node:assert";
import { handoffName } from "./handoff.ts";

// The home page's handoff.
assert.equal(handoffName("?q=gmgm"), "gmgm");

// The widget's handoff, exactly as widget.js builds it: the name a visitor typed into a
// partner's card must arrive in the mint field, not be dropped on the way.
assert.equal(handoffName("?partner=0x5f11a48230f7CdaB91A2361576239091E4b1165b&label=stonks&pay=usdg"), "stonks");

// Both present: the home page's spelling wins. Neither: nothing to fill in.
assert.equal(handoffName("?q=first&label=second"), "first");
assert.equal(handoffName("?partner=0x5f11a48230f7CdaB91A2361576239091E4b1165b"), "");
assert.equal(handoffName(""), "");

console.log("handoff: ok");
