"use client";

import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { formatAddress } from "@/lib/format";
import { AUTH_CONNECTOR_ID, isDeadConnector, resetWalletSession } from "@/lib/session";
import WalletSheet from "./WalletSheet";

/**
 * The header's wallet control: an ink button when there's nothing connected, and the
 * connected address as a bordered cell — same 36px height as the X square beside it,
 * so the right-hand cluster reads as one strip.
 */
export function ConnectButton() {
  const { open } = useAppKit();
  const { address, connector, isConnected } = useAccount();
  const { embeddedWalletInfo } = useAppKitAccount();
  const { disconnect } = useDisconnect();
  const [sheetOpen, setSheetOpen] = useState(false);

  /**
   * A social or email login is labelled, not addressed.
   *
   * `0x6af2…0C7A` is a useful label for someone who arrived with MetaMask: they know
   * what it is and they have somewhere else to go if this page disappoints them. To
   * someone who signed in with Google it is a meaningless string, and nothing about it
   * suggests it can be clicked — so the wallet this app just created for them stays
   * invisible, along with the only screen explaining how to fund it.
   *
   * `embeddedWalletInfo` is populated when the login happens and is NOT restored on
   * rehydration, so on every reload it is undefined and the label fell back to the
   * address — exactly the state this is meant to fix (observed on the sibling site
   * 2026-09-04). The connector id survives, because wagmi persists it, so it is the
   * reliable half. `authProvider` is still checked first: it is the public API and it
   * is right at connect time, before wagmi has stored anything.
   */
  const isSocial =
    Boolean(embeddedWalletInfo?.authProvider) || connector?.id === AUTH_CONNECTOR_ID;

  /**
   * A dead connection is labelled with its address, never with "View Social Wallet".
   *
   * The sheet behind that label would show a balance that never resolves, and a cell
   * offering to show a wallet while actually logging you out is worse than one that
   * says nothing. ConnectionGuard's banner is what explains the state; this just stops
   * contradicting it.
   */
  const dead = isDeadConnector(connector);
  const showWalletLabel = isSocial && !dead;

  /**
   * Three destinations, by what the connection actually is.
   *
   * A social login opens OUR wallet sheet, not AppKit's account view. AppKit's view is
   * the right thing for a wallet the person brought with them, but for the embedded
   * wallet it is the wrong tool twice over: it renders blank after any reload
   * (reown-com/appkit#5765), which is precisely the state someone is in when they come
   * back to fund it before republishing, and its "Buy crypto" hands Meld no chain — for
   * any EVM chain it hardcodes USDC on mainnet, so on Robinhood Chain it charges card
   * fees and delivers an asset that is neither here nor spendable. WalletSheet shows the
   * address in full and the two routes that actually reach this chain.
   *
   * A wallet the person brought keeps this button's original job, Disconnect. That
   * wallet exists somewhere else and its owner has their own way back to it; the
   * embedded one exists only here, which is why it gets a screen instead.
   *
   * A rehydrated connector stub has no `disconnect` method, so wagmi's `disconnect()`
   * resolves against an object that cannot do anything and the click is a silent no-op
   * — no error, no state change, nothing in the console. Clearing the stored session
   * and reloading is the only way out, and it is what the person pressing this button
   * is asking for either way.
   */
  const onAccount = () => {
    if (dead) {
      void resetWalletSession();
      return;
    }
    if (isSocial) {
      setSheetOpen(true);
      return;
    }
    disconnect();
  };

  if (isConnected && address) {
    return (
      <>
        <button
          className="data h-9 border border-[color-mix(in_srgb,var(--ink)_35%,transparent)] px-3 text-[12px] font-medium transition-colors hover:bg-[var(--hover-fill)]"
          onClick={onAccount}
          title={
            dead
              ? "Session needs reconnecting — click to reset"
              : isSocial
                ? `Social wallet — ${formatAddress(address)}`
                : "Disconnect"
          }
          type="button"
        >
          {showWalletLabel ? (
            <>
              {/* Two labels, not one truncated: the header loses its nav on a narrow
                  phone and still has to hold the logo and this. "View Social Wallet"
                  does not fit beside them at 375px, and a clipped label is worse than
                  a short one. The address stays in the tooltip either way. */}
              <span className="hidden uppercase min-[560px]:inline">
                View Social Wallet
              </span>
              <span className="uppercase min-[560px]:hidden">Wallet</span>
            </>
          ) : (
            formatAddress(address)
          )}
        </button>
        <WalletSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      </>
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
