"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getAddress, namehash, type Address } from "viem";
import { robinhoodChain } from "@/lib/chains";
import {
  L2_REGISTRY_ADDRESS,
  REGISTRAR_ADDRESS,
  registrarAbi,
  registryAbi,
  ZERO_ADDRESS,
} from "@/lib/contracts";
import { l2Client, publicClient } from "@/lib/wagmi";
import {
  BTC_COIN_TYPE,
  ROBINHOOD_COIN_TYPE,
  SOL_COIN_TYPE,
  decodeChainAddress,
} from "@/lib/ens";
import { MINT_STATUS, checkLabel, normalizeLabel } from "@/lib/labels";
import { BitcoinLogo, EthereumLogo, SolanaLogo } from "./ChainLogo";
import { track } from "@/lib/analytics";
import { ShareOnX } from "./ShareOnX";
import { NameAvatar } from "./NameAvatar";
import { nameShareUrl } from "@/lib/site";

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

type L1State =
  | { status: "idle" | "checking" }
  | { status: "ok"; addr: Address }
  | { status: "mismatch"; addr: Address }
  | { status: "empty" }
  | { status: "error"; message: string };

/**
 * Everything stored against a name, read straight from the L2Registry.
 *
 * Deliberately not routed through mainnet: the registry is the source of truth, and
 * reading it directly means this page keeps working — and keeps telling the truth —
 * even when the CCIP gateway in front of it doesn't.
 */
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

async function readRecords(label: string): Promise<Lookup> {
  // Captured into a local so the narrowing survives into the closures below — a
  // narrowed *imported* binding widens again inside a callback.
  const registry = L2_REGISTRY_ADDRESS;
  if (!registry) throw new Error("Registry address is not configured");

  const name = `${label}.hoodfi.eth`;
  const node = namehash(name) as `0x${string}`;
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

  const evm = evmRaw && evmRaw !== "0x" ? getAddress(evmRaw as Address) : "";

  const records: Records = {
    label,
    node,
    tokenId,
    owner: getAddress(owner),
    evm,
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

function Row({
  label,
  value,
  href,
  mono = true,
  Logo,
}: {
  label: string;
  value: string;
  href?: string;
  mono?: boolean;
  Logo?: (props: { className?: string }) => React.ReactElement;
}) {
  return (
    <div className="flex flex-col gap-1 border-t border-[var(--line)] py-3 sm:flex-row sm:items-baseline sm:gap-4">
      <div className="eyebrow flex shrink-0 items-center gap-2 sm:w-56">
        {Logo && <Logo className="h-4 w-4 shrink-0" />}
        {label}
      </div>
      <div className={`min-w-0 break-all text-sm ${mono ? "data" : ""}`}>
        {href ? (
          <a
            className="underline hover:text-[var(--green)]"
            href={href}
            target="_blank"
            rel="noreferrer noopener"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

/**
 * Whether the name also resolves through Ethereum mainnet.
 *
 * This is the one thing the L2 read cannot tell you. A name can be perfectly stored
 * on Robinhood Chain and still be invisible to every wallet if the CCIP gateway in
 * front of it is failing — which is exactly what happened, silently, because a broken
 * gateway returns a signed empty answer that looks identical to "no records set".
 */
function L1Badge({ state }: { state: L1State }) {
  const map: Record<string, { cls: string; text: string }> = {
    checking: { cls: "text-[var(--faint)]", text: "Checking Ethereum…" },
    idle: { cls: "text-[var(--faint)]", text: "" },
    ok: { cls: "ok", text: "✓ Resolving on Ethereum" },
    mismatch: { cls: "warn", text: "⚠ Ethereum returns a different address" },
    empty: { cls: "bad", text: "✗ Not resolving on Ethereum" },
    error: { cls: "bad", text: "✗ Ethereum check failed" },
  };
  const view = map[state.status];
  if (!view.text) return null;

  return (
    <div className="mt-2">
      <span className={`data text-xs ${view.cls}`}>{view.text}</span>
      {state.status === "empty" && (
        <p className="mt-1 max-w-[52ch] text-xs text-[var(--faint)]">
          The records above are stored correctly on Robinhood Chain, but mainnet
          lookups are returning nothing — wallets won&apos;t see this name until that
          clears.
        </p>
      )}
      {state.status === "mismatch" && (
        <p className="data mt-1 text-xs text-[var(--faint)]">
          Ethereum says {state.addr}
        </p>
      )}
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

  /** Runs after the records render — the profile shouldn't wait on a CCIP round trip. */
  const checkL1 = useCallback(async (label: string, expected: string) => {
    setL1({ status: "checking" });
    try {
      const resolved = await publicClient.getEnsAddress({
        name: `${label}.hoodfi.eth`,
      });
      if (!resolved) return setL1({ status: "empty" });
      if (expected && getAddress(resolved) !== getAddress(expected as Address)) {
        return setL1({ status: "mismatch", addr: getAddress(resolved) });
      }
      setL1({ status: "ok", addr: getAddress(resolved) });
    } catch (e) {
      setL1({ status: "error", message: String(e) });
    }
  }, []);

  const lookup = useCallback(
    async (raw: string) => {
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
      setSubmitted(check.label);
      track("name_searched", { method: String(check.label.length) });

      try {
        const found = await readRecords(check.label);
        setResult(found);
        setState("done");
        // Fired without awaiting: the L1 badge fills in after the profile paints.
        if (found.kind === "registered") {
          void checkL1(check.label, found.records.evm);
        }
      } catch {
        setError("Couldn't reach Robinhood Chain. Check your connection and retry.");
        setState("error");
      }
    },
    [checkL1]
  );

  // A shared /search/?q=gm link resolves on arrival rather than waiting for a click.
  // Read after mount, never during render: the page is prerendered to static HTML and
  // touching location during render would desync hydration.
  useEffect(() => {
    const handoff = new URLSearchParams(window.location.search).get("q");
    const seed = normalizeLabel(handoff ?? "");
    if (!seed) return;
    setQuery(seed);
    void lookup(seed);
  }, [lookup]);

  const records = result?.kind === "registered" ? result.records : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="panel p-6 sm:p-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void lookup(query);
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative flex-1">
            <input
              className="input data w-full pr-28 text-base"
              placeholder="Search any name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              spellCheck={false}
              autoCapitalize="none"
              autoComplete="off"
              aria-label="HoodFi name to look up"
            />
            <span className="data pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--faint)]">
              .hoodfi.eth
            </span>
          </div>
          <button
            className="btn btn-primary sm:w-40"
            type="submit"
            disabled={state === "loading" || query.trim() === ""}
          >
            {state === "loading" ? "Looking up…" : "Look up"}
          </button>
        </form>
        {error && <div className="data mt-3 text-xs bad">{error}</div>}
      </div>

      {result?.kind === "unregistered" && (
        <div className="panel p-8 text-center">
          <h3 className="display text-xl">
            <span className="data">{submitted}</span>
            <span className="text-[var(--dim)]">.hoodfi.eth</span> isn&apos;t taken
          </h3>
          {result.status === MINT_STATUS.BLOCKED ? (
            <p className="mt-2 text-sm text-[var(--dim)]">
              This label is reserved as infrastructure and can&apos;t be minted by
              anyone.
            </p>
          ) : result.status === MINT_STATUS.LOCKED ? (
            <>
              <p className="mt-2 max-w-[46ch] mx-auto text-sm text-[var(--dim)]">
                Short names are premium inventory. They unlock for everyone once
                hoodfi.eth&apos;s expiry reaches the 100-year goal — or you can mint one
                free right now with a donation credit.
              </p>
              <Link href="/#extend" className="btn btn-primary mt-5">
                Earn a credit
              </Link>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-[var(--dim)]">
                Nobody owns this name yet — it could be yours.
              </p>
              <Link
                href={`/mint/?q=${encodeURIComponent(submitted)}`}
                className="btn btn-primary mt-5"
              >
                Mint {submitted}.hoodfi.eth
              </Link>
            </>
          )}
        </div>
      )}

      {records && (
        <div className="panel p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4 sm:gap-5">
              <NameAvatar label={records.label} avatar={records.avatar} />
              <div className="min-w-0">
                <div className="data text-xl font-semibold leading-tight break-all sm:text-2xl">
                  {records.label}
                  <span className="text-[var(--dim)]">.hoodfi.eth</span>
                </div>
                <L1Badge state={l1} />
              </div>
            </div>
            <ShareOnX
              text={`${records.label}.hoodfi.eth — a lifetime ENS name on Robinhood Chain.\n\nLook it up:`}
              url={nameShareUrl(records.label)}
              eventLabel="search"
            >
              Share
            </ShareOnX>
          </div>

          <div className="mt-6">
            {records.evm && (
              <Row
                label="Ethereum & Robinhood Chain"
                value={records.evm}
                Logo={EthereumLogo}
              />
            )}
            {records.btc && (
              <Row label="Bitcoin" value={records.btc} Logo={BitcoinLogo} />
            )}
            {records.sol && (
              <Row label="Solana" value={records.sol} Logo={SolanaLogo} />
            )}
            {records.texts.map((t) => (
              <Row
                key={t.key}
                label={t.label}
                value={t.value}
                mono={t.key !== "description"}
                href={
                  t.key === "url"
                    ? t.value
                    : t.key === "com.twitter"
                      ? `https://x.com/${t.value}`
                      : undefined
                }
              />
            ))}
            <Row label="Owner" value={records.owner} />
          </div>

          {records.texts.length === 0 && !records.btc && !records.sol && (
            <p className="mt-4 text-sm text-[var(--dim)]">
              This name is registered but its owner hasn&apos;t added a profile yet.
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3 border-t border-[var(--line)] pt-5">
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
      )}
    </div>
  );
}
