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
 * The name a row will create, drawn so the new part is what you read first.
 *
 * Everything below the last two labels is dimmed — the inherited tail is context, not
 * news. Which labels those are is computed, never hardcoded: this panel is the same
 * one the holder of `jack.aaron.hoodfi.eth` uses to go deeper still, so the middle
 * section is however many labels happen to sit between the new one and the root.
 */
function NamePreview({ full, parent }: { full: string | null; parent: string }) {
  // `pb-1` is not spacing, it is clearance. A border on an inline element paints
  // outside the line box, and the line box is exactly as tall as this element's
  // `overflow:hidden` clip — so the lime underline computed correctly and was then
  // clipped away to nothing. The padding extends the clip box far enough to keep it.
  const cls =
    "data min-w-0 overflow-hidden text-ellipsis whitespace-nowrap pb-1 text-[19px] font-medium tracking-[-0.02em] sm:text-2xl";

  // Nothing typed yet: the parent alone, wholly dimmed, at the same size — the row
  // keeps its height and the field below it doesn't jump on the first keystroke.
  if (!full) {
    return <span className={`${cls} text-[rgba(11,14,8,0.4)]`}>{parent}</span>;
  }

  const parts = full.split(".");
  const label = parts[0];
  const root = parts[parts.length - 2] ?? "";
  const tld = parts[parts.length - 1] ?? "";
  const middle = parts.slice(1, -2);

  return (
    <span className={cls}>
      <span className="border-b-2 border-[var(--lime)]">{label}</span>
      <span className="text-[rgba(11,14,8,0.4)]">
        .{middle.length > 0 ? `${middle.join(".")}.` : ""}
      </span>
      <span>{root}</span>
      <span className="text-[rgba(11,14,8,0.4)]">.{tld}</span>
    </span>
  );
}

/**
 * Creating names beneath a name you already own — one signature for the whole batch.
 *
 * This talks straight to the registry: `createSubnode` is guarded by the owner of the
 * parent node, so no registrar and no payment is involved, and the same panel works
 * at any depth. The holder of `jack.aaron.hoodfi.eth` sees exactly this UI for
 * creating names under *that*.
 *
 * Drawn as an ink card with the rows as paper floating on it. The hierarchy is the
 * point: the full name each row will create is the largest thing in it, because that
 * name is the thing being decided — the two fields underneath are only how you spell
 * it. Buried in the records box as a plain pair of inputs, this read as an afterthought
 * to the editor above it rather than as the second thing a name can do.
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
   * The preview line reads from this rather than from the row as a whole. A mistyped
   * recipient already reports itself under the recipient field, and blanking the name
   * being created at the same moment reads as though the name were the thing at fault.
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
    return { tone: "var(--olive)", text: "✓ available" };
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
  const countLabel =
    validRows.length === 1 ? "1 name" : `${validRows.length} names`;

  return (
    // `self-start` only above the breakpoint, where the row is a row: in the stacked
    // layout the cross axis is width, and a card that starts rather than stretches is
    // a card as wide as its longest line. Its job here is to stop the rail — which is
    // four blocks tall whatever happens — from forcing this card to match it, which at
    // one row left a third of it as empty black. The rail still stretches to *this*
    // card once a couple of names are queued, which is the direction that matters.
    <div className="on-ink shadow-hero flex min-w-0 flex-1 flex-col gap-5 p-[22px] sm:p-[26px] sm:pb-7 min-[900px]:self-start">
      <div className="flex flex-col items-start justify-between gap-4 border-b border-[rgba(241,241,234,0.18)] pb-[18px] sm:flex-row sm:items-end sm:gap-6">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="data text-[10.5px] uppercase tracking-[0.2em] text-[var(--lime)]">
            hand out names
          </span>
          <h3 className="text-[clamp(24px,3vw,30px)] font-extrabold leading-[0.98] tracking-[-0.035em] text-[var(--fg)]">
            Create names under this one
          </h3>
        </div>
        <p className="max-w-[32ch] text-[12.5px] leading-[1.6] text-pretty text-[rgba(241,241,234,0.6)]">
          Anything under{" "}
          <span className="data break-words text-[var(--fg)]">{name.name}</span> is yours
          to give. Blank wallet keeps it.
        </p>
      </div>

      <div className="flex flex-col gap-3.5">
        {rows.map((row, i) => {
          const status = rowStatus(i);
          const preview = labelChecks[i].ok
            ? subnameOf(name.name, labelChecks[i].label)
            : null;
          return (
            <div
              key={row.id}
              className="on-paper flex flex-col gap-3 px-[18px] py-4"
            >
              <div className="flex items-baseline justify-between gap-4">
                <NamePreview full={preview} parent={name.name} />
                {status && (
                  <span
                    className="data flex-none text-[10px] uppercase tracking-[0.16em]"
                    style={{ color: status.tone }}
                  >
                    {status.text}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 items-center gap-x-3.5 gap-y-3 border-t border-[rgba(11,14,8,0.12)] pt-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <div className="flex min-w-0 flex-col gap-1">
                  <label
                    className="data text-[9.5px] uppercase tracking-[0.18em] text-[rgba(11,14,8,0.45)]"
                    htmlFor={`sub-label-${row.id}`}
                  >
                    label
                  </label>
                  <input
                    id={`sub-label-${row.id}`}
                    className="field-bare"
                    value={row.label}
                    onChange={(e) => update(row.id, { label: e.target.value })}
                    placeholder="jack"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <label
                    className="data text-[9.5px] uppercase tracking-[0.18em] text-[rgba(11,14,8,0.45)]"
                    htmlFor={`sub-to-${row.id}`}
                  >
                    recipient
                  </label>
                  <input
                    id={`sub-to-${row.id}`}
                    className="field-bare"
                    value={row.recipient}
                    onChange={(e) => update(row.id, { recipient: e.target.value })}
                    placeholder="0x… (blank keeps it)"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>
                <button
                  type="button"
                  className="justify-self-end text-[13px] font-semibold text-[rgba(11,14,8,0.5)] transition-colors hover:text-[var(--ink)]"
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
            </div>
          );
        })}

        {/* Dashed rather than boxed: adding a row is not a decision on the same footing
            as signing for the batch, and a second solid button beside the lime one
            would say it was. */}
        <button
          type="button"
          className="data w-full border border-dashed border-[rgba(241,241,234,0.35)] px-[18px] py-3.5 text-[12px] uppercase tracking-[0.14em] text-[rgba(241,241,234,0.75)] transition-colors hover:border-[var(--lime)] hover:text-[var(--lime)] disabled:opacity-40 disabled:hover:border-[rgba(241,241,234,0.35)] disabled:hover:text-[rgba(241,241,234,0.75)]"
          disabled={rows.length >= MAX_ROWS}
          onClick={() => setRows((prev) => [...prev, blankRow()])}
        >
          + add another name
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3.5">
        <button
          className="btn btn-lime px-[26px]"
          onClick={submit}
          disabled={!canSubmit}
          type="button"
        >
          {busy
            ? "Creating…"
            : validRows.length === 0
            ? "Create names"
            : `Create ${countLabel}`}
        </button>
        <span className="data text-[11.5px] text-[rgba(241,241,234,0.55)]">
          one transaction · gas only · no renewals
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {(actionError || error) && (
          <div className="data break-words text-xs" style={{ color: "var(--bad)" }}>
            {actionError ?? walletErrorMessage(error)}
          </div>
        )}
        {receipt.isSuccess && !busy && (
          <div className="data text-xs" style={{ color: "var(--lime)" }}>
            ✓ Created onchain. Names sent to someone else now show up in their wallet.
          </div>
        )}
        {/* Each gifted name is minted here first so its address record can be written
            while we still hold it, then transferred in the same transaction — the
            registry authorises record writes against the owner of the name being
            written, so a name handed over first can no longer be set up for its
            recipient. Worth saying plainly: a wallet will show two steps per gift. */}
        <p className="data text-[11px] leading-relaxed text-[var(--faint)]">
          Each name is pointed at its recipient before it is handed over, so it resolves
          the moment they receive it.
        </p>
      </div>
    </div>
  );
}
