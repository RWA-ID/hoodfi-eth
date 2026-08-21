"use client";

import Link from "next/link";
import {
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
  pathBelowRoot,
} from "@/lib/ens";
import {
  contentGatewayUrl,
  decodeContenthash,
  encodeContenthash,
  nameUrl,
  parseContenthash,
} from "@/shared/contenthash";
import { ArrowNE, Chevron } from "./ArrowNE";
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
import { RecordsPrimer } from "./RecordsPrimer";
import { SubnameSection } from "./SubnameSection";
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

/** The website record's own key in the draft — it is neither a text nor an address. */
const CONTENTHASH = "contenthash";

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

function useContenthashRecord(node: `0x${string}` | undefined) {
  return useReadContract({
    address: L2_REGISTRY_ADDRESS,
    abi: registryAbi,
    functionName: "contenthash",
    args: [node ?? "0x"],
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
  // Same question for the website record, and the same reason: what happens after the
  // block is confirmed is not instant, and silence there reads as a failed save.
  const [contentInFlight, setContentInFlight] = useState(false);
  const [contentSaved, setContentSaved] = useState(false);

  const avatar = useTextRecord(name.node, "avatar");
  const twitter = useTextRecord(name.node, "com.twitter");
  const url = useTextRecord(name.node, "url");
  const description = useTextRecord(name.node, "description");

  const evmAddr = useAddrRecord(name.node, ROBINHOOD_COIN_TYPE);
  const btcAddr = useAddrRecord(name.node, BTC_COIN_TYPE);
  const solAddr = useAddrRecord(name.node, SOL_COIN_TYPE);
  const content = useContenthashRecord(name.node);

  const evmRecord = evmAddr.data as string | undefined;
  // Shown as the `ipfs://…` URI rather than the stored bytes: it is what every other
  // ENS tool displays, and the only form an owner could check against their pin.
  const savedContent = decodeContenthash(content.data as string | undefined);

  const onChainValues: Record<string, string> = {
    avatar: avatar.data ?? "",
    "com.twitter": twitter.data ?? "",
    url: url.data ?? "",
    description: description.data ?? "",
    addr:
      evmRecord && evmRecord !== "0x" ? getAddress(evmRecord as Address) : "",
    "addr.btc": decodeChainAddress(BTC_COIN_TYPE, btcAddr.data as string),
    "addr.sol": decodeChainAddress(SOL_COIN_TYPE, solAddr.data as string),
    [CONTENTHASH]: savedContent?.uri ?? "",
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
    content.data,
  ]);

  useEffect(() => {
    if (receipt.isSuccess && saving) {
      track("record_saved", { method: String(dirty.size) });
      setDirty(new Set());
      setSaving(false);
      setAvatarSaved(avatarInFlight);
      setContentSaved(contentInFlight);
      void avatar.refetch();
      void twitter.refetch();
      void url.refetch();
      void description.refetch();
      void evmAddr.refetch();
      void btcAddr.refetch();
      void solAddr.refetch();
      void content.refetch();
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
    void resolveOnL1(pathBelowRoot(name.name), onChainEvm).then((s) => {
      if (!cancelled) setL1(s);
    });
    return () => {
      cancelled = true;
    };
  }, [name.name, evmRecord]);

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
    // Keyed by the whole path. On the label alone, `crypto.hoodfi.eth` and
    // `crypto.gm.hoodfi.eth` share one stash slot, so an avatar pinned for one would be
    // re-applied to the other's form on the way back from the wallet.
    const key = pathBelowRoot(name.name);
    const pending = readStashedAvatar(key);
    if (!pending) return;
    if (pending === avatar.data) {
      clearStashedAvatar(key);
      return;
    }
    set("avatar", pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatar.data, name.name]);

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

  /** What the website field currently holds, parsed — null while empty or unparseable. */
  const contentDraft = parseContenthash(draft[CONTENTHASH] ?? "");
  const contentInvalid =
    (draft[CONTENTHASH] ?? "").trim() !== "" && contentDraft === null;

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

    if (dirty.has(CONTENTHASH)) {
      const typed = (draft[CONTENTHASH] ?? "").trim();
      // Emptied on purpose: "0x" clears the record and the name stops being a site.
      const bytes = typed === "" ? "0x" : encodeContenthash(typed);
      if (bytes !== null) {
        calls.push(
          encodeFunctionData({
            abi: registryAbi,
            functionName: "setContenthash",
            args: [name.node, bytes],
          })
        );
      }
    }
    return calls;
  }

  async function saveAll() {
    if (!L2_REGISTRY_ADDRESS) return;
    const calls = pendingCalls();
    if (calls.length === 0) return;
    setActionError(null);
    setAvatarSaved(false);
    setContentSaved(false);
    setAvatarInFlight(dirty.has("avatar"));
    setContentInFlight(dirty.has(CONTENTHASH));
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
  // Anything left unparseable blocks the whole batch — it's one transaction.
  const blocked = ADDRESS_FIELDS.some(addrInvalid) || contentInvalid;
  const changeCount = pendingCalls().length === 0 ? 0 : dirty.size;
  const canSave = changeCount > 0 && !blocked && !busy;

  return (
    <div className="flex flex-col gap-6">
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(330px,480px)_minmax(330px,1fr)]">
      {/* Live preview — driven by the draft, not the chain, so it shows what you are
          about to publish rather than what is already published. */}
      <div className="flex flex-col gap-3">
        <ProfileCard
          name={{
            // The card draws this against a fixed `.hoodfi.eth` suffix and builds the
            // share link from it, so a nested name has to arrive as its whole path or
            // it would both render and link as somebody else's name.
            label: pathBelowRoot(name.name),
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
            text={`${name.name} is mine — a lifetime ENS name on Robinhood Chain.\n\nGet yours:`}
            url={nameShareUrl(pathBelowRoot(name.name))}
            className="btn btn-ghost min-w-[150px] flex-1"
            eventLabel="manage"
          >
            Share
          </ShareOnX>
        </div>

        {/* Fills the column under the card. Without it this side ran out of content a
            fifth of the way down and left a tall empty strip beside the records. */}
        <RecordsPrimer />
      </div>

      {/* Editor, laid out as the same ledger the lookup page renders read-only. */}
      <div className="w-full border border-[var(--line-card)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3.5 sm:px-5">
          <span className="label">Onchain records</span>
          <span className="label">editing {pathBelowRoot(name.name)}</span>
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
              {/* The path, not the label: the uploader signs a message naming the name
                  and the gateway checks who owns it, so a nested name sent as its
                  leftmost label alone would be authorised against a different name. */}
              {field.key === "avatar" && (
                <AvatarUpload
                  label={pathBelowRoot(name.name)}
                  onUploaded={(uri) => set("avatar", uri)}
                />
              )}
            </div>
          </div>
        ))}

        {/* The website record. Last in the ledger because it's the one that changes
            what the name *is* rather than what it points at — everything above makes
            the name resolve, this makes it open. */}
        <div className="flex flex-col gap-2 border-b border-[color-mix(in_srgb,var(--line)_70%,transparent)] px-4 py-4 sm:grid sm:grid-cols-[170px_minmax(0,1fr)] sm:items-start sm:gap-3 sm:px-5">
          <label className="pt-2" htmlFor={`${CONTENTHASH}-${name.label}`}>
            <span className="label" style={{ letterSpacing: "0.16em" }}>
              Website (IPFS)
            </span>
          </label>
          <div className="min-w-0">
            <input
              id={`${CONTENTHASH}-${name.label}`}
              className="input data w-full text-sm"
              placeholder="ipfs://bafy… or ipns://k51…"
              value={draft[CONTENTHASH] ?? ""}
              onChange={(e) => set(CONTENTHASH, e.target.value)}
              spellCheck={false}
              autoCapitalize="none"
            />
            {contentInvalid ? (
              <div className="data mt-1.5 text-xs" style={{ color: "var(--bad)" }}>
                That isn&apos;t an IPFS CID or IPNS key. A CID, an ipfs:// link or a
                gateway URL all work — anything else can&apos;t be stored.
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-[var(--faint)]">
                Serve a whole website from your name. Paste the CID of a folder you
                pinned, or an IPNS key if you want to update it without a transaction.
              </p>
            )}
            {contentDraft &&
              (savedContent?.uri === contentDraft.uri ? (
                <p className="mt-2 text-xs leading-relaxed text-[var(--faint)]">
                  Live at{" "}
                  <a
                    className="link"
                    href={nameUrl(pathBelowRoot(name.name))}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {name.name}.link <ArrowNE />
                  </a>{" "}
                  and from{" "}
                  <a
                    className="link"
                    href={contentGatewayUrl(contentDraft)}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    any IPFS gateway <ArrowNE />
                  </a>
                  .
                </p>
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-[var(--faint)]">
                  Saving points {name.name} at this content.{" "}
                  <a
                    className="link"
                    href={contentGatewayUrl(contentDraft)}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Check it loads first <ArrowNE />
                  </a>{" "}
                  — the record can only carry the CID, so whatever is at its root is
                  what visitors get.
                </p>
              ))}
          </div>
        </div>

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
          {/* The record is written the moment the block lands, but nobody reads it
              from the chain directly: mainnet lookups go through our CCIP gateway,
              whose signed answers clients cache for five minutes, and gateways issue
              a certificate for the name the first time it's asked for. So a site can
              be correctly published and still 404 for a few minutes — which is how an
              owner ends up saving the same record three times. */}
          {contentSaved && !saving && (
            <p className="mt-2 text-xs leading-relaxed text-[var(--faint)]">
              Your website record is live onchain. Give lookups up to five minutes to
              stop serving the previous answer, and the first visit to{" "}
              <span className="data">{name.name}.link</span> a moment to
              get its certificate — the content itself is already reachable from the
              gateway link above.
            </p>
          )}
          <p className="data mt-3 text-[11px] leading-relaxed text-[var(--faint)]">
            Every change saves in a single transaction on Robinhood Chain. You&apos;re
            the owner — these writes go straight to the registry, not through us.
          </p>
        </div>

      </div>
      </div>

      {/* Full width, outside the two-column grid on purpose. These act on the name
          itself rather than its records, and they are tall — left inside the records
          column they stretched the row and left the card's column standing empty for
          most of the page. Nothing here is picked up by "Save changes"; each carries
          its own confirmation. */}
      <SubnameSection name={name} onChanged={onSaved} />
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
  // The whole path below the root, not the leftmost label: the card draws this against
  // a fixed `.hoodfi.eth` suffix, so `crypto.gm.hoodfi.eth` rendered from its label
  // alone would read as `crypto.hoodfi.eth` — a different name, quite possibly one this
  // wallet doesn't hold. Two nested names sharing a first label were indistinguishable.
  const path = pathBelowRoot(name.name);

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
        label={path}
        avatar={avatar.data ?? ""}
        className="h-12 w-12"
        textClassName="text-sm"
      />
      {/* A nested path is longer than a label and the card is a fixed 168px, so it wraps
          rather than truncating to the same first label the bug this replaced already
          showed. The `<wbr>`s are the only break opportunities, so it breaks at the
          separator and keeps every label whole — `payroll.treasury` splits after
          `payroll`, not as `payroll.treasur / y`. `anywhere` is the last resort for a
          single label too long to fit, which has no separator to break at and would
          otherwise spill out of the card.

          Two lines are reserved whether or not the name uses them, so the `.hoodfi.eth`
          below sits on the same line across every card in a row. */}
      <span className="grid min-h-[2.5em] w-full place-items-center">
        <span className="data max-w-full text-sm font-semibold leading-tight [overflow-wrap:anywhere]">
          {breakOnDots(path)}
        </span>
      </span>
      <span className="data -mt-1.5 text-[10px] text-[var(--faint)]">.hoodfi.eth</span>
    </button>
  );
}

/**
 * A name path with a break opportunity before each separator — `crypto.gm` may wrap as
 * `crypto` / `.gm`, and nowhere else.
 *
 * The dot leads the new line rather than trailing the old one, which is how the suffix
 * under it and the token art both write one.
 */
function breakOnDots(path: string): ReactNode[] {
  return path
    .split(".")
    .flatMap((label, i) => (i === 0 ? [label] : [<wbr key={i} />, `.${label}`]));
}

/**
 * The pitch a nudge of the arrows moves: one card plus one `gap-3`.
 *
 * Tied by hand to `w-[168px]` on the card above — a scroll that lands mid-card reads as
 * a broken row rather than a scrolled one, so if that width changes this must too.
 */
const CARD_PITCH = 168 + 12;

/**
 * One horizontally-scrolling row of name cards.
 *
 * A wrapping grid was fine for the three or four names a wallet used to hold, but
 * subnames go any depth and cost only gas, so the picker is now the tallest thing on the
 * page for anyone who has used the feature — it pushed the editor it exists to serve
 * below the fold. A row that slides stays one card tall no matter how many names are in
 * it, and splitting names from subnames means the thing you own and the things you
 * created beneath it stop being one undifferentiated wall.
 *
 * Native overflow scrolling does the work: a trackpad, a touch swipe and shift-wheel all
 * already do the right thing, and the arrows exist for the mouse-only case where nothing
 * on screen says the row moves.
 */
function NameRow({
  label,
  group = "names",
  names,
  selectedNode,
  onSelect,
}: {
  /** Heading text, count and all. Omitted when there is only one row to head. */
  label?: string;
  /** What this row holds, for the arrows' screen-reader labels — no count, which is
   *  noise read aloud and changes every time a name is minted. */
  group?: string;
  names: OwnedName[];
  selectedNode: string | undefined;
  onSelect: (node: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  // Which way there is more to see. Drives both the arrows and the edge fade, so a row
  // that fits shows neither and reads as a plain row.
  const [more, setMore] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // A pixel of slack: fractional layout widths mean scrollLeft never quite reaches
    // `max`, which would leave the right arrow live at the end of the row forever.
    setMore({ left: el.scrollLeft > 1, right: el.scrollLeft < max - 1 });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    // Resizing the window changes what fits without firing a scroll event.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, names.length]);

  function nudge(direction: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    // Whole cards, as many as are on screen — a page, not a pixel amount.
    const step = Math.max(1, Math.floor(el.clientWidth / CARD_PITCH)) * CARD_PITCH;
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  const arrows = more.left || more.right;

  return (
    <div className="min-w-0">
      {(label || arrows) && (
        <div className="mb-2.5 flex items-center gap-3">
          {label && <span className="label">{label}</span>}
          {/* The rule carries the eye across to the arrows and gives a short label
              something to sit against, the same hairline idiom as every other group. */}
          <span className="h-px min-w-4 flex-1 bg-[var(--line-soft)]" />
          {arrows && (
            <div className="flex shrink-0 gap-1.5">
              {(["left", "right"] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => nudge(dir === "left" ? -1 : 1)}
                  disabled={!more[dir]}
                  aria-label={`Scroll ${group} ${dir}`}
                  className="grid h-6 w-6 cursor-pointer place-items-center border border-[var(--line-card)] text-[10px] text-[var(--fg)] transition-colors hover:bg-[var(--hover-fill)] disabled:cursor-default disabled:border-[var(--line-soft)] disabled:text-[var(--faint)] disabled:hover:bg-transparent"
                >
                  <Chevron dir={dir} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Faded on whichever side has more, so the row is visibly cut off rather than
          appearing to end at the container edge. A mask rather than a paper-coloured
          overlay: it fades the cards to transparent, so it keeps working whatever ground
          the row is ever placed on. */}
      <div
        ref={scroller}
        onScroll={measure}
        // `-m-*`/`p-*` so a card's focus ring and the selected card's border aren't
        // shaved off by the scroll container's own edge.
        className="-mx-1 -my-1 flex snap-x gap-3 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          maskImage: edgeFade(more),
          WebkitMaskImage: edgeFade(more),
        }}
      >
        {names.map((name) => (
          <NameCard
            key={name.node}
            name={name}
            selected={name.node === selectedNode}
            onSelect={() => onSelect(name.node)}
          />
        ))}
      </div>
    </div>
  );
}

/** The mask for a row, or `undefined` when it fits and needs none. */
function edgeFade(more: { left: boolean; right: boolean }): string | undefined {
  if (!more.left && !more.right) return undefined;
  const from = more.left ? "transparent 0, #000 28px" : "#000 0";
  const to = more.right ? "#000 calc(100% - 28px), transparent 100%" : "#000 100%";
  return `linear-gradient(to right, ${from}, ${to})`;
}

/**
 * The whole picker: every name this wallet holds, as one or two sliding rows.
 *
 * Exported so it can be rendered against mock names without a wallet — verifying this
 * page any other way means holding the right names in a connected wallet, and shipping it
 * unseen has cost a visual bug more than once.
 */
export function NamePicker({
  names,
  selectedNode,
  onSelect,
}: {
  names: OwnedName[];
  selectedNode: string | undefined;
  onSelect: (node: string) => void;
}) {
  // Names held directly under hoodfi.eth, and names created beneath one of them — `gm`
  // against `crypto.gm`. A dot in the path below the root is the whole test, and it holds
  // at any depth: `a.b.gm` is a subname of `b.gm`, which is a subname of `gm`.
  //
  // Null when every name falls on the same side, which is the common case: a wallet that
  // has never created a subname should not be told which kind its names are.
  const split = (() => {
    const roots: OwnedName[] = [];
    const subs: OwnedName[] = [];
    for (const name of names) {
      (pathBelowRoot(name.name).includes(".") ? subs : roots).push(name);
    }
    return roots.length > 0 && subs.length > 0 ? { roots, subs } : null;
  })();

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="eyebrow">{names.length} names in this wallet</div>
        <div className="data text-xs text-[var(--faint)]">
          Pick one to edit its records
        </div>
      </div>
      {/* Deliberately not wrapped in a .panel: a single bordered box around them reads
          as the object, and the cards inside it disappear. */}
      <div className="mt-4 flex flex-col gap-5">
        {split ? (
          <>
            <NameRow
              label={`Names · ${split.roots.length}`}
              group="names"
              names={split.roots}
              selectedNode={selectedNode}
              onSelect={onSelect}
            />
            <NameRow
              label={`Subnames · ${split.subs.length}`}
              group="subnames"
              names={split.subs}
              selectedNode={selectedNode}
              onSelect={onSelect}
            />
          </>
        ) : (
          // Only one kind of name here, so there is no distinction to draw and a heading
          // would label a group against nothing.
          <NameRow names={names} selectedNode={selectedNode} onSelect={onSelect} />
        )}
      </div>
    </div>
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
        <NamePicker
          names={names}
          selectedNode={selected?.node}
          onSelect={setSelectedNode}
        />
      )}

      {selected && (
        // Keyed on the node so switching names remounts the editor — otherwise the
        // draft state and dirty set would carry over onto the next name's records.
        <NameEditor key={selected.node} name={selected} onSaved={reload} />
      )}
    </div>
  );
}
