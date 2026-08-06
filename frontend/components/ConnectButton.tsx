"use client";

import { useAppKit } from "@reown/appkit/react";
import { useAccount, useDisconnect } from "wagmi";
import { formatAddress } from "@/lib/format";

export function ConnectButton() {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        className="nav-pill data inline-flex items-center font-semibold text-[var(--paper)]"
        onClick={() => disconnect()}
        title="Disconnect"
      >
        {formatAddress(address)}
      </button>
    );
  }
  return (
    <button
      className="nav-pill data inline-flex items-center font-semibold text-[var(--paper)]"
      onClick={() => open()}
    >
      Connect
    </button>
  );
}
