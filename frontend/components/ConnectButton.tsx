"use client";

import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { useAccount } from "wagmi";
import { formatAddress } from "@/lib/format";
import { AUTH_CONNECTOR_ID, isDeadConnector, resetWalletSession } from "@/lib/session";

/**
 * The header's wallet control: an ink button when there's nothing connected, and the
 * connected address as a bordered cell — same 36px height as the X square beside it,
 * so the right-hand cluster reads as one strip.
 */
export function ConnectButton() {
  const { open } = useAppKit();
  const { address, connector, isConnected } = useAccount();
  const { embeddedWalletInfo } = useAppKitAccount();

  /**
   * A social or email login is labelled, not addressed.
   *
   * `0x6af2…0C7A` is a useful label for someone who arrived with MetaMask: they know
   * what it is and they have somewhere else to go if this page disappoints them. To
   * someone who signed in with Google it is a meaningless string, and nothing about it
   * suggests it can be clicked — so the wallet this site just created for them stays
   * invisible. Naming the thing is what makes it findable.
   */
  /**
   * `embeddedWalletInfo` is populated when the login happens and is NOT restored on
   * rehydration, so on every reload it is undefined and the label fell back to the
   * address — exactly the state this is meant to fix (observed live 2026-09-04). The
   * connector id survives, because wagmi persists it, so it is the reliable half.
   * authProvider is still checked first: it is the public API and it is right at connect
   * time, before wagmi has stored anything.
   */
  const isSocial =
    Boolean(embeddedWalletInfo?.authProvider) || connector?.id === AUTH_CONNECTOR_ID;

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
        title={isSocial ? `Social wallet — ${formatAddress(address)}` : "Account"}
        type="button"
      >
        {isSocial ? (
          <>
            {/* Two labels, not one truncated: the header loses its nav under 880px and
                still has to hold the logo, the X square and this. "View Social Wallet"
                does not fit a 375px phone beside them, and a clipped label is worse
                than a short one. The address stays in the tooltip either way. */}
            {/* Uppercase to match MINT / LOOK UP / MANAGE across the header — this is a
                label now, and every other label in that strip is set this way. */}
            <span className="hidden uppercase min-[560px]:inline">View Social Wallet</span>
            <span className="uppercase min-[560px]:hidden">Wallet</span>
          </>
        ) : (
          formatAddress(address)
        )}
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
