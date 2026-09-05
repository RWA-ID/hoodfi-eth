"use client";

import { useEffect, useRef } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import { useAccount, useSwitchChain } from "wagmi";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chains";

/**
 * Put social and email logins on Robinhood Chain, once, on connect.
 *
 * `defaultNetwork` in createAppKit is mainnet because donations renew hoodfi.eth on
 * mainnet, and it cannot vary by how someone connected. For an embedded wallet that
 * default is actively dangerous rather than merely wrong:
 *
 * AppKit defaults EVM accounts to `smartAccount`, but only on the chains in
 * SMART_ACCOUNT_ENABLED_NETWORKS — 43 of them, and 4663 is not one. So a social login
 * holds a smart-account address on mainnet and a *different* EOA address on Robinhood
 * Chain. Landing on mainnet means Receive shows a QR for the mainnet address while
 * minting spends from the other one, so a user can fund themselves and still be unable
 * to mint, with nothing on screen explaining why the address changed.
 *
 * Only wallet-less logins are moved. Someone who arrived with MetaMask chose their own
 * network and is left alone.
 *
 * Switches once per connection, not on every render: a donor who deliberately goes back
 * to mainnet must stay there, and a guard that re-asserts itself would fight them.
 */
export function SocialDefaultNetwork() {
  const { embeddedWalletInfo } = useAppKitAccount();
  const { isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const handled = useRef(false);

  const isEmbedded = Boolean(embeddedWalletInfo?.authProvider);

  useEffect(() => {
    // Reset on disconnect so the next login is switched again.
    if (!isConnected || !isEmbedded) {
      handled.current = false;
      return;
    }
    if (handled.current) return;
    handled.current = true;
    if (chainId !== ROBINHOOD_CHAIN_ID) {
      switchChain({ chainId: ROBINHOOD_CHAIN_ID });
    }
  }, [isConnected, isEmbedded, chainId, switchChain]);

  return null;
}
