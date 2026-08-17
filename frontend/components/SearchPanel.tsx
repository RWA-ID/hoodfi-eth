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
import {
  decodeContenthash,
  nameUrl,
  type ContentHash,
} from "@/shared/contenthash";
import { MINT_STATUS, checkLabel, normalizeLabel } from "@/lib/labels";
import { track } from "@/lib/analytics";
import { ArrowNE } from "./ArrowNE";
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
  /** The website the name serves, if its owner set one. */
  content: ContentHash | null;
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

  const [avatar, texts, evmRaw, btcRaw, solRaw, contentRaw] = await Promise.all([
    text("avatar"),
    Promise.all(TEXT_KEYS.map((t) => text(t.key))),
    addr(ROBINHOOD_COIN_TYPE),
    addr(BTC_COIN_TYPE),
    addr(SOL_COIN_TYPE),
    l2Client.readContract({
      address: registry,
      abi: registryAbi,
      functionName: "contenthash",
      args: [node],
    }),
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
    content: decodeContenthash(contentRaw as string),
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
  /** Renders a call-to-action under the value. Only the website row uses it. */
  visit?: string;
};

function RecordsLedger({ records }: { records: Records }) {
  const { copied, copy } = useCopy();

  const site = records.content;

  const rows: LedgerRow[] = [
    // The website first: it's the only record you can *go* to, and burying it under
    // three addresses would hide the one thing a visitor can act on.
    // Clicking it goes to the name, not to the CID's gateway. The value shown is
    // still the record — the CID is what's stored and what an owner checks against
    // their pin — but a visitor who clicks it should land on gm.hoodfi.eth.link and
    // see the name working, which is the entire point of setting the record.
    {
      key: "content",
      label: "Website (IPFS)",
      value: site?.uri ?? "",
      href: site ? nameUrl(records.label) : undefined,
      visit: site ? nameUrl(records.label) : undefined,
    },
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
    <div className="w-full border border-[var(--line-card)]">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3.5 sm:px-5">
        <span className="label">Onchain records</span>
        <button
          type="button"
          className="data border border-[var(--line-card)] px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] transition-colors hover:bg-[var(--paper-alt)]"
          style={{ color: copied === "all" ? "var(--olive)" : "var(--dim)" }}
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
          className="flex flex-col gap-2 border-b border-[var(--line-soft)] px-4 py-4 sm:grid sm:grid-cols-[170px_minmax(0,1fr)_64px] sm:items-start sm:gap-3 sm:px-5"
        >
          <div className="flex items-center gap-2">
            {row.mark && (
              <span
                className="mark-tile h-[26px] w-[26px]"
                style={{ backgroundImage: `url('/marks/${row.mark}.png')` }}
                aria-hidden
              />
            )}
            <span className="label" style={{ letterSpacing: "0.16em" }}>
              {row.label}
            </span>
          </div>

          <div
            className={`min-w-0 break-all text-sm leading-relaxed ${
              row.prose ? "text-[var(--fg)]" : "data"
            }`}
          >
            {row.href ? (
              <a className="link" href={row.href} target="_blank" rel="noreferrer noopener">
                {row.value}
              </a>
            ) : (
              row.value
            )}

            {/* On the row rather than in the button strip at the foot of the ledger.
                Down there it sat eight rows below the record it belongs to, past
                every address and the bio, so the one record a visitor can act on
                read as the least important thing on the page. */}
            {row.visit && (
              // Wrapped in a block so it starts its own line. The button is
              // inline-flex and this cell is `break-all` for the CID, so left inline
              // it flows onto the CID's last wrapped line and sits on top of it.
              <div className="mt-2.5">
                <a
                  className="btn btn-ink btn-sm whitespace-nowrap"
                  href={row.visit}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={() => track("site_visited", { method: site?.protocol ?? "" })}
                >
                  Visit website <ArrowNE />
                </a>
              </div>
            )}
          </div>

          <button
            type="button"
            className="data w-fit justify-self-start border border-[var(--line)] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--faint)] transition-colors hover:bg-[var(--paper-alt)] hover:text-[var(--fg)] sm:justify-self-end"
            onClick={() => copy(row.key, row.value)}
          >
            {copied === row.key ? "Copied" : "Copy"}
          </button>
        </div>
      ))}

      <div className="flex flex-wrap gap-2.5 px-4 py-4 sm:px-5">
        <a
          className="btn btn-ghost btn-sm"
          href={`${robinhoodChain.blockExplorers.default.url}/token/${L2_REGISTRY_ADDRESS}/instance/${records.tokenId}`}
          target="_blank"
          rel="noreferrer noopener"
        >
          View NFT <ArrowNE />
        </a>
        <Link className="btn btn-ghost btn-sm" href="/mint/">
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
    <div className="w-full max-w-[760px] border border-[var(--line-card)] bg-[var(--paper-alt)] px-7 py-10 text-center">
      <div className="label">{blocked ? "Reserved" : locked ? "Premium" : "Unregistered"}</div>
      <div className="mt-3 break-all text-[clamp(26px,4.6vw,44px)] font-extrabold leading-[1.02] tracking-[-0.035em]">
        {label}
        <span className="text-[var(--faint)]">.hoodfi.eth</span>
      </div>
      <p className="mx-auto mt-4 max-w-[44ch] text-[15px] leading-relaxed text-[var(--dim)]">
        {blocked
          ? "This label is reserved as infrastructure and can't be minted by anyone."
          : locked
            ? "Short names unlock for everyone once hoodfi.eth's expiry reaches the 100-year goal — or mint one free right now with a donation credit."
            : "Nobody owns this name yet — it could be yours, for life."}
      </p>
      {!blocked && (
        <Link
          href={locked ? "/short-names/" : `/mint/?q=${encodeURIComponent(label)}`}
          className="btn btn-ink mt-7"
        >
          {locked ? "Earn a credit" : "Mint this name"} <ArrowNE />
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
      <p className="label max-w-[26ch]" style={{ letterSpacing: "0.2em", lineHeight: 1.7 }}>
        One name. Every wallet, every chain.
      </p>
      <div className="flex flex-wrap items-center gap-2.5">
        {STRIP_CHAINS.map((m) => (
          <span
            key={m}
            title={m}
            className="mark-tile h-[38px] w-[38px]"
            style={{ backgroundImage: `url('/marks/${m}.png')` }}
          />
        ))}
        <span className="h-[26px] w-px bg-[var(--line-card)]" />
        {STRIP_WALLETS.map((m) => (
          <span
            key={m}
            title={m}
            className="mark-tile h-[38px] w-[38px]"
            style={{ backgroundImage: `url('/marks/${m}.png')` }}
          />
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
      {/* The search console: the one ink object on this page, so the field you type
          into is the thing the page is obviously *for*. */}
      <div className="on-ink shadow-hero w-full max-w-[760px]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <span className="label">resolver · l2registry</span>
          <span className="data text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--lime)" }}>
            ● connected
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void lookup(query, { scroll: true });
          }}
          className="flex items-center gap-2.5 px-4 py-4"
        >
          <input
            className="min-w-0 flex-1 border-0 bg-transparent py-1 text-[clamp(20px,3.2vw,28px)] font-bold tracking-[-0.02em] text-[var(--fg)] outline-none placeholder:text-[var(--faint)]"
            placeholder="a friend, or yourself"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
            aria-label="HoodFi name to look up"
          />
          <span className="data hidden shrink-0 text-[15px] text-[var(--faint)] sm:block">
            .hoodfi.eth
          </span>
          <button
            className="btn btn-lime shrink-0"
            type="submit"
            disabled={state === "loading" || query.trim() === ""}
          >
            {state === "loading" ? "…" : "Look up"}
          </button>
        </form>
      </div>

      <div className="mt-3.5 flex w-full max-w-[760px] flex-wrap items-center gap-2">
        <span className="label">Try</span>
        {TRY.map((t) => (
          <button
            key={t}
            type="button"
            className="data border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--dim)] transition-colors hover:bg-[var(--paper-alt)] hover:text-[var(--fg)]"
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
        <div
          className="data mt-3 w-full max-w-[760px] text-xs"
          style={{ color: "var(--bad)" }}
        >
          {error}
        </div>
      )}

      <div ref={resultRef} className="scroll-mt-[88px]">
        {state === "loading" && (
          <div className="mt-8 w-full max-w-[760px] border border-[var(--line-card)]">
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
                  className="data text-[12.5px]"
                  style={{ color: i === 2 ? "var(--olive)" : "var(--dim)" }}
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
          <div className="mt-8 grid w-full items-start gap-6 lg:grid-cols-[minmax(330px,480px)_minmax(330px,1fr)]">
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
