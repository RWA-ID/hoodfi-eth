"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { RECONNECT_GRACE_MS, isRestoringSession } from "@/lib/session";

/**
 * `useAccount`, with the session restore bounded.
 *
 * The homepage panel and the editor both gate their whole body on "are we still
 * restoring", and both had the same two-line copy of the test. They have to agree — the
 * homepage sends you to the editor with a plain anchor, so the editor re-runs the restore
 * from scratch on every arrival, and a page that disagrees with the one that linked to it
 * is what "I picked a name and nothing loaded" looks like from the outside.
 *
 * See `isRestoringSession` for why an unfinished reconnect must not hold the UI forever.
 */
export function useWalletStatus() {
  const account = useAccount();
  const { address, status } = account;
  const [graceExpired, setGraceExpired] = useState(false);

  useEffect(() => {
    if (status !== "reconnecting") {
      setGraceExpired(false);
      return;
    }
    // Fresh timer per entry into "reconnecting", so a later restore — an account switch,
    // a reload — gets its own grace rather than inheriting an expired one.
    setGraceExpired(false);
    const timer = setTimeout(() => setGraceExpired(true), RECONNECT_GRACE_MS);
    return () => clearTimeout(timer);
  }, [status]);

  return {
    ...account,
    /** Show the restoring state. False once there's an address, or once the grace is up. */
    reconnecting: isRestoringSession(status, address, graceExpired),
  };
}
