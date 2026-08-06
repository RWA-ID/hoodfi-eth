"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { robinhoodChain } from "@/lib/chains";
import {
  REGISTRAR_ADDRESS,
  USDC_ADDRESS,
  ZERO_ADDRESS,
  erc20Abi,
  registrarAbi,
} from "@/lib/contracts";
import { MINT_STATUS, TIER_USD, checkLabel, isShort, tierOf } from "@/lib/labels";
import { formatEth } from "@/lib/format";
import { VOUCHER_URL } from "@/lib/site";
import { track } from "@/lib/analytics";
import { ShareOnX } from "./ShareOnX";

type Voucher = {
  totalCredits: string;
  creditsAvailable: string;
  expiry: string;
  signature: `0x${string}`;
};

type PayMethod = "eth" | "usdg";

/** Debounced so we don't fire a contract read on every keystroke. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function MintPanel({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [method, setMethod] = useState<PayMethod>("eth");
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  // Snapshot at submit time so the success card can't drift if the field is edited
  // while the transaction confirms.
  const [minted, setMinted] = useState<string | null>(null);

  const { address, isConnected, chainId } = useAccount();
  const { open } = useAppKit();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, data: txHash, isPending, error: writeError } =
    useWriteContract();
  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: robinhoodChain.id,
  });

  const enabled = Boolean(REGISTRAR_ADDRESS);
  const check = checkLabel(query);
  const label = check.ok ? check.label : "";
  const debouncedLabel = useDebounced(label, 350);
  const short = isShort(debouncedLabel);
  const tier = debouncedLabel ? tierOf(debouncedLabel) : 3;

  const searched = useRef<string>("");
  useEffect(() => {
    if (debouncedLabel && debouncedLabel !== searched.current) {
      searched.current = debouncedLabel;
      track("name_searched", { tier: String(tierOf(debouncedLabel)) });
    }
  }, [debouncedLabel]);

  const { data: status, isFetching: statusFetching } = useReadContract({
    address: REGISTRAR_ADDRESS,
    abi: registrarAbi,
    functionName: "status",
    args: [debouncedLabel],
    chainId: robinhoodChain.id,
    query: { enabled: enabled && debouncedLabel.length > 0 },
  });

  const { data: price } = useReadContract({
    address: REGISTRAR_ADDRESS,
    abi: registrarAbi,
    functionName: "priceOf",
    args: [debouncedLabel],
    chainId: robinhoodChain.id,
    query: { enabled: enabled && debouncedLabel.length > 0 },
  });

  const { data: shortsOpen } = useReadContract({
    address: REGISTRAR_ADDRESS,
    abi: registrarAbi,
    functionName: "shortsOpen",
    chainId: robinhoodChain.id,
    query: { enabled },
  });

  const { data: allowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address ?? ZERO_ADDRESS, REGISTRAR_ADDRESS ?? ZERO_ADDRESS],
    chainId: robinhoodChain.id,
    query: {
      enabled: Boolean(USDC_ADDRESS && REGISTRAR_ADDRESS && address) && method === "usdg",
      refetchInterval: 10_000,
    },
  });

  const weiPrice = price?.[0];
  const usdgPrice = price?.[1];

  // Fetch the voucher for *any* short name, not just locked ones. Credits still mint
  // short names free after the goal opens them to public sale, so gating this on
  // `!shortsOpen` would silently charge a donor who already holds a free credit.
  const needsVoucher = short;
  const shortsLocked = short && !shortsOpen;
  useEffect(() => {
    if (!needsVoucher || !address) {
      setVoucher(null);
      setVoucherError(null);
      return;
    }
    let cancelled = false;
    setVoucherLoading(true);
    setVoucherError(null);
    track("voucher_requested");
    fetch(`${VOUCHER_URL}/${address}`)
      .then(async (res) => {
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setVoucher(null);
          setVoucherError(json?.message ?? "No credits found");
          return;
        }
        setVoucher(json);
      })
      .catch(() => {
        if (!cancelled) setVoucherError("Couldn't reach the credit service");
      })
      .finally(() => {
        if (!cancelled) setVoucherLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needsVoucher, address]);

  const creditsLeft = Number(voucher?.creditsAvailable ?? 0);

  const verdict = useMemo(() => {
    if (!query) return null;
    if (!check.ok) return { text: check.reason, cls: "warn" };
    if (!enabled) return { text: "minting opens soon", cls: "warn" };
    if (statusFetching || status === undefined) return { text: "checking…", cls: "warn" };
    switch (status) {
      case MINT_STATUS.AVAILABLE:
        return { text: "available", cls: "ok" };
      case MINT_STATUS.TAKEN:
        return { text: "already taken", cls: "bad" };
      case MINT_STATUS.LOCKED:
        return {
          text: creditsLeft > 0 ? "unlocked by your credit" : "premium — needs a credit",
          cls: creditsLeft > 0 ? "ok" : "warn",
        };
      case MINT_STATUS.BLOCKED:
        return { text: "reserved by the registry", cls: "bad" };
      default:
        return { text: "invalid", cls: "bad" };
    }
  }, [query, check, enabled, status, statusFetching, creditsLeft]);

  // A credit beats paying whenever the name is short and one is available.
  const canMintWithCredit =
    short &&
    creditsLeft > 0 &&
    !!voucher &&
    (status === MINT_STATUS.LOCKED || status === MINT_STATUS.AVAILABLE);
  const canMintPublic = status === MINT_STATUS.AVAILABLE && !canMintWithCredit;
  const canMint = enabled && (canMintPublic || canMintWithCredit);

  async function ensureChain() {
    if (!isConnected) {
      track("connect_opened");
      open();
      return false;
    }
    if (chainId !== robinhoodChain.id) {
      await switchChainAsync({ chainId: robinhoodChain.id });
    }
    return true;
  }

  async function mint() {
    if (!REGISTRAR_ADDRESS || !debouncedLabel) return;
    if (!(await ensureChain())) return;

    const snapshot = debouncedLabel;

    try {
      if (canMintWithCredit && voucher) {
        track("short_mint_started", { tier: String(tier) });
        await writeContractAsync({
          address: REGISTRAR_ADDRESS,
          abi: registrarAbi,
          functionName: "mintShortWithVoucher",
          args: [
            snapshot,
            BigInt(voucher.totalCredits),
            BigInt(voucher.expiry),
            voucher.signature,
          ],
          chainId: robinhoodChain.id,
        });
      } else if (method === "usdg") {
        if (!USDC_ADDRESS || usdgPrice === undefined) return;
        track("mint_started", { tier: String(tier), method: "usdg" });
        if ((allowance ?? 0n) < usdgPrice) {
          await writeContractAsync({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: "approve",
            args: [REGISTRAR_ADDRESS, usdgPrice],
            chainId: robinhoodChain.id,
          });
        }
        await writeContractAsync({
          address: REGISTRAR_ADDRESS,
          abi: registrarAbi,
          functionName: "registerWithUsdc",
          args: [snapshot],
          chainId: robinhoodChain.id,
        });
      } else {
        if (weiPrice === undefined) return;
        track("mint_started", { tier: String(tier), method: "eth" });
        await writeContractAsync({
          address: REGISTRAR_ADDRESS,
          abi: registrarAbi,
          functionName: "register",
          args: [snapshot],
          value: weiPrice,
          chainId: robinhoodChain.id,
        });
      }
      setMinted(snapshot);
    } catch (error) {
      track("mint_failed", { tier: String(tier) });
      throw error;
    }
  }

  const completed = useRef(false);
  useEffect(() => {
    if (receipt.isSuccess && minted && !completed.current) {
      completed.current = true;
      track(canMintWithCredit ? "short_mint_completed" : "mint_completed", {
        tier: String(tier),
      });
    }
  }, [receipt.isSuccess, minted, canMintWithCredit, tier]);

  if (receipt.isSuccess && minted) {
    return (
      <div className="panel p-6 sm:p-8">
        <div className="eyebrow ok">minted</div>
        <h3 className="display mt-3 text-2xl break-all">
          {minted}
          <span className="text-[var(--dim)]">.hoodfi.eth</span>
        </h3>
        <p className="mt-2 text-sm text-[var(--dim)]">
          It&apos;s yours for life — no renewals, no expiry. Add an avatar, an address
          and your links next.
        </p>

        <div className="mt-5 flex flex-col gap-3">
          <ShareOnX
            text={`I just minted ${minted}.hoodfi.eth on Robinhood Chain.\n\nLifetime ENS name, one transaction, no renewals ever. Get yours:`}
            className="btn btn-primary w-full"
            eventLabel="mint_success"
          >
            Share on X
          </ShareOnX>
          <Link href="/manage/" className="btn btn-ghost w-full">
            Set up your name
          </Link>
        </div>

        {txHash && (
          <a
            className="data mt-4 block text-center text-xs text-[var(--faint)] underline"
            href={`${robinhoodChain.blockExplorers.default.url}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            View transaction
          </a>
        )}

        <button
          className="data mt-4 w-full text-xs text-[var(--dim)] hover:text-[var(--paper)]"
          onClick={() => {
            setMinted(null);
            setQuery("");
            completed.current = false;
          }}
          type="button"
        >
          Mint another name
        </button>
      </div>
    );
  }

  return (
    <div className="panel p-6 sm:p-8">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="display text-xl">Find your name</h3>
        {needsVoucher && address && (
          <div className="data text-xs text-[var(--dim)]">
            credits:{" "}
            <span className={creditsLeft > 0 ? "ok" : ""}>
              {voucherLoading ? "…" : creditsLeft}
            </span>
          </div>
        )}
      </div>

      <div className="relative mt-5">
        <input
          className="input pr-28 text-lg"
          placeholder="yourname"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
          autoCapitalize="none"
          autoComplete="off"
          aria-label="Name to mint"
        />
        <span className="data pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--faint)]">
          .hoodfi.eth
        </span>
      </div>
      {verdict && <div className={`data mt-2 text-xs ${verdict.cls}`}>{verdict.text}</div>}

      {debouncedLabel && check.ok && (
        <div className="mt-5">
          <div className="ledger-row">
            <span className="text-sm text-[var(--dim)]">Length</span>
            <span className="data text-sm">
              {debouncedLabel.length} character{debouncedLabel.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="ledger-row">
            <span className="text-sm text-[var(--dim)]">Price</span>
            <span className="data text-sm">
              {canMintWithCredit ? (
                <span className="ok">free — 1 credit</span>
              ) : method === "usdg" ? (
                usdgPrice !== undefined ? (
                  `${(Number(usdgPrice) / 1e6).toFixed(2)} USDG`
                ) : (
                  "…"
                )
              ) : weiPrice !== undefined ? (
                `${formatEth(weiPrice)} ETH`
              ) : (
                `$${TIER_USD[tier]}`
              )}
            </span>
          </div>
          <div className="ledger-row">
            <span className="text-sm text-[var(--dim)]">Renewals</span>
            <span className="data text-sm ok">never — lifetime</span>
          </div>
        </div>
      )}

      {!canMintWithCredit && (
        <div className="mt-5 flex gap-2">
          {(["eth", "usdg"] as PayMethod[]).map((m) => (
            <button
              key={m}
              className={`btn flex-1 ${method === m ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setMethod(m)}
              type="button"
              disabled={m === "usdg" && !USDC_ADDRESS}
            >
              Pay in {m === "eth" ? "ETH" : "USDG"}
            </button>
          ))}
        </div>
      )}

      <button
        className="btn btn-primary mt-5 w-full"
        onClick={mint}
        disabled={!canMint || isPending || receipt.isLoading}
        type="button"
      >
        {!enabled
          ? "Minting opens soon"
          : !isConnected
            ? "Connect to mint"
            : isPending
              ? "Confirm in wallet…"
              : receipt.isLoading
                ? "Minting…"
                : canMintWithCredit
                  ? `Claim ${debouncedLabel}.hoodfi.eth free`
                  : canMintPublic
                    ? `Mint ${debouncedLabel}.hoodfi.eth`
                    : "Mint"}
      </button>

      {/* Short names pre-goal: explain the one path that unlocks them. */}
      {shortsLocked && creditsLeft === 0 && (
        <div className="mt-4 rounded-md border border-[var(--line)] p-4">
          <div className="data text-xs warn">
            {debouncedLabel.length}-character names are premium inventory
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
            {voucherError && address ? `${voucherError} ` : ""}
            Donate one year to hoodfi.eth&apos;s ENS expiry and you can mint any 1–3
            character name free. They open to everyone once the 100-year goal is reached.
          </p>
          <Link href="/#extend" className="btn btn-ghost mt-3 w-full">
            Earn a credit
          </Link>
        </div>
      )}

      {writeError && (
        <div className="data mt-3 break-words text-xs bad">
          {writeError.message.split("\n")[0]}
        </div>
      )}

      <p className="data mt-4 text-[11px] leading-relaxed text-[var(--faint)]">
        Names are lifetime ERC-721s on Robinhood Chain. You control every record — this
        site can&apos;t edit or reclaim your name.
      </p>
    </div>
  );
}
