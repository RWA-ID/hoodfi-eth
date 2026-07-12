"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { mainnet } from "wagmi/chains";
import { useAppKit } from "@reown/appkit/react";
import { DONATIONS_ADDRESS, donationsAbi } from "@/lib/contracts";
import { checkLabel } from "@/lib/labels";
import { formatEth } from "@/lib/format";

const STATUS_LABEL: Record<number, { text: string; cls: string }> = {
  0: { text: "available", cls: "ok" },
  1: { text: "already reserved", cls: "bad" },
  2: { text: "not available", cls: "bad" },
  3: { text: "invalid", cls: "bad" },
};

function LabelRow({
  value,
  onChange,
  onRemove,
}: {
  value: string;
  onChange: (v: string) => void;
  onRemove: () => void;
}) {
  const check = checkLabel(value, true);
  const { data: status } = useReadContract({
    address: DONATIONS_ADDRESS,
    abi: donationsAbi,
    functionName: "reservationStatus",
    args: [check.ok ? check.label : ""],
    chainId: mainnet.id,
    query: { enabled: Boolean(DONATIONS_ADDRESS) && check.ok },
  });

  const verdict = !value
    ? null
    : !check.ok
      ? { text: check.reason, cls: "warn" }
      : status === undefined
        ? { text: "checking…", cls: "warn" }
        : STATUS_LABEL[status];

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            className="input pr-24"
            placeholder="yourname"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            autoCapitalize="none"
          />
          <span className="data pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--faint)]">
            .hoodfi.eth
          </span>
        </div>
        <button
          className="btn btn-ghost !px-3"
          onClick={onRemove}
          aria-label="Remove name"
          type="button"
        >
          ×
        </button>
      </div>
      {verdict && (
        <div className={`data mt-1 text-xs ${verdict.cls}`}>{verdict.text}</div>
      )}
    </div>
  );
}

export function DonatePanel() {
  const [years, setYears] = useState(5);
  const [labels, setLabels] = useState<string[]>([""]);

  const { address, isConnected, chainId } = useAccount();
  const { open } = useAppKit();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, data: txHash, isPending, error: writeError } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: txHash, chainId: mainnet.id });

  const enabled = Boolean(DONATIONS_ADDRESS);

  const { data: quote } = useReadContract({
    address: DONATIONS_ADDRESS,
    abi: donationsAbi,
    functionName: "quote",
    args: [BigInt(years || 1)],
    chainId: mainnet.id,
    query: { enabled: enabled && years > 0, refetchInterval: 60_000 },
  });

  const { data: finalized } = useReadContract({
    address: DONATIONS_ADDRESS,
    abi: donationsAbi,
    functionName: "finalized",
    chainId: mainnet.id,
    query: { enabled },
  });

  const { data: mySlots } = useReadContract({
    address: DONATIONS_ADDRESS,
    abi: donationsAbi,
    functionName: "slots",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    chainId: mainnet.id,
    query: { enabled: enabled && Boolean(address), refetchInterval: 30_000 },
  });

  const cleanLabels = useMemo(
    () =>
      labels
        .map((l) => checkLabel(l, true))
        .filter((c): c is { ok: true; label: string } => c.ok)
        .map((c) => c.label),
    [labels]
  );

  const filledLabels = labels.filter((l) => l.trim().length > 0);
  const labelsAllValid = filledLabels.length === cleanLabels.length;
  const tooManyLabels = cleanLabels.length > years;

  async function donate() {
    if (!DONATIONS_ADDRESS || !quote) return;
    if (!isConnected) {
      open();
      return;
    }
    if (chainId !== mainnet.id) {
      await switchChainAsync({ chainId: mainnet.id });
    }
    // 5% buffer absorbs oracle drift between quote and inclusion; the contract
    // refunds every wei above the live renewal price in the same transaction.
    const value = (quote * 105n) / 100n;
    await writeContractAsync({
      address: DONATIONS_ADDRESS,
      abi: donationsAbi,
      functionName: "donate",
      args: [BigInt(years), cleanLabels],
      value,
      chainId: mainnet.id,
    });
  }

  if (finalized) {
    return (
      <div className="panel p-6 sm:p-8">
        <div className="eyebrow ok">goal reached</div>
        <h3 className="display mt-3 text-2xl">1,000 years secured.</h3>
        <p className="mt-2 text-sm text-[var(--dim)]">
          Donations are closed. If you reserved names, claim them free on Robinhood
          Chain — you pay only L2 gas.
        </p>
        <Link href="/claim/" className="btn btn-primary mt-5">
          Claim your names
        </Link>
      </div>
    );
  }

  return (
    <div className="panel p-6 sm:p-8">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="display text-xl">Donate years</h3>
        {address && mySlots !== undefined && (
          <div className="data text-xs text-[var(--dim)]">
            your slots: <span className="ok">{mySlots.toString()}</span>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          className="btn btn-ghost !px-4"
          onClick={() => setYears((y) => Math.max(1, y - 1))}
          aria-label="One year less"
          type="button"
        >
          −
        </button>
        <input
          className="input data flex-1 text-center text-lg"
          type="number"
          min={1}
          max={1000}
          value={years}
          onChange={(e) =>
            setYears(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))
          }
          aria-label="Years to donate"
        />
        <button
          className="btn btn-ghost !px-4"
          onClick={() => setYears((y) => Math.min(1000, y + 1))}
          aria-label="One year more"
          type="button"
        >
          +
        </button>
      </div>

      <div className="mt-4">
        <div className="ledger-row">
          <span className="text-sm text-[var(--dim)]">Extends hoodfi.eth by</span>
          <span className="data text-sm">{years} year{years === 1 ? "" : "s"}</span>
        </div>
        <div className="ledger-row">
          <span className="text-sm text-[var(--dim)]">Names you can reserve</span>
          <span className="data text-sm ok">{years}</span>
        </div>
        <div className="ledger-row">
          <span className="text-sm text-[var(--dim)]">Cost (live ENS renewal price)</span>
          <span className="data text-sm">
            {enabled ? (quote ? `${formatEth(quote)} ETH` : "…") : "—"}
          </span>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="eyebrow">reserve names now (optional)</span>
          <span className="data text-xs text-[var(--faint)]">
            {cleanLabels.length}/{years}
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {labels.map((l, i) => (
            <LabelRow
              key={i}
              value={l}
              onChange={(v) => setLabels((ls) => ls.map((x, j) => (j === i ? v : x)))}
              onRemove={() => setLabels((ls) => ls.filter((_, j) => j !== i))}
            />
          ))}
        </div>
        {labels.length < years && (
          <button
            className="data mt-3 text-xs text-[var(--dim)] hover:text-[var(--paper)]"
            onClick={() => setLabels((ls) => [...ls, ""])}
            type="button"
          >
            + add another name
          </button>
        )}
        {tooManyLabels && (
          <div className="data mt-2 text-xs warn">
            {cleanLabels.length} names need {cleanLabels.length} donated years — add
            years or remove names.
          </div>
        )}
        <p className="mt-3 text-xs leading-relaxed text-[var(--faint)]">
          Unused slots don&apos;t expire — reserve any time before the snapshot. 4+
          characters only; 1–3 character names go on public sale at launch.
        </p>
      </div>

      <button
        className="btn btn-primary mt-6 w-full"
        onClick={donate}
        disabled={!enabled || isPending || receipt.isLoading || tooManyLabels || !labelsAllValid}
        type="button"
      >
        {!enabled
          ? "Donations open soon"
          : !isConnected
            ? "Connect to donate"
            : isPending
              ? "Confirm in wallet…"
              : receipt.isLoading
                ? "Extending hoodfi.eth…"
                : `Donate ${years} year${years === 1 ? "" : "s"}`}
      </button>

      {receipt.isSuccess && txHash && (
        <div className="data mt-3 text-xs ok">
          ✓ hoodfi.eth extended.{" "}
          <a
            className="underline"
            href={`https://etherscan.io/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            View transaction
          </a>
        </div>
      )}
      {writeError && (
        <div className="data mt-3 break-words text-xs bad">
          {writeError.message.split("\n")[0]}
        </div>
      )}

      <p className="data mt-4 text-[11px] leading-relaxed text-[var(--faint)]">
        One transaction on Ethereum. Your ETH goes straight to the official ENS
        controller — this site&apos;s contract can&apos;t hold funds, and any excess
        is refunded in the same transaction.
      </p>
    </div>
  );
}
