"use client";

import { useEffect, useState } from "react";
import { getAddress } from "viem";
import {
  useAccount,
  useBalance,
  useSwitchChain,
  useWaitForTransactionReceipt,
} from "wagmi";
import { mainnet } from "wagmi/chains";
import { useWriteContractCompat } from "@/lib/useWriteContractCompat";
import {
  REVERSE_REGISTRAR_ADDRESS,
  reverseRegistrarAbi,
} from "@/lib/contracts";
import { walletErrorMessage } from "@/lib/errors";
import { track } from "@/lib/analytics";
import type { L1State } from "@/lib/resolution";
import { publicClient } from "@/lib/wagmi";
import type { OwnedName } from "./useMyNames";

/** What `getEnsName` says this wallet's primary is — tri-state, so a failed read never reads as "none". */
type Current =
  | { status: "checking" }
  | { status: "ok"; name: string | null }
  | { status: "error" };

/**
 * Making this name the wallet's ENS primary name, so apps show it instead of `0x…`.
 *
 * A primary name is two directions agreeing: the reverse record (address → name), set
 * here with one `setName` on the mainnet ReverseRegistrar, and the name's ETH record
 * pointing back at the same address. The second is what `l1` already reports — it is
 * the same Universal Resolver lookup an app runs to verify a primary — so the button
 * waits on it. Setting the reverse record first would do no harm, but the name would
 * not show anywhere, and that reads as a transaction that didn't work.
 *
 * Mainnet only. ENS has no reverse registrar on Robinhood Chain, and L2 primaries
 * (Base etc.) would need per-chain records this page doesn't write.
 */
export function PrimaryName({ name, l1 }: { name: OwnedName; l1: L1State }) {
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, data: txHash, isPending, error } =
    useWriteContractCompat();
  const receipt = useWaitForTransactionReceipt({ hash: txHash, chainId: mainnet.id });
  const balance = useBalance({ address, chainId: mainnet.id });

  const [current, setCurrent] = useState<Current>({ status: "checking" });
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function readCurrent(signal?: { cancelled: boolean }) {
    if (!address) return;
    setCurrent({ status: "checking" });
    try {
      const n = await publicClient.getEnsName({ address });
      if (!signal?.cancelled) setCurrent({ status: "ok", name: n });
    } catch {
      if (!signal?.cancelled) setCurrent({ status: "error" });
    }
  }

  useEffect(() => {
    const signal = { cancelled: false };
    void readCurrent(signal);
    return () => {
      signal.cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  // A receipt resolves for a reverted transaction too, so success is the status, not
  // the receipt's arrival.
  const confirmed = receipt.data?.status === "success";
  const reverted = receipt.data?.status === "reverted";
  useEffect(() => {
    if (confirmed) {
      track("primary_name_set");
      void readCurrent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed]);

  if (!address) return null;
  const me = getAddress(address);

  const isPrimary = current.status === "ok" && current.name === name.name;
  const pointsHere =
    (l1.status === "ok" || l1.status === "mismatch") && l1.addr === me;
  const busy = submitting || isPending || receipt.isLoading;
  const noGas = balance.data !== undefined && balance.data.value === 0n;

  async function setPrimary() {
    setActionError(null);
    setSubmitting(true);
    try {
      if (chainId !== mainnet.id) {
        await switchChainAsync({ chainId: mainnet.id });
      }
      await writeContractAsync({
        address: REVERSE_REGISTRAR_ADDRESS,
        abi: reverseRegistrarAbi,
        functionName: "setName",
        args: [name.name],
        chainId: mainnet.id,
      });
    } catch (err) {
      setActionError(walletErrorMessage(err) ?? "Couldn't set the primary name.");
    } finally {
      setSubmitting(false);
    }
  }

  // Why the button can't be pressed yet, in the owner's terms — or null when it can.
  const blocker = isPrimary
    ? null
    : l1.status === "checking" || l1.status === "idle"
    ? "Checking the name resolves to this wallet…"
    : l1.status === "error"
    ? "Couldn't check the name resolves to this wallet right now — try again shortly."
    : !pointsHere
    ? "Point the Ethereum address record above at this wallet and save it first — a primary name has to resolve back to you. Lookups can take up to five minutes to see a new record."
    : null;

  const currentLine =
    current.status === "checking"
      ? "checking current primary…"
      : current.status === "error"
      ? "couldn't read current primary"
      : current.name
      ? `current primary · ${current.name}`
      : "no primary name set";

  return (
    <div className="shadow-card border border-[var(--line-card)] bg-[var(--paper)]">
      <div className="flex flex-col items-start justify-between gap-4 px-5 py-[18px] sm:flex-row sm:items-center sm:gap-5">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[15px] font-bold tracking-[-0.02em]">
            {isPrimary
              ? `${name.name} is your primary name`
              : "Use this as your primary name"}
          </span>
          <span className="data break-words text-[11px] text-[rgba(11,14,8,0.5)]">
            {currentLine}
          </span>
        </div>
        {isPrimary ? (
          <span className="data flex-none text-xs" style={{ color: "var(--olive)" }}>
            ✓ Set on Ethereum
          </span>
        ) : (
          <button
            type="button"
            className="btn btn-ink w-full flex-none px-[18px] text-[13.5px] sm:w-auto"
            onClick={setPrimary}
            disabled={Boolean(blocker) || busy}
          >
            {busy ? "Setting…" : "Set as primary"}
          </button>
        )}
      </div>

      {!isPrimary && (
        <div className="px-5 pb-[18px]">
          <p className="max-w-[70ch] text-xs leading-relaxed text-[var(--faint)]">
            Wallets, explorers and apps will show <span className="data">{name.name}</span>{" "}
            instead of your address. One transaction on Ethereum mainnet — gas is usually
            a few cents, but it has to be paid in ETH on Ethereum, not Robinhood Chain.
            {current.status === "ok" && current.name
              ? ` It replaces ${current.name}.`
              : ""}
          </p>
          {blocker && (
            <p className="data mt-2 max-w-[70ch] text-xs leading-relaxed text-[var(--dim)]">
              {blocker}
            </p>
          )}
          {!blocker && noGas && (
            <p className="data mt-2 text-xs" style={{ color: "var(--bad)" }}>
              This wallet has no ETH on Ethereum mainnet to pay the gas.
            </p>
          )}
          {(actionError || error) && (
            <div className="data mt-2 break-words text-xs" style={{ color: "var(--bad)" }}>
              {actionError ?? walletErrorMessage(error)}
            </div>
          )}
          {reverted && (
            <div className="data mt-2 text-xs" style={{ color: "var(--bad)" }}>
              The transaction reverted — nothing changed.
            </div>
          )}
          {confirmed && !isPrimary && current.status !== "checking" && (
            <p className="data mt-2 text-xs leading-relaxed text-[var(--dim)]">
              Set onchain. Apps cache names, so give them a few minutes to catch up.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
