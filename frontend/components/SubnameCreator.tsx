"use client";

import { useMemo, useState } from "react";
import { useAccount, useReadContracts, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { robinhoodChain } from "@/lib/chains";
import { L2_REGISTRY_ADDRESS, registryAbi } from "@/lib/contracts";
import { walletErrorMessage } from "@/lib/errors";
import { track } from "@/lib/analytics";
import { checkLabel } from "@/lib/labels";
import {
  type SubnameDraft,
  buildBatchCalls,
  checkSubnameRow,
  duplicateLabels,
  subnameOf,
  subnodeOf,
} from "@/lib/subnames";
import type { OwnedName } from "./useMyNames";

/** Rows start with one blank, and the batch is capped so one signature stays legible. */
const MAX_ROWS = 20;

let rowSeq = 0;
function blankRow(): SubnameDraft {
  rowSeq += 1;
  return { id: `row-${rowSeq}`, label: "", recipient: "" };
}

/**
 * Creating names beneath a name you already own — one signature for the whole batch.
 *
 * This talks straight to the registry: `createSubnode` is guarded by the owner of the
 * parent node, so no registrar and no payment is involved, and the same panel works
 * at any depth. The holder of `jack.aaron.hoodfi.eth` sees exactly this UI for
 * creating names under *that*.
 */
export function SubnameCreator({
  name,
  onCreated,
}: {
  name: OwnedName;
  onCreated: () => void;
}) {
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, data: txHash, isPending, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: robinhoodChain.id,
  });

  const [rows, setRows] = useState<SubnameDraft[]>([blankRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const checks = useMemo(() => rows.map(checkSubnameRow), [rows]);
  const dupes = useMemo(() => duplicateLabels(checks), [checks]);

  /**
   * The label half of each row, judged on its own.
   *
   * The preview line under the label reads from this rather than from the row as a
   * whole. A mistyped recipient already reports itself under the recipient field, and
   * blanking the name being created at the same moment reads as though the name were
   * the thing at fault.
   */
  const labelChecks = useMemo(
    () => rows.map((row) => checkLabel(row.label)),
    [rows]
  );

  /**
   * Availability for every valid row, read with the non-reverting `owner` getter so a
   * free label answers zero rather than throwing. `useReadContracts` reports a dead
   * transport as every-entry-failed, which is the same shape as a genuine revert — so
   * a failed entry is treated as "unknown", never as "available". The chain rechecks
   * on submit anyway; this is only here to catch a clash before a signature is spent.
   */
  const takenReads = useReadContracts({
    contracts: checks.map((check) => ({
      address: L2_REGISTRY_ADDRESS,
      abi: registryAbi,
      functionName: "owner" as const,
      args: [check.ok ? subnodeOf(name.node, check.label) : name.node],
      chainId: robinhoodChain.id,
    })),
    query: { enabled: Boolean(L2_REGISTRY_ADDRESS) && checks.some((c) => c.ok) },
  });

  function rowStatus(i: number): { tone: string; text: string } | null {
    const check = checks[i];
    if (!rows[i].label.trim()) return null;
    if (!check.ok) return { tone: "var(--bad)", text: check.reason };
    if (dupes.has(check.label)) return { tone: "var(--bad)", text: "Listed twice" };

    const read = takenReads.data?.[i];
    if (!read || read.status === "failure") return null;
    const owner = read.result as string | undefined;
    if (owner && owner !== "0x0000000000000000000000000000000000000000")
      return { tone: "var(--bad)", text: "Already taken" };
    return { tone: "var(--olive)", text: "Available" };
  }

  const validRows = checks.filter((c) => c.ok);
  const blocked =
    dupes.size > 0 ||
    checks.some((c, i) => rows[i].label.trim() !== "" && !c.ok) ||
    checks.some((_, i) => rowStatus(i)?.text === "Already taken");
  const canSubmit =
    Boolean(address) && validRows.length > 0 && !blocked && !submitting && !isPending;

  function update(id: string, patch: Partial<SubnameDraft>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function submit() {
    if (!address || !L2_REGISTRY_ADDRESS) return;
    setActionError(null);
    setSubmitting(true);
    try {
      if (chainId !== robinhoodChain.id) {
        await switchChainAsync({ chainId: robinhoodChain.id });
      }
      const calls = buildBatchCalls(name.node, checks, address);
      track("subnames_created");
      await writeContractAsync({
        address: L2_REGISTRY_ADDRESS,
        abi: registryAbi,
        functionName: "multicall",
        args: [calls],
        chainId: robinhoodChain.id,
      });
      setRows([blankRow()]);
      onCreated();
    } catch (err) {
      setActionError(walletErrorMessage(err) ?? "Couldn't create the names.");
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || isPending || receipt.isLoading;

  return (
    // No top border here: this is the first section inside the bordered box the editor
    // wraps it in, and its own rule would double the line. TransferName keeps one,
    // because it does need separating from this.
    <div>
      <div className="px-4 pt-5 sm:px-5">
        <h4 className="h-sub">Create names under this one</h4>
        <p className="mt-2 max-w-[70ch] text-xs leading-relaxed text-[var(--faint)]">
          You own <span className="data">{name.name}</span>, so you can hand out names
          beneath it — <span className="data">anything.{name.name}</span> — for the cost
          of gas. Leave the wallet blank to keep one for yourself. Whoever receives a
          name owns it outright and can create names under it in turn.
        </p>
      </div>

      <div className="mt-4 px-4 sm:px-5">
        {rows.map((row, i) => {
          const status = rowStatus(i);
          return (
            <div key={row.id} className="mb-3 flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-[1_1_150px]">
                <input
                  className="input w-full"
                  value={row.label}
                  onChange={(e) => update(row.id, { label: e.target.value })}
                  placeholder="jack"
                  spellCheck={false}
                  autoComplete="off"
                  aria-label={`Name ${i + 1}`}
                />
                <div className="data mt-1 truncate text-[11px] text-[var(--faint)]">
                  {labelChecks[i].ok ? subnameOf(name.name, labelChecks[i].label) : " "}
                </div>
              </div>
              <div className="min-w-0 flex-[1_1_260px]">
                <input
                  className="input w-full"
                  value={row.recipient}
                  onChange={(e) => update(row.id, { recipient: e.target.value })}
                  placeholder="0x… (blank keeps it)"
                  spellCheck={false}
                  autoComplete="off"
                  aria-label={`Recipient ${i + 1}`}
                />
                <div
                  className="data mt-1 truncate text-[11px]"
                  style={{ color: status?.tone ?? "var(--faint)" }}
                >
                  {status?.text ?? " "}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost h-11 flex-none px-3"
                onClick={() =>
                  setRows((prev) =>
                    prev.length === 1 ? [blankRow()] : prev.filter((r) => r.id !== row.id)
                  )
                }
                aria-label={`Remove row ${i + 1}`}
              >
                Remove
              </button>
            </div>
          );
        })}

        <button
          type="button"
          className="btn btn-ghost"
          disabled={rows.length >= MAX_ROWS}
          onClick={() => setRows((prev) => [...prev, blankRow()])}
        >
          Add another
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5">
        <button
          className="btn btn-ink sm:w-48"
          onClick={submit}
          disabled={!canSubmit}
          type="button"
        >
          {busy ? "Creating…" : "Create names"}
        </button>
        <span className="data text-xs text-[var(--faint)]">
          {validRows.length === 0
            ? "Nothing to create yet"
            : `${validRows.length} name${validRows.length === 1 ? "" : "s"} — one transaction`}
        </span>
      </div>

      <div className="px-4 pb-5 sm:px-5">
        {(actionError || error) && (
          <div className="data break-words text-xs" style={{ color: "var(--bad)" }}>
            {actionError ?? walletErrorMessage(error)}
          </div>
        )}
        {receipt.isSuccess && !busy && (
          <div className="data text-xs" style={{ color: "var(--olive)" }}>
            ✓ Created onchain. Names sent to someone else now show up in their wallet.
          </div>
        )}
        {/* Each gifted name is minted here first so its address record can be written
            while we still hold it, then transferred in the same transaction — the
            registry authorises record writes against the owner of the name being
            written, so a name handed over first can no longer be set up for its
            recipient. Worth saying plainly: a wallet will show two steps per gift. */}
        <p className="data mt-3 text-[11px] leading-relaxed text-[var(--faint)]">
          Each name is pointed at its recipient before it is handed over, so it resolves
          the moment they receive it. Free beyond gas — no renewals, same as every
          hoodfi name.
        </p>
      </div>
    </div>
  );
}
