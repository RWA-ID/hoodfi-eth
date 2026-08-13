"use client";

import Link from "next/link";
import { type ReactElement, useEffect, useState } from "react";
import {
  type Address,
  encodeFunctionData,
  getAddress,
  isAddress,
} from "viem";
import {
  useAccount,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { robinhoodChain } from "@/lib/chains";
import { L2_REGISTRY_ADDRESS, registryAbi } from "@/lib/contracts";
import {
  BTC_COIN_TYPE,
  ETH_COIN_TYPE,
  ROBINHOOD_COIN_TYPE,
  SOL_COIN_TYPE,
  decodeChainAddress,
  encodeChainAddress,
  normalizeXHandle,
} from "@/lib/ens";
import { AvatarUpload } from "./AvatarUpload";
import { clearStashedAvatar, readStashedAvatar } from "@/lib/avatar";
import { BitcoinLogo, EthereumLogo, SolanaLogo } from "./ChainLogo";
import { track } from "@/lib/analytics";
import { walletErrorMessage } from "@/lib/errors";
import { ShareOnX } from "./ShareOnX";
import { NameAvatar } from "./NameAvatar";
import { ProfileCard, type L1State } from "./ProfileCard";
import { readMintDate, resolveOnL1 } from "@/lib/resolution";
import { nameShareUrl } from "@/lib/site";
import { type OwnedName, useMyNames } from "./useMyNames";

type Field = "addr" | "avatar" | "com.twitter" | "url" | "description";

/**
 * The address records a name can carry. The EVM row writes two coinTypes at once so the
 * name resolves the same through the L1 resolver and on Robinhood Chain; BTC and SOL are
 * stored in their own binary encodings, per ENSIP-9.
 */
const ADDRESS_FIELDS: {
  key: string;
  label: string;
  help: string;
  placeholder: string;
  coinTypes: bigint[];
  Logo: (props: { className?: string }) => ReactElement;
  /** Only the EVM record is what makes the name resolve — don't let it be cleared by accident. */
  allowClear: boolean;
}[] = [
  {
    key: "addr",
    label: "Ethereum & Robinhood Chain",
    help: "The address this name resolves to everywhere.",
    placeholder: "0x…",
    coinTypes: [ROBINHOOD_COIN_TYPE, ETH_COIN_TYPE],
    Logo: EthereumLogo,
    allowClear: false,
  },
  {
    key: "addr.btc",
    label: "Bitcoin",
    help: "Legacy, P2SH or bech32 — all accepted.",
    placeholder: "bc1… or 1…",
    coinTypes: [BTC_COIN_TYPE],
    Logo: BitcoinLogo,
    allowClear: true,
  },
  {
    key: "addr.sol",
    label: "Solana",
    help: "",
    placeholder: "Base58 address",
    coinTypes: [SOL_COIN_TYPE],
    Logo: SolanaLogo,
    allowClear: true,
  },
];

const TEXT_FIELDS: {
  key: Field;
  label: string;
  placeholder: string;
  help: string;
}[] = [
  {
    key: "avatar",
    label: "Avatar",
    placeholder: "ipfs://… or https://…",
    help: "Shown by wallets and marketplaces that read ENS records.",
  },
  {
    key: "com.twitter",
    label: "X (Twitter)",
    placeholder: "yourhandle",
    help: "Handle only — we strip @ and full URLs for you.",
  },
  {
    key: "url",
    label: "Website",
    placeholder: "https://…",
    help: "",
  },
  {
    key: "description",
    label: "Bio",
    placeholder: "Short description",
    help: "",
  },
];

function useTextRecord(node: `0x${string}` | undefined, key: string) {
  return useReadContract({
    address: L2_REGISTRY_ADDRESS,
    abi: registryAbi,
    functionName: "text",
    args: [node ?? "0x", key],
    chainId: robinhoodChain.id,
    query: { enabled: Boolean(L2_REGISTRY_ADDRESS && node) },
  });
}

function useAddrRecord(node: `0x${string}` | undefined, coinType: bigint) {
  return useReadContract({
    address: L2_REGISTRY_ADDRESS,
    abi: registryAbi,
    functionName: "addr",
    args: [node ?? "0x", coinType],
    chainId: robinhoodChain.id,
    query: { enabled: Boolean(L2_REGISTRY_ADDRESS && node) },
  });
}

function NameEditor({
  name,
  onSaved,
}: {
  name: OwnedName;
  onSaved: () => void;
}) {
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const {
    writeContractAsync,
    data: txHash,
    isPending,
    error,
  } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: robinhoodChain.id,
  });

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  // Chain-switch and submission failures: no hook reports these for us.
  const [actionError, setActionError] = useState<string | null>(null);
  // Card preview extras. Both are non-blocking — the editor is usable before either
  // lands, and neither is worth a spinner.
  const [l1, setL1] = useState<L1State>({ status: "idle" });
  const [mintedOn, setMintedOn] = useState<string | null>(null);
  // Whether the batch that just confirmed carried a new picture. Captured at submit,
  // because by the time the receipt lands `dirty` has been cleared — and the answer
  // decides whether the owner is told to expect a wait.
  const [avatarInFlight, setAvatarInFlight] = useState(false);
  const [avatarSaved, setAvatarSaved] = useState(false);

  const avatar = useTextRecord(name.node, "avatar");
  const twitter = useTextRecord(name.node, "com.twitter");
  const url = useTextRecord(name.node, "url");
  const description = useTextRecord(name.node, "description");

  const evmAddr = useAddrRecord(name.node, ROBINHOOD_COIN_TYPE);
  const btcAddr = useAddrRecord(name.node, BTC_COIN_TYPE);
  const solAddr = useAddrRecord(name.node, SOL_COIN_TYPE);

  const evmRecord = evmAddr.data as string | undefined;

  const onChainValues: Record<string, string> = {
    avatar: avatar.data ?? "",
    "com.twitter": twitter.data ?? "",
    url: url.data ?? "",
    description: description.data ?? "",
    addr:
      evmRecord && evmRecord !== "0x" ? getAddress(evmRecord as Address) : "",
    "addr.btc": decodeChainAddress(BTC_COIN_TYPE, btcAddr.data as string),
    "addr.sol": decodeChainAddress(SOL_COIN_TYPE, solAddr.data as string),
  };

  // Seed the form from chain state once, then let the user's edits win.
  useEffect(() => {
    setDraft((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(onChainValues)) {
        if (!dirty.has(k)) next[k] = v;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    avatar.data,
    twitter.data,
    url.data,
    description.data,
    evmAddr.data,
    btcAddr.data,
    solAddr.data,
  ]);

  useEffect(() => {
    if (receipt.isSuccess && saving) {
      track("record_saved", { method: String(dirty.size) });
      setDirty(new Set());
      setSaving(false);
      setAvatarSaved(avatarInFlight);
      void avatar.refetch();
      void twitter.refetch();
      void url.refetch();
      void description.refetch();
      void evmAddr.refetch();
      void btcAddr.refetch();
      void solAddr.refetch();
      onSaved();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess]);

  // Mint date is immutable, so it's fetched once per name.
  useEffect(() => {
    let cancelled = false;
    void readMintDate(name.tokenId).then((d) => {
      if (!cancelled) setMintedOn(d);
    });
    return () => {
      cancelled = true;
    };
  }, [name.tokenId]);

  // Resolution is re-checked whenever the saved EVM record changes — after a save it
  // genuinely can flip, and telling someone their name resolves when it no longer does
  // is the failure this badge exists to catch.
  useEffect(() => {
    let cancelled = false;
    const onChainEvm =
      evmRecord && evmRecord !== "0x" ? getAddress(evmRecord as Address) : "";
    setL1({ status: "checking" });
    void resolveOnL1(name.label, onChainEvm).then((s) => {
      if (!cancelled) setL1(s);
    });
    return () => {
      cancelled = true;
    };
  }, [name.label, evmRecord]);

  function set(key: string, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty((d) => new Set(d).add(key));
  }

  /**
   * Re-apply an avatar that was pinned but never written.
   *
   * Uploading returns an ipfs:// URI into this form and nothing else — the record is
   * only changed by the save below. Anything that resets React state in between loses
   * it, and on a phone that is the normal path, not an edge case: signing hands off to
   * the wallet app and coming back can reload the page, so the upload finishes on the
   * server while the state holding its CID is gone. The image stays pinned and the
   * owner has no way to find it again.
   *
   * Runs off `avatar.data` so it lands after the chain read has seeded the form,
   * otherwise the seed would immediately overwrite it. Clears itself the moment the
   * record matches, so it can't keep re-dirtying a form the user already saved.
   */
  useEffect(() => {
    if (avatar.data === undefined) return;
    const pending = readStashedAvatar(name.label);
    if (!pending) return;
    if (pending === avatar.data) {
      clearStashedAvatar(name.label);
      return;
    }
    set("avatar", pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatar.data, name.label]);

  async function ensureChain() {
    if (chainId !== robinhoodChain.id) {
      await switchChainAsync({ chainId: robinhoodChain.id });
    }
  }

  /**
   * The bytes to store for an address row, or null if it can't be written yet.
   * "0x" clears a record the user deliberately emptied.
   */
  function addrBytes(
    field: (typeof ADDRESS_FIELDS)[number],
    coinType: bigint
  ): `0x${string}` | null {
    const value = (draft[field.key] ?? "").trim();
    if (value === "") return field.allowClear ? "0x" : null;
    // The EVM row is a plain 20-byte address; the others need their chain's encoding.
    if (field.key === "addr") return isAddress(value) ? getAddress(value) : null;
    return encodeChainAddress(coinType, value);
  }

  /** True once a row holds something that isn't a valid address for its chain. */
  function addrInvalid(field: (typeof ADDRESS_FIELDS)[number]): boolean {
    const value = (draft[field.key] ?? "").trim();
    if (value === "") return false;
    return addrBytes(field, field.coinTypes[0]) === null;
  }

  /** Every pending edit, encoded as registry calls — the whole form in one batch. */
  function pendingCalls(): `0x${string}`[] {
    const calls: `0x${string}`[] = [];

    for (const field of ADDRESS_FIELDS) {
      if (!dirty.has(field.key)) continue;
      for (const coinType of field.coinTypes) {
        const bytes = addrBytes(field, coinType);
        if (bytes === null) continue;
        calls.push(
          encodeFunctionData({
            abi: registryAbi,
            functionName: "setAddr",
            args: [name.node, coinType, bytes],
          })
        );
      }
    }

    for (const field of TEXT_FIELDS) {
      if (!dirty.has(field.key)) continue;
      const raw = draft[field.key] ?? "";
      const value =
        field.key === "com.twitter" ? normalizeXHandle(raw) : raw.trim();
      calls.push(
        encodeFunctionData({
          abi: registryAbi,
          functionName: "setText",
          args: [name.node, field.key, value],
        })
      );
    }
    return calls;
  }

  async function saveAll() {
    if (!L2_REGISTRY_ADDRESS) return;
    const calls = pendingCalls();
    if (calls.length === 0) return;
    setActionError(null);
    setAvatarSaved(false);
    setAvatarInFlight(dirty.has("avatar"));
    try {
      await ensureChain();
      setSaving(true);
      // Batched through the registry's multicall so the user signs once for the
      // whole form, however many records changed.
      await writeContractAsync({
        address: L2_REGISTRY_ADDRESS,
        abi: registryAbi,
        functionName: "multicall",
        args: [calls],
        chainId: robinhoodChain.id,
      });
    } catch (error) {
      setSaving(false);
      setActionError(walletErrorMessage(error));
    }
  }

  const busy = isPending || receipt.isLoading;
  // An address left unparseable blocks the whole batch — it's one transaction.
  const blocked = ADDRESS_FIELDS.some(addrInvalid);
  const changeCount = pendingCalls().length === 0 ? 0 : dirty.size;
  const canSave = changeCount > 0 && !blocked && !busy;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(330px,480px)_minmax(330px,1fr)]">
      {/* Live preview — driven by the draft, not the chain, so it shows what you are
          about to publish rather than what is already published. */}
      <div className="flex flex-col gap-3">
        <ProfileCard
          name={{
            label: name.label,
            node: name.node,
            avatar: draft.avatar ?? "",
            description: draft.description ?? "",
          }}
          l1={l1}
          mintedOn={mintedOn}
          actions={false}
          eyebrow={changeCount > 0 ? "Preview" : "Lifetime"}
        />
        <div className="flex flex-wrap gap-2.5">
          <a
            className="btn btn-ghost min-w-[150px] flex-1"
            href={`${robinhoodChain.blockExplorers.default.url}/token/${L2_REGISTRY_ADDRESS}/instance/${name.tokenId}`}
            target="_blank"
            rel="noreferrer"
          >
            View NFT
          </a>
          <ShareOnX
            text={`${name.label}.hoodfi.eth is mine — a lifetime ENS name on Robinhood Chain.\n\nGet yours:`}
            url={nameShareUrl(name.label)}
            className="btn btn-ghost min-w-[150px] flex-1"
            eventLabel="manage"
          >
            Share
          </ShareOnX>
        </div>
      </div>

      {/* Editor, laid out as the same ledger the lookup page renders read-only. */}
      <div className="w-full border border-[var(--line-card)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3.5 sm:px-5">
          <span className="label">Onchain records</span>
          <span className="label">editing {name.label}</span>
        </div>

        {/* Addresses first — they're what make the name actually resolve. */}
        {ADDRESS_FIELDS.map((field) => (
          <div
            key={field.key}
            className="flex flex-col gap-2 border-b border-[var(--line-soft)] px-4 py-4 sm:grid sm:grid-cols-[170px_minmax(0,1fr)] sm:items-start sm:gap-3 sm:px-5"
          >
            <label
              className="flex items-center gap-2 pt-2"
              htmlFor={`${field.key}-${name.label}`}
            >
              <field.Logo className="h-4 w-4 shrink-0" />
              <span className="label" style={{ letterSpacing: "0.16em" }}>
                {field.label}
              </span>
            </label>
            <div className="min-w-0">
              <input
                id={`${field.key}-${name.label}`}
                className="input data w-full text-sm"
                placeholder={field.key === "addr" ? address ?? "0x…" : field.placeholder}
                value={draft[field.key] ?? ""}
                onChange={(e) => set(field.key, e.target.value)}
                spellCheck={false}
                autoCapitalize="none"
              />
              {addrInvalid(field) ? (
                <div className="data mt-1.5 text-xs" style={{ color: "var(--bad)" }}>
                  That isn&apos;t a valid {field.label.split(" ")[0]} address
                </div>
              ) : (
                field.help && (
                  <p className="mt-1.5 text-xs text-[var(--faint)]">{field.help}</p>
                )
              )}
            </div>
          </div>
        ))}

        {TEXT_FIELDS.map((field) => (
          <div
            key={field.key}
            className="flex flex-col gap-2 border-b border-[color-mix(in_srgb,var(--line)_70%,transparent)] px-4 py-4 sm:grid sm:grid-cols-[170px_minmax(0,1fr)] sm:items-start sm:gap-3 sm:px-5"
          >
            <label className="pt-2" htmlFor={`${field.key}-${name.label}`}>
              <span className="label" style={{ letterSpacing: "0.16em" }}>
                {field.label}
              </span>
            </label>
            <div className="min-w-0">
              <input
                id={`${field.key}-${name.label}`}
                className="input w-full text-sm"
                placeholder={field.placeholder}
                value={draft[field.key] ?? ""}
                onChange={(e) => set(field.key, e.target.value)}
                spellCheck={false}
                autoCapitalize="none"
              />
              {field.help && (
                <p className="mt-1.5 text-xs text-[var(--faint)]">{field.help}</p>
              )}
              {field.key === "avatar" && (
                <AvatarUpload
                  label={name.label}
                  onUploaded={(uri) => set("avatar", uri)}
                />
              )}
            </div>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5">
          <button
            className="btn btn-ink sm:w-48"
            onClick={saveAll}
            disabled={!canSave}
            type="button"
          >
            {saving && busy ? "Saving…" : "Save changes"}
          </button>
          <span className="data text-xs text-[var(--faint)]">
            {changeCount === 0
              ? "No unsaved changes"
              : `${changeCount} record${changeCount === 1 ? "" : "s"} — one transaction`}
          </span>
        </div>

        <div className="px-4 pb-5 sm:px-5">
          {(actionError || error) && (
            <div className="data break-words text-xs" style={{ color: "var(--bad)" }}>
              {actionError ?? walletErrorMessage(error)}
            </div>
          )}
          {receipt.isSuccess && !saving && (
            <div className="data text-xs" style={{ color: "var(--olive)" }}>✓ Records saved onchain.</div>
          )}
          {/* A new picture is the one record whose result isn't instant anywhere but
              here. The write lands in a block like everything else, but wallets,
              marketplaces and share cards all serve images from their own caches, so
              the old one can keep showing for minutes after the save succeeded — which
              reads as a save that didn't work, and invites a second transaction that
              changes nothing. */}
          {avatarSaved && !saving && (
            <p className="mt-2 text-xs leading-relaxed text-[var(--faint)]">
              Your new picture is live onchain and already showing on the card here.
              Wallets, marketplaces and shared links cache images, so give them a few
              minutes to catch up — there&apos;s nothing left to sign.
            </p>
          )}
          <p className="data mt-3 text-[11px] leading-relaxed text-[var(--faint)]">
            Every change saves in a single transaction on Robinhood Chain. You&apos;re
            the owner — these writes go straight to the registry, not through us.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * One name in the picker. Reads only its avatar — enough to recognise a name at a
 * glance without mounting a full editor per name, which is what used to push a
 * second name below the fold.
 */
function NameCard({
  name,
  selected,
  onSelect,
}: {
  name: OwnedName;
  selected: boolean;
  onSelect: () => void;
}) {
  const avatar = useTextRecord(name.node, "avatar");

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      // The selected card fills lime, the same way the selected tier does on the
      // homepage — one selection idiom for the whole site rather than a second one
      // invented here.
      className={`group relative flex w-[168px] shrink-0 cursor-pointer flex-col items-center gap-2.5 border p-4 text-center transition-colors ${
        selected
          ? "border-[var(--ink)] bg-[var(--lime)]"
          : "border-[var(--line-card)] bg-[var(--paper-alt)] hover:bg-[var(--hover-fill)]"
      }`}
    >
      {/* Says which one you're editing without relying on colour alone. */}
      <span
        className={`data absolute right-2 top-2 text-[9px] uppercase tracking-[0.16em] ${
          selected ? "text-[var(--ink)]" : "text-transparent group-hover:text-[var(--faint)]"
        }`}
      >
        {selected ? "editing" : "edit"}
      </span>

      <NameAvatar
        label={name.label}
        avatar={avatar.data ?? ""}
        className="h-12 w-12"
        textClassName="text-sm"
      />
      <span className="data block max-w-full truncate text-sm font-semibold leading-tight">
        {name.label}
      </span>
      <span className="data -mt-1.5 text-[10px] text-[var(--faint)]">.hoodfi.eth</span>
    </button>
  );
}

export function ManagePanel() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const { names, loading, error, reload } = useMyNames(address);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Keep the selection pointing at a name that still exists — the list reloads after
  // every save, and a name that was transferred away must not leave a dead editor.
  useEffect(() => {
    if (names.length === 0) {
      setSelectedNode(null);
      return;
    }
    if (!selectedNode || !names.some((n) => n.node === selectedNode)) {
      setSelectedNode(names[0].node);
    }
  }, [names, selectedNode]);

  if (!isConnected) {
    return (
      <div className="border border-[var(--line-card)] bg-[var(--paper-alt)] p-10 text-center">
        <h3 className="h-sub">Connect to manage your names</h3>
        <p className="mt-2 text-sm text-[var(--dim)]">
          We&apos;ll list every *.hoodfi.eth name held by your wallet.
        </p>
        <button
          className="btn btn-ink mt-6"
          onClick={() => {
            track("connect_opened");
            open();
          }}
          type="button"
        >
          Connect wallet
        </button>
      </div>
    );
  }

  // Only when there is nothing to show yet. Saving calls `reload()` to pick up the new
  // records, and swapping the whole editor for this one line mid-save tore the page
  // down to a fraction of its height — the browser kept the scroll offset, which now
  // pointed at the footer, so saving appeared to jump to the Robinhood Wallet band and
  // then jump back once the editor remounted. A refresh behind an already-rendered
  // editor should be invisible.
  if (loading && names.length === 0) {
    return (
      <div className="border border-[var(--line-card)] p-10 text-center">
        <div className="data text-sm text-[var(--dim)]">Loading your names…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-[var(--line-card)] p-10 text-center">
        <div className="data text-sm" style={{ color: "var(--bad)" }}>{error}</div>
        <button className="btn btn-ghost mt-4" onClick={reload} type="button">
          Try again
        </button>
      </div>
    );
  }

  if (names.length === 0) {
    return (
      <div className="border border-[var(--line-card)] bg-[var(--paper-alt)] p-10 text-center">
        <h3 className="h-sub">No names yet</h3>
        <p className="mt-2 text-sm text-[var(--dim)]">
          Mint one and it shows up here, ready to point at your wallet.
        </p>
        <Link href="/mint/" className="btn btn-ink mt-6">
          Mint a name
        </Link>
      </div>
    );
  }

  const selected = names.find((n) => n.node === selectedNode) ?? names[0];

  return (
    <div className="flex flex-col gap-6">
      {/* Every name visible at once. Stacking full editors meant a second name sat
          below the fold, so a wallet holding several looked like it held one. */}
      {names.length > 1 && (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="eyebrow">{names.length} names in this wallet</div>
            <div className="data text-xs text-[var(--faint)]">
              Pick one to edit its records
            </div>
          </div>
          {/* Deliberately not wrapped in a .panel: a single bordered box around them
              reads as the object, and the cards inside it disappear. */}
          <div className="mt-4 flex flex-wrap gap-3">
            {names.map((name) => (
              <NameCard
                key={name.node}
                name={name}
                selected={name.node === selected?.node}
                onSelect={() => setSelectedNode(name.node)}
              />
            ))}
          </div>
        </div>
      )}

      {selected && (
        // Keyed on the node so switching names remounts the editor — otherwise the
        // draft state and dirty set would carry over onto the next name's records.
        <NameEditor key={selected.node} name={selected} onSaved={reload} />
      )}
    </div>
  );
}
