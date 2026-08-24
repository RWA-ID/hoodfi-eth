"use client";

import { useAppKit } from "@reown/appkit/react";
import { useAccount, useDisconnect } from "wagmi";
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
  const { disconnect } = useDisconnect();

  /**
   * Disconnect, or clear the session when there is nothing left to disconnect from.
   *
   * A rehydrated connector stub has no `disconnect` method, so wagmi's `disconnect()`
   * resolves against an object that cannot do anything and the click is a silent no-op —
   * no error, no state change, nothing in the console. Observed on this page 2026-08-24.
   * Clearing the stored session and reloading is the only way out, and it is what the
   * person pressing this button is asking for either way.
   */
  const onDisconnect = () => {
    if (isDeadConnector(connector)) {
      void resetWalletSession();
      return;
    }
    disconnect();
  };

  if (isConnected && address) {
    return (
      <button
        className="data h-9 border border-[color-mix(in_srgb,var(--ink)_35%,transparent)] px-3 text-[12px] font-medium transition-colors hover:bg-[var(--hover-fill)]"
        onClick={onDisconnect}
        title="Disconnect"
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
