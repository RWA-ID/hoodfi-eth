"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { BaseError, ContractFunctionRevertedError } from "viem";
import { robinhoodChain } from "@/lib/chains";
import { PROBE_SIZE, useFitText } from "@/lib/useFitText";

/** The field's design size, held for every name short enough to keep it. */
const INPUT_MAX_SIZE = 24;
/**
 * Low enough that the longest name still shows its own beginning on a phone. 13px left
 * 42px of a 31-character name scrolled out of sight, which is the whole bug: you cannot
 * check what you typed if the field only ever shows the end of it.
 */
const INPUT_MIN_SIZE = 10;
import {
  REGISTRAR_ADDRESS,
  USDC_ADDRESS,
  ZERO_ADDRESS,
  erc20Abi,
  registrarAbi,
} from "@/lib/contracts";
import {
  CREDIT_USD,
  MINT_STATUS,
  TIER_USD,
  checkLabel,
  isShort,
  tierOf,
} from "@/lib/labels";
import { useEthUsd, weiToUsd } from "@/lib/ethUsd";
import { formatEth } from "@/lib/format";
import { VOUCHER_URL, nameShareUrl } from "@/lib/site";
import { track } from "@/lib/analytics";
import { walletErrorMessage } from "@/lib/errors";
import { ArrowNE } from "./ArrowNE";
import { DonatePanel } from "./DonatePanel";
import { ShareOnX } from "./ShareOnX";
import { useMintQuery } from "./MintQuery";

type Voucher = {
  totalCredits: string;
  /** Null when the gateway couldn't read the registrar — treated as zero, so a
   *  credit is never offered on a guess that would revert on submission. */
  creditsAvailable: string | null;
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

export function MintPanel({
  initialQuery = "",
  handoffOnConnect = false,
}: {
  initialQuery?: string;
  /** Home page only: after connecting, carry the typed name over to /mint. */
  handoffOnConnect?: boolean;
}) {
  // Inside a MintQueryProvider the page owns the query so other blocks — the tier
  // grid, the /mint hero line — track this field; everywhere else the card keeps
  // its own state.
  const shared = useMintQuery();
  const [localQuery, setLocalQuery] = useState(initialQuery);
  const query = shared ? shared.query : localQuery;
  const setQuery = shared ? shared.setQuery : setLocalQuery;
  const {
    columnRef: inputColumnRef,
    probeRef: inputProbeRef,
    fontSize: inputFontSize,
  } = useFitText<HTMLInputElement>(query || "yourname", () => INPUT_MAX_SIZE, INPUT_MIN_SIZE, INPUT_MAX_SIZE);
  const [method, setMethod] = useState<PayMethod>("eth");
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  // Snapshot at submit time so the success card can't drift if the field is edited
  // while the transaction confirms.
  const [minted, setMinted] = useState<string | null>(null);
  // Chain-switch and submission failures, which no hook reports for us.
  const [actionError, setActionError] = useState<string | null>(null);

  const { address, isConnected, chainId } = useAccount();
  const { open } = useAppKit();
  const router = useRouter();
  const { switchChainAsync } = useSwitchChain();
  const {
    writeContractAsync,
    data: txHash,
    isPending,
    error: writeError,
  } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: robinhoodChain.id,
  });
  // Reads Robinhood Chain over our own RPC rather than through the wallet. See
  // `preflight` below for why the distinction matters.
  const publicClient = usePublicClient({ chainId: robinhoodChain.id });

  const enabled = Boolean(REGISTRAR_ADDRESS);
  const check = checkLabel(query);
  const label = check.ok ? check.label : "";
  const debouncedLabel = useDebounced(label, 350);
  const short = isShort(debouncedLabel);
  const tier = debouncedLabel ? tierOf(debouncedLabel) : 3;

  // Opened from the locked-short-name state; never shown unprompted.
  const [showDonate, setShowDonate] = useState(false);
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
      enabled:
        Boolean(USDC_ADDRESS && REGISTRAR_ADDRESS && address) &&
        method === "usdg",
      refetchInterval: 10_000,
    },
  });

  const weiPrice = price?.[0];
  const usdgPrice = price?.[1];
  const ethUsd = useEthUsd();

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

  // While the debounce is still catching up, `status` describes the *previous* name.
  // Reading it then flashes that name's whole layout — type "x" after "blake" and the
  // 4+ character price appears for a beat before the locked state replaces it.
  // Treating it as unknown until the read matches what was typed removes the flash.
  const settledStatus =
    label !== debouncedLabel || statusFetching ? undefined : status;

  // A credit beats paying whenever the name is short and one is available.
  const canMintWithCredit =
    short &&
    creditsLeft > 0 &&
    !!voucher &&
    (settledStatus === MINT_STATUS.LOCKED ||
      settledStatus === MINT_STATUS.AVAILABLE);

  // Until the voucher request settles we don't know whether this address holds a credit.
  // After the goal opens shorts to public sale the name reads as AVAILABLE, so without
  // this the paid path would be live during the fetch and a fast click would charge a
  // donor for a name their credit mints free.
  const creditUnknown =
    short && !!address && (voucherLoading || (!voucher && !voucherError));

  const canMintPublic =
    settledStatus === MINT_STATUS.AVAILABLE &&
    !canMintWithCredit &&
    !creditUnknown;

  // A locked short name with no credit can't be bought at any price, so the price
  // block, the ETH/USDG toggle and the mint button are all dead weight — and they
  // push the one thing that *is* actionable, "Earn a credit", off the screen. Taken
  // and reserved names keep the paid block, because that is where "Try another" lives.
  const showCredit =
    shortsLocked &&
    !creditUnknown &&
    creditsLeft === 0 &&
    settledStatus !== MINT_STATUS.TAKEN &&
    settledStatus !== MINT_STATUS.BLOCKED;
  const canMint = enabled && (canMintPublic || canMintWithCredit);

  // The currency toggle is inert until there is a price to pay, but it stays on show
  // and keeps its row: holding the space and drawing nothing in it left a hole in the
  // middle of the empty card, which is the state most visitors meet it in. It goes
  // away only when the answer is a credit, where a choice of currency is a lie.
  const canChooseCurrency =
    !canMintWithCredit &&
    Boolean(debouncedLabel) &&
    check.ok &&
    settledStatus !== undefined;

  /**
   * The status line under the input, in the design's own voice: the name read back
   * with a verdict, never a bare adjective.
   *
   * The verdict leads and the name trails, which is a layout decision as much as a
   * copy one. This line is held to a single row (see the card body), so anything past
   * the end of it is clipped — and the one thing that must never be clipped is the
   * answer. The name is already in the field directly above and, on /mint, at headline
   * scale beside it.
   */
  const verdict = useMemo((): { text: string; color: string } => {
    const LABEL = "var(--label)";
    // Short enough to survive beside the character hint on a phone: this line is one
    // row and truncates, and the empty card is the state most visitors arrive in.
    if (!query) return { text: "type a name to check", color: LABEL };
    if (!check.ok) return { text: check.reason.toLowerCase(), color: "var(--status-bad)" };
    if (!enabled) return { text: "minting opens soon", color: "var(--status-warn)" };
    if (settledStatus === undefined) return { text: "checking…", color: LABEL };
    const name = `${debouncedLabel}.hoodfi.eth`;
    switch (settledStatus) {
      case MINT_STATUS.AVAILABLE:
        return { text: `available · ${name}`, color: "var(--status-ok)" };
      case MINT_STATUS.TAKEN:
        return { text: `taken · ${name}`, color: "var(--status-bad)" };
      case MINT_STATUS.LOCKED:
        return creditsLeft > 0
          ? { text: "unlocked by your credit", color: "var(--status-ok)" }
          : { text: "premium · credit holders only", color: "var(--status-warn)" };
      case MINT_STATUS.BLOCKED:
        return { text: "reserved by the registry", color: "var(--status-bad)" };
      default:
        return { text: "invalid · not a mintable label", color: "var(--status-bad)" };
    }
  }, [query, check, enabled, settledStatus, creditsLeft, debouncedLabel]);

  /**
   * The big figure in the price block: what this name costs, once, for life.
   *
   * This is the USDG price, which the registrar charges to the cent. The ETH leg is a
   * fixed quantity of ETH and drifts against it as ETH moves, so the line underneath
   * carries the real number for anyone paying that way — this one stays put rather
   * than twitching with every round of the price feed.
   */
  const priceLabel = !debouncedLabel
    ? "—"
    : canMintWithCredit
    ? "FREE"
    : `$${TIER_USD[tier]}`;

  /** The same figure in the currency actually leaving the wallet. */
  const chainPrice = !debouncedLabel
    ? null
    : canMintWithCredit
    ? "one short-name credit"
    : creditUnknown
    ? "checking credits…"
    : method === "usdg"
    ? usdgPrice !== undefined
      ? `${(Number(usdgPrice) / 1e6).toFixed(2)} USDG = exactly $${TIER_USD[tier]}`
      : "…"
    : weiPrice !== undefined
    ? ethPriceLine(weiPrice)
    : null;

  /**
   * The ETH leg spelled out. Without a trustworthy rate it shows the ETH amount
   * alone, which is true at any price, rather than a dollar figure we cannot stand
   * behind — a stale number here is the exact failure this line exists to prevent.
   *
   * Kept terse because the line it lands in truncates: at 360px — an ordinary phone —
   * anything longer than roughly this ellipsises away the dollar figure, which is the
   * only part worth showing. Measure at 320px before adding a word.
   */
  function ethPriceLine(wei: bigint): string {
    const usd = weiToUsd(wei, ethUsd);
    return usd ? `${formatEth(wei)} ETH ≈ ${usd}` : `${formatEth(wei)} ETH`;
  }

  const lengthNote = debouncedLabel
    ? `${debouncedLabel.length} character${debouncedLabel.length === 1 ? "" : "s"}`
    : "a–z, 0–9, hyphens";

  const ctaLabel = !enabled
    ? "Minting opens soon"
    : isPending
    ? "Confirm in wallet…"
    : receipt.isLoading
    ? "Minting…"
    : !query
    ? isConnected
      ? "Type a name"
      : "Connect Wallet"
    : !check.ok
    ? "Fix the name"
    : settledStatus === undefined
    ? "Checking…"
    : settledStatus === MINT_STATUS.TAKEN || settledStatus === MINT_STATUS.BLOCKED
    ? "Try another"
    : creditUnknown
    ? "Checking your credits…"
    : canMintWithCredit
    ? `Claim ${debouncedLabel}.hoodfi.eth free`
    : !isConnected
    ? "Connect & mint"
    : canMintPublic
    ? `Mint for $${TIER_USD[tier]}`
    : "Mint";

  // On the home page, connecting is a commitment to mint — so once the wallet is in,
  // carry the typed name to /mint rather than leaving them on the marketing page to
  // find the button again. Cleared if they connect without having asked to mint.
  const awaitingConnect = useRef(false);
  useEffect(() => {
    if (!handoffOnConnect || !awaitingConnect.current || !isConnected) return;
    awaitingConnect.current = false;
    router.push(label ? `/mint/?q=${encodeURIComponent(label)}` : "/mint/");
  }, [handoffOnConnect, isConnected, label, router]);

  async function ensureChain() {
    if (!isConnected) {
      track("connect_opened");
      awaitingConnect.current = true;
      open();
      return false;
    }
    if (chainId !== robinhoodChain.id) {
      await switchChainAsync({ chainId: robinhoodChain.id });
    }
    return true;
  }

  /**
   * Run the mint against our own RPC before handing it to the wallet.
   *
   * Wallets estimate gas on their own node and are free to throw the revert payload
   * away before the page ever sees it. Brave does exactly that: a mint that the
   * registrar refused came back as "reverted with the following reason:" and no
   * reason, because there was no data left to decode. Our RPC returns the full
   * four-byte error, so simulating here means the user is told *why* — and is never
   * asked to sign something that was always going to fail.
   *
   * Returns an error message, or null when the transaction is good to send. A
   * simulation that cannot run at all (RPC down) returns null: refusing to mint
   * because a pre-check was unavailable would be the worse failure.
   */
  async function preflight(call: {
    readonly address: `0x${string}`;
    readonly abi: typeof registrarAbi;
    readonly functionName: "register" | "registerWithUsdc" | "mintShortWithVoucher";
    readonly args: readonly unknown[];
    readonly value?: bigint;
    readonly chainId: number;
  }): Promise<string | null> {
    if (!publicClient || !address) return null;
    try {
      // simulateContract and writeContract disagree only over fields neither of
      // these calls sets, and this is the exact object wagmi is about to send.
      await publicClient.simulateContract({ ...call, account: address } as Parameters<
        typeof publicClient.simulateContract
      >[0]);
      return null;
    } catch (error) {
      if (error instanceof BaseError && error.walk((e) => e instanceof ContractFunctionRevertedError)) {
        return walletErrorMessage(error);
      }
      return null;
    }
  }

  async function mint() {
    // Connecting is the first half of minting, so the button does it even with an
    // empty field — that is the state most visitors meet the card in, and a control
    // labelled "Connect Wallet" that does nothing is worse than no control.
    if (!isConnected) {
      track("connect_opened");
      awaitingConnect.current = true;
      open();
      return;
    }
    if (!REGISTRAR_ADDRESS || !debouncedLabel) return;
    setActionError(null);

    const snapshot = debouncedLabel;

    try {
      // Inside the try: declining the network prompt rejects here, and used to
      // escape as an unhandled rejection with nothing shown to the user.
      if (!(await ensureChain())) return;

      if (canMintWithCredit && voucher) {
        track("short_mint_started", { tier: String(tier) });
        const call = {
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
        } as const;
        const refused = await preflight(call);
        if (refused) {
          track("mint_failed", { tier: String(tier) });
          setActionError(refused);
          return;
        }
        await writeContractAsync(call);
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
        const call = {
          address: REGISTRAR_ADDRESS,
          abi: registrarAbi,
          functionName: "registerWithUsdc",
          args: [snapshot],
          chainId: robinhoodChain.id,
        } as const;
        // Only worth simulating once the approval is in place — before that the
        // registrar has no allowance and every simulation would fail on that.
        if ((allowance ?? 0n) >= usdgPrice) {
          const refused = await preflight(call);
          if (refused) {
            track("mint_failed", { tier: String(tier) });
            setActionError(refused);
            return;
          }
        }
        await writeContractAsync(call);
      } else {
        if (weiPrice === undefined) return;
        track("mint_started", { tier: String(tier), method: "eth" });
        const call = {
          address: REGISTRAR_ADDRESS,
          abi: registrarAbi,
          functionName: "register",
          args: [snapshot],
          value: weiPrice,
          chainId: robinhoodChain.id,
        } as const;
        const refused = await preflight(call);
        if (refused) {
          track("mint_failed", { tier: String(tier) });
          setActionError(refused);
          return;
        }
        await writeContractAsync(call);
      }
      setMinted(snapshot);
    } catch (error) {
      track("mint_failed", { tier: String(tier) });
      setActionError(walletErrorMessage(error));
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
      <div className="on-ink shadow-hero p-7">
        <div className="label" style={{ color: "var(--lime)" }}>
          minted
        </div>
        <h3 className="mt-4 break-words text-[clamp(28px,4vw,40px)] font-extrabold leading-[1.02] tracking-[-0.035em] text-[var(--fg)]">
          {minted}
          <span className="text-[var(--faint)]">.hoodfi.eth</span>
        </h3>
        <p className="mt-3 max-w-[38ch] text-sm leading-relaxed text-[var(--dim)]">
          It&apos;s yours for life — no renewals, no expiry. Add an avatar, an address
          and your links next.
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <ShareOnX
            text={`I just minted ${minted}.hoodfi.eth on Robinhood Chain.\n\nLifetime ENS name, one transaction, no renewals ever. Get yours:`}
            url={nameShareUrl(minted)}
            className="btn btn-lime btn-lg w-full"
            eventLabel="mint_success"
          >
            Share on X
          </ShareOnX>
          <Link href="/manage/" className="btn btn-ghost btn-lg w-full">
            Set up your name
          </Link>
        </div>

        {txHash && (
          <a
            className="data link mt-5 block text-center text-[11px] text-[var(--faint)]"
            href={`${robinhoodChain.blockExplorers.default.url}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            View transaction
          </a>
        )}

        <button
          className="data mt-4 w-full text-[11px] uppercase tracking-[0.14em] text-[var(--label)] transition-colors hover:text-[var(--fg)]"
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

  /**
   * The card is the tallest thing in the lime band, so the card's height *is* the
   * section's height: every row that comes and goes as you type drags the whole page
   * with it. Everything below the input therefore holds its space — the status line is
   * one row at any name length, the chain price and the currency toggle are always in
   * the layout, and the two offers this card can make (pay, or earn a credit) share
   * one grid cell so the taller of them sets the height for both.
   *
   * That is also why nothing here scrolls the page on focus any more: the card used to
   * grow under the keyboard on a phone, and the reveal that compensated for it fought
   * Safari's own scroll-into-view. With the height fixed there is nothing to reveal.
   */
  return (
    <div className="on-ink shadow-hero scroll-mt-24 p-7">
      <div className="flex items-center justify-between gap-4">
        <span className="label">Check a name</span>
        <span className="flex items-center gap-4">
          {needsVoucher && address && (
            <span className="data text-[11px] uppercase tracking-[0.14em] text-[var(--label)]">
              credits{" "}
              <span style={{ color: creditsLeft > 0 ? "var(--lime)" : undefined }}>
                {voucherLoading ? "…" : creditsLeft}
              </span>
            </span>
          )}
          <span className="data text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--lime)" }}>
            ● live
          </span>
        </span>
      </div>

      <div className="mt-[18px] flex h-[60px] items-center gap-1.5 border border-[rgba(241,241,234,0.28)] px-3.5 focus-within:border-[var(--lime)]">
        {/* An input scrolls its own text rather than shrinking it, so on a phone a long
            name pushed its own beginning out of sight — you could only ever see the end
            of what you had typed. Fitting it keeps the whole name visible. */}
        <span
          ref={inputProbeRef}
          aria-hidden
          className="pointer-events-none absolute -left-[9999px] top-0 whitespace-nowrap font-bold tracking-[-0.02em]"
          style={{ fontSize: PROBE_SIZE }}
        >
          {query || "yourname"}
        </span>
        <input
          ref={inputColumnRef}
          className="min-w-0 flex-1 border-0 bg-transparent font-bold tracking-[-0.02em] text-[var(--fg)] outline-none placeholder:text-[var(--faint)]"
          style={{ fontSize: inputFontSize }}
          placeholder="yourname"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
          autoCapitalize="none"
          autoComplete="off"
          aria-label="Name to mint"
        />
        <span className="data shrink-0 text-[15px] text-[var(--faint)]">.hoodfi.eth</span>
      </div>

      {/* One row, at every width and every name length. Left to wrap, this line went
          from one line to three as the name grew — 44px of the lime section appearing
          and disappearing under the cursor, mid-word. It truncates instead, and the
          verdict is written to put the answer first so the ellipsis only ever eats the
          echo of a name that is already in the field above. */}
      <div className="mt-3.5 flex items-baseline justify-between gap-4">
        <span
          className="data min-w-0 flex-1 truncate text-[12.5px] tracking-[0.06em]"
          style={{ color: verdict.color }}
        >
          {verdict.text}
        </span>
        <span className="data shrink-0 text-[12.5px] text-[var(--label)]">{lengthNote}</span>
      </div>

      {/* Both offers in one grid cell. Crossing four characters swaps which one is
          live, and before this that swap moved the section by ~90px in the middle of a
          word. Hidden with `visibility`, so the inert branch keeps its space and stays
          out of both the tab order and the accessibility tree. */}
      <div className="mt-5 grid">
        <div
          className={`col-start-1 row-start-1 flex flex-col ${showCredit ? "invisible" : ""}`}
          aria-hidden={showCredit}
        >
          <div className="flex items-end justify-between gap-4 border-t border-[rgba(241,241,234,0.18)] pt-[18px]">
            <div className="min-w-0">
              <div className="label">Price</div>
              <div className="mt-1.5 text-[38px] font-extrabold leading-none tracking-[-0.03em] text-[var(--fg)]">
                {priceLabel}
              </div>
              {/* Held open even with nothing to say: this line arrives the moment a
                  name resolves, and letting it in and out resized the card on the
                  first keystroke of every search. */}
              <div className="data mt-2 truncate text-[11.5px] text-[var(--label)]">
                {chainPrice ?? "\u00A0"}
              </div>
            </div>
            <div className="data shrink-0 text-right text-[11.5px] leading-[1.5] text-[var(--label)]">
              one time
              <br />
              for life
            </div>
          </div>

          {/* The currency choice. Inert until there is a price, but never hidden while
              there is one to make — the design's own rule is that a disabled control
              goes inert, not faint. */}
          <div
            className={`mt-5 flex ${canMintWithCredit ? "invisible" : ""}`}
            aria-hidden={canMintWithCredit}
          >
            {(["eth", "usdg"] as PayMethod[]).map((m) => (
              <button
                key={m}
                className={`data flex-1 border py-2.5 text-[11px] uppercase tracking-[0.16em] transition-colors ${
                  method === m
                    ? "border-[var(--lime)] bg-[var(--lime)] text-[var(--ink)]"
                    : "border-[rgba(241,241,234,0.28)] text-[var(--label)] enabled:hover:text-[var(--fg)]"
                } ${m === "eth" ? "border-r-0" : ""}`}
                onClick={() => setMethod(m)}
                type="button"
                disabled={(m === "usdg" && !USDC_ADDRESS) || !canChooseCurrency}
              >
                Pay in {m === "eth" ? "ETH" : "USDG"}
              </button>
            ))}
          </div>

          <button
            className="btn btn-lime btn-lg mt-5 w-full"
            onClick={mint}
            disabled={
              !enabled || isPending || receipt.isLoading || (isConnected && !canMint)
            }
            type="button"
          >
            {ctaLabel} <ArrowNE />
          </button>
        </div>

        {/* Short names pre-goal: explain the one path that unlocks them.

            Deliberately terse. Long version on /short-names/. */}
        <div
          className={`col-start-1 row-start-1 flex flex-col ${showCredit ? "" : "invisible"}`}
          aria-hidden={!showCredit}
        >
          <div className="flex flex-1 flex-col border border-[var(--line)] p-4">
            <div className="data text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--status-warn)" }}>
              {debouncedLabel.length || 3}-character names are premium
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--dim)]">
              {voucherError && address ? `${voucherError} ` : ""}
              Donate a year to hoodfi.eth — about ${CREDIT_USD} in ETH plus gas — and
              mint any 1–3 character name free.
            </p>
            {/* The donate flow, opened in place. Sending someone away mid-mint to find
                the one thing that unlocks the name they just typed is the wrong shape,
                and it stays collapsed so it costs nothing until it is the answer. */}
            {showDonate ? (
              <div className="mt-4">
                <DonatePanel embedded />
              </div>
            ) : (
              <div className="mt-4 flex flex-1 items-end">
                <button
                  type="button"
                  className="btn btn-lime w-full"
                  onClick={() => setShowDonate(true)}
                >
                  Earn a credit <ArrowNE />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {(actionError || writeError) && (
        <div
          className="data mt-4 break-words text-[12px] leading-relaxed"
          style={{ color: "var(--status-bad)" }}
        >
          {actionError ?? walletErrorMessage(writeError)}
        </div>
      )}

      <div className="label mt-3.5 flex items-center gap-2">
        <span className="chip-square" aria-hidden />
        Robinhood Chain
      </div>
    </div>
  );
}
