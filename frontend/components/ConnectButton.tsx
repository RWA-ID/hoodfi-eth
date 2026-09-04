"use client";

import { useAppKit } from "@reown/appkit/react";
import { useAccount } from "wagmi";
import { formatAddress } from "@/lib/format";
import { isDeadConnector, resetWalletSession } from "@/lib/session";

/**
 * The header's wallet control: an ink button when there's nothing connected, and the
 * connected address as a bordered cell — same 36px height as the X square beside it,
 * so the right-hand cluster reads as one strip.
 */
export function ConnectButton() {
  const { open } = useAppKit();
  const { address, connector, isConnected } = useAccount();

  /**
   * Open the account view — balance, copy address, receive, and "Upgrade Wallet".
   *
   * This used to disconnect on click, which was fine while every connection came from a
   * wallet the person already had somewhere else. Email and social login changed that:
   * the embedded wallet AppKit mints exists *only* here, so a cell that disconnects and
   * nothing else leaves its owner with no way to read their own address, fund it, or
   * graduate it to self-custody. Disconnect still exists — it lives inside this view,
   * which is where AppKit puts it.
   *
   * Exception: a rehydrated connector stub has no methods, so its account view would be
   * a dead end — balance never resolves and every action is a silent no-op. Observed on
   * this page 2026-08-24. ConnectionGuard raises a reset banner site-wide when it sees
   * one; clicking the cell does the same thing rather than opening a view that cannot act.
   */
  const onAccount = () => {
    if (isDeadConnector(connector)) {
      void resetWalletSession();
      return;
    }
    void open({ view: "Account" });
  };

  if (isConnected && address) {
    return (
      <button
        className="data h-9 border border-[color-mix(in_srgb,var(--ink)_35%,transparent)] px-3 text-[12px] font-medium transition-colors hover:bg-[var(--hover-fill)]"
        onClick={onAccount}
        title="Account"
        type="button"
      >
        {formatAddress(address)}
      </button>
    );
  }
  return (
    <button
      className="btn btn-ink h-9 px-[18px] text-[13px]"
      onClick={() => open()}
      type="button"
    >
      Connect Wallet
    </button>
  );
}
