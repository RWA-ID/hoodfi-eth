"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
import { formatEth } from "@/lib/format";
import { GOAL_YEARS } from "@/lib/site";
import { track } from "@/lib/analytics";
import { walletErrorMessage } from "@/lib/errors";
import { ShareOnX } from "./ShareOnX";

/**
 * The donation drive, reframed as a perk rather than the main event: donating a year
 * to hoodfi.eth's ENS expiry earns one credit, and a credit mints any 1-3 character
 * name free — the inventory that isn't otherwise for sale yet.
 */
export function DonatePanel() {
  const [years, setYears] = useState(1);
  // Snapshot of what was submitted, so the share text can't drift while confirming.
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<number | null>(null);

  const { address, isConnected, chainId } = useAccount();
  const { open } = useAppKit();
  const { switchChainAsync } = useSwitchChain();
  const {
    writeContractAsync,
    data: txHash,
    isPending,
    error: writeError,
  } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: mainnet.id,
  });

  const enabled = Boolean(DONATIONS_ADDRESS);

  const { data: quote } = useReadContract({
    address: DONATIONS_ADDRESS,
    abi: donationsAbi,
    functionName: "quote",
    args: [BigInt(years || 1)],
    chainId: mainnet.id,
    query: { enabled: enabled && years > 0, refetchInterval: 60_000 },
  });

  const { data: myCredits } = useReadContract({
    address: DONATIONS_ADDRESS,
    abi: donationsAbi,
    functionName: "shortCredits",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    chainId: mainnet.id,
    query: { enabled: enabled && Boolean(address), refetchInterval: 30_000 },
  });

  const completed = useRef(false);
  useEffect(() => {
    if (receipt.isSuccess && submitted !== null && !completed.current) {
      completed.current = true;
      track("donate_completed", { value: submitted });
    }
  }, [receipt.isSuccess, submitted]);

  async function donate() {
    if (!DONATIONS_ADDRESS || !quote) return;
    if (!isConnected) {
      track("connect_opened");
      open();
      return;
    }
    setActionError(null);
    try {
      // Declining the network prompt rejects here; uncaught it escaped the click
      // handler and the button just went dead.
      if (chainId !== mainnet.id) {
        await switchChainAsync({ chainId: mainnet.id });
      }
      track("donate_started", { value: years });
      // 5% buffer absorbs oracle drift between quote and inclusion; the contract
      // refunds every wei above the live renewal price in the same transaction.
      const value = (quote * 105n) / 100n;
      await writeContractAsync({
        address: DONATIONS_ADDRESS,
        abi: donationsAbi,
        functionName: "donate",
        args: [BigInt(years)],
        value,
        chainId: mainnet.id,
      });
      setSubmitted(years);
    } catch (error) {
      setActionError(walletErrorMessage(error));
    }
  }

  return (
    <div className="panel p-6 sm:p-8">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="display text-xl">Earn a short name</h3>
        {address && myCredits !== undefined && (
          <div className="data text-xs text-[var(--dim)]">
            your credits: <span className="ok">{myCredits.toString()}</span>
          </div>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[var(--dim)]">
        Add a year to hoodfi.eth&apos;s expiry on Ethereum and earn one credit.
        Each credit mints any 1, 2 or 3 character name — free, and before they
        open to everyone at {GOAL_YEARS} years.
      </p>

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
          max={GOAL_YEARS}
          value={years}
          onChange={(e) =>
            setYears(
              Math.max(1, Math.min(GOAL_YEARS, Number(e.target.value) || 1))
            )
          }
          aria-label="Years to donate"
        />
        <button
          className="btn btn-ghost !px-4"
          onClick={() => setYears((y) => Math.min(GOAL_YEARS, y + 1))}
          aria-label="One year more"
          type="button"
        >
          +
        </button>
      </div>

      <div className="mt-4">
        <div className="ledger-row">
          <span className="text-sm text-[var(--dim)]">
            Extends hoodfi.eth by
          </span>
          <span className="data text-sm">
            {years} year{years === 1 ? "" : "s"}
          </span>
        </div>
        <div className="ledger-row">
          <span className="text-sm text-[var(--dim)]">
            Short-name credits earned
          </span>
          <span className="data text-sm ok">{years}</span>
        </div>
        <div className="ledger-row">
          <span className="text-sm text-[var(--dim)]">
            Cost (live ENS renewal price)
          </span>
          <span className="data text-sm">
            {enabled ? (quote ? `${formatEth(quote)} ETH` : "…") : "—"}
          </span>
        </div>
      </div>

      <button
        className="btn btn-primary mt-6 w-full"
        onClick={donate}
        disabled={!enabled || isPending || receipt.isLoading}
        type="button"
      >
        {!enabled
          ? "Opens soon"
          : !isConnected
          ? "Connect to donate"
          : isPending
          ? "Confirm in wallet…"
          : receipt.isLoading
          ? "Extending hoodfi.eth…"
          : `Donate ${years} year${years === 1 ? "" : "s"}`}
      </button>

      {receipt.isSuccess && txHash && (
        <div className="mt-4 rounded-md border border-[var(--line)] bg-[var(--green-soft)] p-4">
          <div className="data text-xs ok">
            ✓ hoodfi.eth extended — {submitted} credit
            {submitted === 1 ? "" : "s"} earned.{" "}
            <a
              className="underline"
              href={`https://etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              View transaction
            </a>
          </div>
          <Link href="/mint/" className="btn btn-primary mt-3 w-full">
            Mint your short name
          </Link>
          <ShareOnX
            className="btn btn-ghost mt-2 w-full"
            eventLabel="donate_success"
            text={`Just added ${submitted} year${
              submitted === 1 ? "" : "s"
            } to hoodfi.eth's ENS expiry and earned ${submitted} premium name credit${
              submitted === 1 ? "" : "s"
            } on Robinhood Chain.\n\nEvery year donated keeps the name alive and unlocks a 1-3 character name:`}
          />
        </div>
      )}
      {(actionError || writeError) && (
        <div className="data mt-3 break-words text-xs bad">
          {actionError ?? walletErrorMessage(writeError)}
        </div>
      )}

      <p className="data mt-4 text-[11px] leading-relaxed text-[var(--faint)]">
        One transaction on Ethereum. Your ETH goes straight to the official ENS
        controller — this site&apos;s contract can&apos;t hold funds, and any
        excess is refunded in the same transaction.
      </p>
    </div>
  );
}
