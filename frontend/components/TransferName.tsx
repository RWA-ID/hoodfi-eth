"use client";

import { useState } from "react";
import { useAccount, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { robinhoodChain } from "@/lib/chains";
import { L2_REGISTRY_ADDRESS, registryAbi } from "@/lib/contracts";
import { walletErrorMessage } from "@/lib/errors";
import { track } from "@/lib/analytics";
import { tokenIdOf } from "@/lib/subnames";
import type { OwnedName } from "./useMyNames";

const ZERO = "0x0000000000000000000000000000000000000000";

/**
 * Sending a name to another wallet.
 *
 * Deliberately the most guarded control on the page. Everything else here is a record
 * the owner can rewrite at will; this one hands the name itself to someone else and
 * cannot be undone from our side — if the address is wrong, the name is gone, and
 * there is no expiry to eventually recover it. So the destination has to be a
 * well-formed address that is not the current holder and not the zero address, and the
 * owner has to type the name out before the button will do anything.
 */
export function TransferName({
  name,
  onTransferred,
}: {
  name: OwnedName;
  onTransferred: () => void;
}) {
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, data: txHash, isPending, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: robinhoodChain.id,
  });

  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const trimmed = to.trim();
  const wellFormed = /^0x[0-9a-fA-F]{40}$/.test(trimmed);
  const isSelf = wellFormed && address
    ? trimmed.toLowerCase() === address.toLowerCase()
    : false;
  const isZero = wellFormed && trimmed.toLowerCase() === ZERO;
  const confirmed = confirm.trim().toLowerCase() === name.name.toLowerCase();

  const problem = !trimmed
    ? null
    : !wellFormed
    ? "That isn't a wallet address"
    : isZero
    ? "That's the burn address — the name would be destroyed"
    : isSelf
    ? "That's this wallet — it already holds the name"
    : null;

  const busy = submitting || isPending || receipt.isLoading;
  const canSend = wellFormed && !isSelf && !isZero && confirmed && !busy;

  async function send() {
    if (!address || !L2_REGISTRY_ADDRESS || !canSend) return;
    setActionError(null);
    setSubmitting(true);
    try {
      if (chainId !== robinhoodChain.id) {
        await switchChainAsync({ chainId: robinhoodChain.id });
      }
      track("name_transferred");
      await writeContractAsync({
        address: L2_REGISTRY_ADDRESS,
        abi: registryAbi,
        functionName: "transferFrom",
        args: [address, trimmed as `0x${string}`, tokenIdOf(name.node)],
        chainId: robinhoodChain.id,
      });
      setTo("");
      setConfirm("");
      setOpen(false);
      onTransferred();
    } catch (err) {
      setActionError(walletErrorMessage(err) ?? "Couldn't send the name.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div className="border-t border-[var(--line-card)] px-4 py-4 sm:px-5">
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
          Send this name to another wallet
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--line-card)]">
      <div className="px-4 pt-5 sm:px-5">
        <h4 className="h-sub">Send this name</h4>
        <p className="mt-2 max-w-[70ch] text-xs leading-relaxed text-[var(--faint)]">
          Transfers <span className="data">{name.name}</span> and everything under it to
          another wallet. Its records travel with it, and any names created beneath it
          stay with whoever holds those. This cannot be undone — there is no expiry and
          no way for us to reverse it, so check the address twice.
        </p>
      </div>

      <div className="mt-4 space-y-3 px-4 sm:px-5">
        <div>
          <label className="label block" htmlFor="transfer-to">
            Destination wallet
          </label>
          <input
            id="transfer-to"
            className="input mt-1.5 w-full"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="0x…"
            spellCheck={false}
            autoComplete="off"
          />
          {problem && (
            <div className="data mt-1 text-[11px]" style={{ color: "var(--bad)" }}>
              {problem}
            </div>
          )}
        </div>

        <div>
          <label className="label block" htmlFor="transfer-confirm">
            Type <span className="data">{name.name}</span> to confirm
          </label>
          <input
            id="transfer-confirm"
            className="input mt-1.5 w-full"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={name.name}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5">
        <button className="btn btn-ink sm:w-48" onClick={send} disabled={!canSend} type="button">
          {busy ? "Sending…" : "Send name"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setOpen(false);
            setTo("");
            setConfirm("");
            setActionError(null);
          }}
          disabled={busy}
        >
          Cancel
        </button>
      </div>

      <div className="px-4 pb-5 sm:px-5">
        {(actionError || error) && (
          <div className="data break-words text-xs" style={{ color: "var(--bad)" }}>
            {actionError ?? walletErrorMessage(error)}
          </div>
        )}
        {receipt.isSuccess && !busy && (
          <div className="data text-xs" style={{ color: "var(--olive)" }}>
            ✓ Sent. The name is no longer in this wallet.
          </div>
        )}
      </div>
    </div>
  );
}
