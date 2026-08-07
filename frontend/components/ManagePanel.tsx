"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { type Address, encodeFunctionData, isAddress } from "viem";
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
  ETH_COIN_TYPE,
  ROBINHOOD_COIN_TYPE,
  avatarToUrl,
  normalizeXHandle,
} from "@/lib/ens";
import { track } from "@/lib/analytics";
import { walletErrorMessage } from "@/lib/errors";
import { ShareOnX } from "./ShareOnX";
import { type OwnedName, useMyNames } from "./useMyNames";

type Field = "addr" | "avatar" | "com.twitter" | "url" | "description";

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
  const [savingField, setSavingField] = useState<string | null>(null);
  // Chain-switch and submission failures: no hook reports these for us.
  const [actionError, setActionError] = useState<string | null>(null);

  const avatar = useTextRecord(name.node, "avatar");
  const twitter = useTextRecord(name.node, "com.twitter");
  const url = useTextRecord(name.node, "url");
  const description = useTextRecord(name.node, "description");

  const { data: addrRecord } = useReadContract({
    address: L2_REGISTRY_ADDRESS,
    abi: registryAbi,
    functionName: "addr",
    args: [name.node, ROBINHOOD_COIN_TYPE],
    chainId: robinhoodChain.id,
    query: { enabled: Boolean(L2_REGISTRY_ADDRESS) },
  });

  const onChainValues: Record<string, string> = {
    avatar: avatar.data ?? "",
    "com.twitter": twitter.data ?? "",
    url: url.data ?? "",
    description: description.data ?? "",
    addr: addrRecord && addrRecord !== "0x" ? (addrRecord as string) : "",
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
  }, [avatar.data, twitter.data, url.data, description.data, addrRecord]);

  useEffect(() => {
    if (receipt.isSuccess && savingField) {
      track("record_saved", { method: savingField });
      setDirty((d) => {
        const next = new Set(d);
        next.delete(savingField);
        return next;
      });
      setSavingField(null);
      void avatar.refetch();
      void twitter.refetch();
      void url.refetch();
      void description.refetch();
      onSaved();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess]);

  function set(key: string, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty((d) => new Set(d).add(key));
  }

  async function ensureChain() {
    if (chainId !== robinhoodChain.id) {
      await switchChainAsync({ chainId: robinhoodChain.id });
    }
  }

  async function saveText(key: string) {
    if (!L2_REGISTRY_ADDRESS) return;
    setActionError(null);
    try {
      await ensureChain();
      const value =
        key === "com.twitter"
          ? normalizeXHandle(draft[key] ?? "")
          : draft[key] ?? "";
      setSavingField(key);
      await writeContractAsync({
        address: L2_REGISTRY_ADDRESS,
        abi: registryAbi,
        functionName: "setText",
        args: [name.node, key, value],
        chainId: robinhoodChain.id,
      });
    } catch (error) {
      setSavingField(null);
      setActionError(walletErrorMessage(error));
    }
  }

  async function saveAddr() {
    if (!L2_REGISTRY_ADDRESS) return;
    const value = (draft.addr ?? "").trim();
    if (!isAddress(value)) return;
    setActionError(null);
    try {
      await ensureChain();
      setSavingField("addr");
      // Point both this chain's record and mainnet ETH at the same address, so the name
      // resolves identically through the L1 resolver and on Robinhood Chain. Batched
      // through the registry's multicall so the user signs once, not twice.
      await writeContractAsync({
        address: L2_REGISTRY_ADDRESS,
        abi: registryAbi,
        functionName: "multicall",
        args: [
          [ROBINHOOD_COIN_TYPE, ETH_COIN_TYPE].map((coinType) =>
            encodeFunctionData({
              abi: registryAbi,
              functionName: "setAddr",
              args: [name.node, coinType, value as Address],
            })
          ),
        ],
        chainId: robinhoodChain.id,
      });
    } catch (error) {
      setSavingField(null);
      setActionError(walletErrorMessage(error));
    }
  }

  const addrValue = (draft.addr ?? "").trim();
  const addrValid = addrValue === "" || isAddress(addrValue);
  const busy = isPending || receipt.isLoading;
  const avatarPreview = avatarToUrl(draft.avatar ?? "");

  return (
    <div className="panel p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {avatarPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarPreview}
              alt=""
              className="h-11 w-11 rounded-full border border-[var(--line)] object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="grid h-11 w-11 place-items-center rounded-full border border-[var(--line)] text-sm text-[var(--faint)]">
              {name.label.slice(0, 2)}
            </div>
          )}
          <div>
            <div className="data text-base font-semibold break-all">
              {name.label}
              <span className="text-[var(--dim)]">.hoodfi.eth</span>
            </div>
            <a
              className="data text-xs text-[var(--faint)] underline"
              href={`${robinhoodChain.blockExplorers.default.url}/token/${L2_REGISTRY_ADDRESS}/instance/${name.tokenId}`}
              target="_blank"
              rel="noreferrer"
            >
              View NFT
            </a>
          </div>
        </div>
        <ShareOnX
          text={`${name.label}.hoodfi.eth is mine — a lifetime ENS name on Robinhood Chain.\n\nGet yours:`}
          eventLabel="manage"
        >
          Share
        </ShareOnX>
      </div>

      <div className="mt-6 flex flex-col gap-5">
        {/* Address record first — it's the one that makes the name actually resolve. */}
        <div>
          <label className="eyebrow" htmlFor={`addr-${name.label}`}>
            address it resolves to
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id={`addr-${name.label}`}
              className="input flex-1 data text-sm"
              placeholder={address ?? "0x…"}
              value={draft.addr ?? ""}
              onChange={(e) => set("addr", e.target.value)}
              spellCheck={false}
              autoCapitalize="none"
            />
            <button
              className="btn btn-ghost sm:w-32"
              onClick={saveAddr}
              disabled={
                busy || !addrValid || !dirty.has("addr") || addrValue === ""
              }
              type="button"
            >
              {savingField === "addr" && busy ? "Saving…" : "Save"}
            </button>
          </div>
          {!addrValid && (
            <div className="data mt-1 text-xs bad">
              That isn&apos;t a valid address
            </div>
          )}
        </div>

        {TEXT_FIELDS.map((field) => (
          <div key={field.key}>
            <label className="eyebrow" htmlFor={`${field.key}-${name.label}`}>
              {field.label}
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                id={`${field.key}-${name.label}`}
                className="input flex-1 text-sm"
                placeholder={field.placeholder}
                value={draft[field.key] ?? ""}
                onChange={(e) => set(field.key, e.target.value)}
                spellCheck={false}
                autoCapitalize="none"
              />
              <button
                className="btn btn-ghost sm:w-32"
                onClick={() => saveText(field.key)}
                disabled={busy || !dirty.has(field.key)}
                type="button"
              >
                {savingField === field.key && busy ? "Saving…" : "Save"}
              </button>
            </div>
            {field.help && (
              <p className="mt-1 text-xs text-[var(--faint)]">{field.help}</p>
            )}
          </div>
        ))}
      </div>

      {(actionError || error) && (
        <div className="data mt-4 break-words text-xs bad">
          {actionError ?? walletErrorMessage(error)}
        </div>
      )}
      {receipt.isSuccess && !savingField && (
        <div className="data mt-4 text-xs ok">✓ Record saved onchain.</div>
      )}

      <p className="data mt-5 text-[11px] leading-relaxed text-[var(--faint)]">
        Each record is one transaction on Robinhood Chain. You&apos;re the owner
        — these writes go straight to the registry, not through us.
      </p>
    </div>
  );
}

export function ManagePanel() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const { names, loading, error, reload } = useMyNames(address);

  if (!isConnected) {
    return (
      <div className="panel p-8 text-center">
        <h3 className="display text-xl">Connect to manage your names</h3>
        <p className="mt-2 text-sm text-[var(--dim)]">
          We&apos;ll list every *.hoodfi.eth name held by your wallet.
        </p>
        <button
          className="btn btn-primary mt-5"
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

  if (loading) {
    return (
      <div className="panel p-8 text-center">
        <div className="data text-sm text-[var(--dim)]">
          Loading your names…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel p-8 text-center">
        <div className="data text-sm bad">{error}</div>
        <button className="btn btn-ghost mt-4" onClick={reload} type="button">
          Try again
        </button>
      </div>
    );
  }

  if (names.length === 0) {
    return (
      <div className="panel p-8 text-center">
        <h3 className="display text-xl">No names yet</h3>
        <p className="mt-2 text-sm text-[var(--dim)]">
          Mint one and it shows up here, ready to point at your wallet.
        </p>
        <Link href="/mint/" className="btn btn-primary mt-5">
          Mint a name
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {names.map((name) => (
        <NameEditor key={name.node} name={name} onSaved={reload} />
      ))}
    </div>
  );
}
