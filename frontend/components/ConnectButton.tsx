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
      <button className="btn btn-ghost" onClick={() => disconnect()} title="Disconnect">
        <span className="data">{formatAddress(address)}</span>
      </button>
    );
  }
  return (
    <button className="btn btn-ghost" onClick={() => open()}>
      Connect
    </button>
  );
}
