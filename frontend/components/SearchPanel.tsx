"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAddress, namehash, type Address } from "viem";
import { robinhoodChain } from "@/lib/chains";
import {
  L2_REGISTRY_ADDRESS,
  REGISTRAR_ADDRESS,
  registrarAbi,
  registryAbi,
  ZERO_ADDRESS,
} from "@/lib/contracts";
import { l2Client } from "@/lib/wagmi";
import {
  BTC_COIN_TYPE,
  ROBINHOOD_COIN_TYPE,
  SOL_COIN_TYPE,
  decodeChainAddress,
} from "@/lib/ens";
import { MINT_STATUS, checkLabel, normalizeLabel } from "@/lib/labels";
import { track } from "@/lib/analytics";
import { ProfileCard, useCopy, type CardName } from "./ProfileCard";
import { readMintDate, resolveOnL1, type L1State } from "@/lib/resolution";

/** Names offered as one-tap examples. `vitalik` is unregistered on purpose — it's the
 *  only way to reach the available state without typing something made up. */
const TRY = ["gm", "test1000", "degen", "vitalik"];

/** Text records worth surfacing, in the order a profile reads best. */
const TEXT_KEYS = [
  { key: "description", label: "Bio" },
  { key: "com.twitter", label: "X (Twitter)" },
  { key: "url", label: "Website" },
  { key: "email", label: "Email" },
  { key: "location", label: "Location" },
] as const;

type Records = {
  label: string;
  node: `0x${string}`;
  tokenId: bigint;
  owner: Address;
  evm: string;
  btc: string;
  sol: string;
  texts: { key: string; label: string; value: string }[];
  avatar: string;
};

/**
 * An unregistered name isn't automatically mintable. Short names are locked until the
 * donation goal, and infra labels like `www` and `robinhood` are blocked outright —
 * both read as "nobody owns this" from the registry alone, so the registrar has to be
 * asked before offering a mint that would revert.
 */
type Lookup =
  | { kind: "registered"; records: Records }
  | { kind: "unregistered"; status: number };

/** Why a name that nobody owns still can't be minted right now. */
async function readMintStatus(label: string): Promise<number> {
  if (!REGISTRAR_ADDRESS) return MINT_STATUS.AVAILABLE;
  try {
    return await l2Client.readContract({
      address: REGISTRAR_ADDRESS,
      abi: registrarAbi,
      functionName: "status",
      args: [label],
    });
  } catch {
    // Fall back to the optimistic reading; the mint page re-checks before submitting.
    return MINT_STATUS.AVAILABLE;
  }
}

/**
 * Everything stored against a name, read straight from the L2Registry.
 *
 * Deliberately not routed through mainnet: the registry is the source of truth, and
 * reading it directly means this page keeps working — and keeps telling the truth —
 * even when the CCIP gateway in front of it doesn't.
 */
async function readRecords(label: string): Promise<Lookup> {
  // Captured into a local so the narrowing survives into the closures below — a
  // narrowed *imported* binding widens again inside a callback.
  const registry = L2_REGISTRY_ADDRESS;
  if (!registry) throw new Error("Registry address is not configured");

  const node = namehash(`${label}.hoodfi.eth`) as `0x${string}`;
  const tokenId = BigInt(node);

  // ownerOf reverts for a name nobody has minted — that is the "not registered" signal.
  let owner: Address;
  try {
    owner = await l2Client.readContract({
      address: registry,
      abi: registryAbi,
      functionName: "ownerOf",
      args: [tokenId],
    });
  } catch {
    return { kind: "unregistered", status: await readMintStatus(label) };
  }
  if (!owner || owner === ZERO_ADDRESS) {
    return { kind: "unregistered", status: await readMintStatus(label) };
  }

  const text = (key: string) =>
    l2Client.readContract({
      address: registry,
      abi: registryAbi,
      functionName: "text",
      args: [node, key],
    });
  const addr = (coinType: bigint) =>
    l2Client.readContract({
      address: registry,
      abi: registryAbi,
      functionName: "addr",
      args: [node, coinType],
    });

  const [avatar, texts, evmRaw, btcRaw, solRaw] = await Promise.all([
    text("avatar"),
    Promise.all(TEXT_KEYS.map((t) => text(t.key))),
    addr(ROBINHOOD_COIN_TYPE),
    addr(BTC_COIN_TYPE),
    addr(SOL_COIN_TYPE),
  ]);

  const records: Records = {
    label,
    node,
    tokenId,
    owner: getAddress(owner),
    evm: evmRaw && evmRaw !== "0x" ? getAddress(evmRaw as Address) : "",
    btc: decodeChainAddress(BTC_COIN_TYPE, btcRaw as string),
    sol: decodeChainAddress(SOL_COIN_TYPE, solRaw as string),
    avatar: avatar ?? "",
    texts: TEXT_KEYS.map((t, i) => ({
      key: t.key,
      label: t.label,
      value: texts[i] ?? "",
    })).filter((t) => t.value !== ""),
  };
  return { kind: "registered", records };
}

/** The card wants a flat profile; the ledger wants every record. Narrow, don't widen. */
function toCardName(records: Records): CardName {
  return {
    label: records.label,
    node: records.node,
    avatar: records.avatar,
    description: records.texts.find((t) => t.key === "description")?.value ?? "",
  };
}

type LedgerRow = {
  key: string;
  label: string;
  value: string;
  mark?: string;
  href?: string;
  prose?: boolean;
};

function RecordsLedger({ records }: { records: Records }) {
  const { copied, copy } = useCopy();

  const rows: LedgerRow[] = [
    { key: "evm", label: "Ethereum & EVM", value: records.evm, mark: "ethereum" },
    { key: "btc", label: "Bitcoin", value: records.btc, mark: "bitcoin" },
    { key: "sol", label: "Solana", value: records.sol, mark: "solana" },
    ...records.texts.map((t) => ({
      key: t.key,
      label: t.label,
      value: t.value,
      prose: t.key === "description",
      href:
        t.key === "url"
          ? t.value
          : t.key === "com.twitter"
            ? `https://x.com/${t.value}`
            : undefined,
    })),
    { key: "owner", label: "Owner", value: records.owner },
  ].filter((r) => r.value !== "");

  return (
    <div className="w-full rounded-xl border border-[var(--line)] bg-[color-mix(in_srgb,var(--panel)_85%,transparent)]">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3.5 sm:px-5">
        <span className="data text-[11px] uppercase tracking-[0.2em] text-[var(--dim)]">
          Onchain records
        </span>
        <button
          type="button"
          className="data rounded border border-[color-mix(in_srgb,var(--green)_35%,transparent)] px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-[color-mix(in_srgb,var(--green)_90%,transparent)] transition hover:bg-[color-mix(in_srgb,var(--green)_12%,transparent)]"
          onClick={() =>
            copy("all", rows.map((r) => `${r.label.toUpperCase()}: ${r.value}`).join("\n"))
          }
        >
          {copied === "all" ? "Copied ✓" : "Copy all"}
        </button>
      </div>

      {rows.map((row) => (
        <div
          key={row.key}
          className="flex flex-col gap-2 border-b border-[color-mix(in_srgb,var(--line)_70%,transparent)] px-4 py-4 sm:grid sm:grid-cols-[170px_minmax(0,1fr)_64px] sm:items-start sm:gap-3 sm:px-5"
        >
          <div className="flex items-center gap-2">
            {row.mark && (
              // eslint-disable-next-line @next/next/no-img-element -- static export
              <img
                src={`/marks/${row.mark}.png`}
                alt=""
                className="h-[22px] w-[22px] shrink-0 rounded-md object-contain"
              />
            )}
            <span className="data text-[10.5px] uppercase leading-[1.35] tracking-[0.16em] text-[var(--dim)]">
              {row.label}
            </span>
          </div>

          <div
            className={`min-w-0 break-all text-sm leading-relaxed ${
              row.prose ? "text-[color-mix(in_srgb,var(--paper)_85%,transparent)]" : "data"
            }`}
          >
            {row.href ? (
              <a
                className="border-b border-[color-mix(in_srgb,var(--green)_35%,transparent)] text-[var(--green)]"
                href={row.href}
                target="_blank"
                rel="noreferrer noopener"
              >
                {row.value}
              </a>
            ) : (
              row.value
            )}
          </div>

          <button
            type="button"
            className="data w-fit justify-self-start rounded border border-[var(--line-strong)] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--faint)] transition hover:border-[color-mix(in_srgb,var(--green)_50%,transparent)] hover:text-[var(--green)] sm:justify-self-end"
            onClick={() => copy(row.key, row.value)}
          >
            {copied === row.key ? "Copied" : "Copy"}
          </button>
        </div>
      ))}

      <div className="flex flex-wrap gap-2.5 px-4 py-4 sm:px-5">
        <a
          className="btn btn-ghost"
          href={`${robinhoodChain.blockExplorers.default.url}/token/${L2_REGISTRY_ADDRESS}/instance/${records.tokenId}`}
          target="_blank"
          rel="noreferrer noopener"
        >
          View NFT
        </a>
        <Link className="btn btn-ghost" href="/mint/">
          Mint your own
        </Link>
      </div>
    </div>
  );
}

/** Registry says nobody owns it — but the registrar decides whether it can be had. */
function UnregisteredState({ label, status }: { label: string; status: number }) {
  const blocked = status === MINT_STATUS.BLOCKED;
  const locked = status === MINT_STATUS.LOCKED;

  return (
    <div className="hf-rise mx-auto w-full max-w-[760px] rounded-[10px] border border-dashed border-[color-mix(in_srgb,var(--green)_40%,transparent)] bg-[color-mix(in_srgb,var(--green)_5%,transparent)] px-7 py-10 text-center">
      <div className="data text-[11px] uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--green)_80%,transparent)]">
        {blocked ? "Reserved" : locked ? "Premium" : "Unregistered"}
      </div>
      <div className="data mt-3 break-all text-[clamp(22px,3.6vw,32px)] font-semibold">
        {label}
        <span className="text-[var(--faint)]">.hoodfi.eth</span>
      </div>
      <p className="mx-auto mt-3 max-w-[40ch] text-[15px] text-[var(--dim)]">
        {blocked
          ? "This label is reserved as infrastructure and can't be minted by anyone."
          : locked
            ? "Short names unlock for everyone once hoodfi.eth's expiry reaches the 100-year goal — or mint one free right now with a donation credit."
            : "Nobody owns this name yet — it could be yours, for life."}
      </p>
      {!blocked && (
        <Link
          href={locked ? "/#extend" : `/mint/?q=${encodeURIComponent(label)}`}
          className="btn btn-primary mt-6"
        >
          {locked ? "Earn a credit" : "Mint this name"}
        </Link>
      )}
    </div>
  );
}

const STRIP_CHAINS = ["ethereum", "base", "arbitrum", "optimism", "polygon", "bitcoin"];
const STRIP_WALLETS = ["metamask", "rainbow", "phantom", "trust", "uniswap"];

function ChainWalletStrip() {
  return (
    <div className="mt-16 flex flex-col gap-6 border-t border-[var(--line)] pt-7 sm:flex-row sm:items-center sm:justify-between">
      <p className="data max-w-[26ch] text-[11px] uppercase leading-[1.7] tracking-[0.2em] text-[var(--faint)]">
        One name. Every wallet, every chain.
      </p>
      <div className="flex flex-wrap items-center gap-3.5">
        {STRIP_CHAINS.map((m) => (
          // eslint-disable-next-line @next/next/no-img-element -- static export
          <img key={m} src={`/marks/${m}.png`} alt={m} title={m} className="h-[38px] w-[38px] rounded-[10px] object-contain opacity-85 transition hover:opacity-100" />
        ))}
        <span className="h-[26px] w-px bg-[var(--line-strong)]" />
        {STRIP_WALLETS.map((m) => (
          // eslint-disable-next-line @next/next/no-img-element -- static export
          <img key={m} src={`/marks/${m}.png`} alt={m} title={m} className="h-[38px] w-[38px] rounded-[10px] object-contain opacity-85 transition hover:opacity-100" />
        ))}
      </div>
    </div>
  );
}

export function SearchPanel() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [result, setResult] = useState<Lookup | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [l1, setL1] = useState<L1State>({ status: "idle" });
  const [mintedOn, setMintedOn] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  /** Runs after the card paints — the profile shouldn't wait on a CCIP round trip. */
  const checkL1 = useCallback(async (label: string, expected: string) => {
    setL1({ status: "checking" });
    setL1(await resolveOnL1(label, expected));
  }, []);

  const lookup = useCallback(
    async (raw: string, opts: { scroll: boolean }) => {
      const check = checkLabel(raw);
      if (!check.ok) {
        setError(check.reason);
        setState("error");
        setResult(null);
        return;
      }

      setState("loading");
      setError(null);
      setResult(null);
      setL1({ status: "idle" });
      setMintedOn(null);
      setSubmitted(check.label);
      track("name_searched", { method: String(check.label.length) });

      try {
        const found = await readRecords(check.label);
        setResult(found);
        setState("done");
        if (found.kind === "registered") {
          void checkL1(check.label, found.records.evm);
          void readMintDate(found.records.tokenId).then(setMintedOn);
        }
        // Only for a search the user just made — scrolling on the ?q= hydration
        // would yank the page out from under someone arriving from a shared link.
        if (opts.scroll) {
          requestAnimationFrame(() => {
            const el = resultRef.current;
            if (!el) return;
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            window.scrollTo({
              top: el.getBoundingClientRect().top + window.scrollY - 88,
              behavior: reduce ? "auto" : "smooth",
            });
          });
        }
      } catch {
        setError("Couldn't reach Robinhood Chain. Check your connection and retry.");
        setState("error");
      }
    },
    [checkL1]
  );

  // A shared /search/?q=gm link resolves on arrival. Read after mount, never during
  // render: the page is prerendered to static HTML and touching location during
  // render would desync hydration.
  useEffect(() => {
    const seed = normalizeLabel(
      new URLSearchParams(window.location.search).get("q") ?? ""
    );
    if (!seed) return;
    setQuery(seed);
    void lookup(seed, { scroll: false });
  }, [lookup]);

  const records = result?.kind === "registered" ? result.records : null;

  return (
    <div className="flex flex-col">
      {/* Search console */}
      <div className="mx-auto w-full max-w-[760px] overflow-hidden rounded-[10px] border border-[color-mix(in_srgb,var(--line-strong)_80%,transparent)] bg-gradient-to-b from-[var(--panel-2)] to-[var(--panel)] shadow-[0_28px_70px_-30px_color-mix(in_srgb,var(--green)_35%,transparent)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--ink)_60%,transparent)] px-3.5 py-2.5">
          <span className="data text-[11px] uppercase tracking-[0.14em] text-[var(--faint)]">
            resolver · l2registry
          </span>
          <span className="data flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[color-mix(in_srgb,var(--green)_85%,transparent)]">
            <span className="live-dot" />
            connected
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void lookup(query, { scroll: true });
          }}
          className="flex items-center gap-2.5 px-4 py-3.5"
        >
          <span className="data shrink-0 text-xl text-[color-mix(in_srgb,var(--green)_85%,transparent)]">
            &gt;
          </span>
          <input
            className="data min-w-0 flex-1 border-0 bg-transparent py-1.5 text-[clamp(20px,3.2vw,30px)] font-medium tracking-[-0.01em] text-[var(--paper)] outline-none placeholder:text-[var(--faint)]"
            placeholder="a friend, or yourself"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
            aria-label="HoodFi name to look up"
          />
          <span className="data hidden shrink-0 text-[clamp(15px,2.2vw,22px)] text-[color-mix(in_srgb,var(--paper)_30%,transparent)] sm:block">
            .hoodfi.eth
          </span>
          <button
            className="btn btn-primary shrink-0"
            type="submit"
            disabled={state === "loading" || query.trim() === ""}
          >
            {state === "loading" ? "…" : "Look up"}
          </button>
        </form>
      </div>

      <div className="mx-auto mt-3.5 flex w-full max-w-[760px] flex-wrap items-center gap-2">
        <span className="data text-[11px] uppercase tracking-[0.18em] text-[var(--faint)]">
          Try
        </span>
        {TRY.map((t) => (
          <button
            key={t}
            type="button"
            className="data rounded-full border border-[var(--line)] bg-[color-mix(in_srgb,var(--panel-2)_80%,transparent)] px-3 py-1.5 text-xs text-[var(--dim)] transition hover:border-[color-mix(in_srgb,var(--green)_55%,transparent)] hover:bg-[color-mix(in_srgb,var(--green)_10%,transparent)] hover:text-[var(--paper)]"
            onClick={() => {
              setQuery(t);
              void lookup(t, { scroll: true });
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="data mx-auto mt-3 w-full max-w-[760px] text-xs text-[var(--red)]">
          {error}
        </div>
      )}

      <div ref={resultRef} className="scroll-mt-[88px]">
        {state === "loading" && (
          <div className="mx-auto mt-8 w-full max-w-[760px] overflow-hidden rounded-[10px] border border-[var(--line)] bg-[color-mix(in_srgb,var(--panel)_80%,transparent)]">
            <div className="hf-track">
              <span />
            </div>
            <div className="flex flex-col gap-1.5 px-6 py-5">
              {[
                `› namehash(${submitted})`,
                "› ownerOf(tokenId) → reading L2 registry…",
                "› resolving records",
              ].map((line, i) => (
                <div
                  key={line}
                  className={`data text-[12.5px] ${i === 2 ? "text-[color-mix(in_srgb,var(--green)_80%,transparent)]" : "text-[var(--dim)]"}`}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}

        {result?.kind === "unregistered" && (
          <div className="mt-8">
            <UnregisteredState label={submitted} status={result.status} />
          </div>
        )}

        {records && (
          <div className="hf-rise mx-auto mt-8 grid w-full max-w-[1100px] items-start justify-items-center gap-6 lg:grid-cols-[minmax(330px,480px)_minmax(330px,1fr)]">
            <ProfileCard
              name={toCardName(records)}
              l1={l1}
              mintedOn={mintedOn}
            />
            <RecordsLedger records={records} />
          </div>
        )}
      </div>

      <ChainWalletStrip />
    </div>
  );
}
