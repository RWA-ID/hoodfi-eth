"use client";

import { useAppKit } from "@reown/appkit/react";
import { useAccount, useDisconnect } from "wagmi";
import { formatAddress } from "@/lib/format";

/**
 * The header's wallet control: an ink button when there's nothing connected, and the
 * connected address as a bordered cell — same 36px height as the X square beside it,
 * so the right-hand cluster reads as one strip.
 */
export function ConnectButton() {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        className="data h-9 border border-[color-mix(in_srgb,var(--ink)_35%,transparent)] px-3 text-[12px] font-medium transition-colors hover:bg-[var(--hover-fill)]"
        onClick={() => disconnect()}
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
