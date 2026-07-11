"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { keccak256, toBytes } from "viem";
import { parseAbiItem } from "viem";
import { useAppKit } from "@reown/appkit/react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { publicClient } from "@/lib/wagmi";
import { ROBINHOOD_CHAIN_ID, ROBINHOOD_EXPLORER } from "@/lib/chains";
import {
  DONATIONS_ADDRESS,
  DONATIONS_DEPLOY_BLOCK,
  REGISTRAR_ADDRESS,
  USDC_ADDRESS,
  donationsAbi,
  registrarAbi,
  erc20Abi,
} from "@/lib/contracts";
import { checkLabel } from "@/lib/labels";
import { formatEth } from "@/lib/format";

const PHASE_LABEL = ["Not open yet", "Free claims open", "Public registration open"];

const reservedEvent = parseAbiItem(
  "event NameReserved(address indexed donor, bytes32 indexed labelhash, string label)"
);

function useMyReservations() {
  const { address } = useAccount();
  const [labels, setLabels] = useState<string[] | null>(null);

  useEffect(() => {
    if (!address || !DONATIONS_ADDRESS) {
      setLabels(null);
      return;
    }
    let cancelled = false;
    publicClient
      .getLogs({
        address: DONATIONS_ADDRESS,
        event: reservedEvent,
        args: { donor: address },
        fromBlock: DONATIONS_DEPLOY_BLOCK,
        toBlock: "latest",
      })
      .then((logs) => {
        if (!cancelled) setLabels(logs.map((l) => l.args.label as string));
      })
      .catch(() => {
        if (!cancelled) setLabels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  return labels;
}

function ClaimRow({ label, phase }: { label: string; phase: number }) {
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: txHash, chainId: ROBINHOOD_CHAIN_ID });

  const labelhash = keccak256(toBytes(label));
  const { data: reservedFor, refetch } = useReadContract({
    address: REGISTRAR_ADDRESS,
    abi: registrarAbi,
    functionName: "reservations",
    args: [labelhash],
    chainId: ROBINHOOD_CHAIN_ID,
    query: { enabled: Boolean(REGISTRAR_ADDRESS) },
  });

  useEffect(() => {
    if (receipt.isSuccess) refetch();
  }, [receipt.isSuccess, refetch]);

  const claimed =
    reservedFor !== undefined &&
    reservedFor === "0x0000000000000000000000000000000000000000";
  const claimable =
    phase > 0 && reservedFor && address && reservedFor.toLowerCase() === address.toLowerCase();

  async function claim() {
    if (!REGISTRAR_ADDRESS) return;
    if (chainId !== ROBINHOOD_CHAIN_ID) {
      await switchChainAsync({ chainId: ROBINHOOD_CHAIN_ID });
    }
    await writeContractAsync({
      address: REGISTRAR_ADDRESS,
      abi: registrarAbi,
      functionName: "claim",
      args: [label],
      chainId: ROBINHOOD_CHAIN_ID,
    });
  }

  return (
    <div className="ledger-row items-center">
      <span className="data text-sm">
        {label}
        <span className="text-[var(--faint)]">.hoodfi.eth</span>
      </span>
      {receipt.isSuccess || claimed ? (
        <span className="data text-xs ok">✓ claimed</span>
      ) : claimable ? (
        <button className="btn btn-primary !px-4 !py-2 text-xs" onClick={claim} disabled={isPending || receipt.isLoading}>
          {isPending ? "Confirm…" : receipt.isLoading ? "Minting…" : "Claim free"}
        </button>
      ) : (
        <span className="data text-xs text-[var(--faint)]">
          {phase === 0 ? "waiting for launch" : "…"}
        </span>
      )}
    </div>
  );
}

function MintSearch({ phase }: { phase: number }) {
  const [input, setInput] = useState("");
  const [payUsdc, setPayUsdc] = useState(false);
  const { address, isConnected, chainId } = useAccount();
  const { open } = useAppKit();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, data: txHash, isPending, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: txHash, chainId: ROBINHOOD_CHAIN_ID });

  const check = checkLabel(input, false);
  const label = check.ok ? check.label : "";

  const { data: status } = useReadContract({
    address: REGISTRAR_ADDRESS,
    abi: registrarAbi,
    functionName: "status",
    args: [label],
    chainId: ROBINHOOD_CHAIN_ID,
    query: { enabled: Boolean(REGISTRAR_ADDRESS) && Boolean(label) },
  });

  const { data: price } = useReadContract({
    address: REGISTRAR_ADDRESS,
    abi: registrarAbi,
    functionName: "priceOf",
    args: [label],
    chainId: ROBINHOOD_CHAIN_ID,
    query: { enabled: Boolean(REGISTRAR_ADDRESS) && Boolean(label) },
  });

  const { data: allowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: [
      address ?? "0x0000000000000000000000000000000000000000",
      REGISTRAR_ADDRESS ?? "0x0000000000000000000000000000000000000000",
    ],
    chainId: ROBINHOOD_CHAIN_ID,
    query: {
      enabled: Boolean(USDC_ADDRESS) && Boolean(REGISTRAR_ADDRESS) && Boolean(address) && payUsdc,
    },
  });

  const verdict = !input
    ? null
    : !check.ok
      ? { text: check.reason, cls: "warn" }
      : status === undefined
        ? { text: "checking…", cls: "warn" }
        : status === 0
          ? { text: "available", cls: "ok" }
          : status === 1
            ? { text: "taken", cls: "bad" }
            : status === 2
              ? { text: "reserved by a donor", cls: "warn" }
              : { text: "invalid name", cls: "bad" };

  const usdcPrice = price?.[1] ?? 0n;
  const weiPrice = price?.[0] ?? 0n;
  const needsApproval = payUsdc && (allowance ?? 0n) < usdcPrice;

  async function mint() {
    if (!REGISTRAR_ADDRESS || !label) return;
    if (!isConnected) {
      open();
      return;
    }
    if (chainId !== ROBINHOOD_CHAIN_ID) {
      await switchChainAsync({ chainId: ROBINHOOD_CHAIN_ID });
    }
    if (payUsdc) {
      if (!USDC_ADDRESS) return;
      if (needsApproval) {
        await writeContractAsync({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: [REGISTRAR_ADDRESS, usdcPrice],
          chainId: ROBINHOOD_CHAIN_ID,
        });
        return;
      }
      await writeContractAsync({
        address: REGISTRAR_ADDRESS,
        abi: registrarAbi,
        functionName: "registerWithUsdc",
        args: [label],
        chainId: ROBINHOOD_CHAIN_ID,
      });
    } else {
      await writeContractAsync({
        address: REGISTRAR_ADDRESS,
        abi: registrarAbi,
        functionName: "register",
        args: [label],
        value: weiPrice,
        chainId: ROBINHOOD_CHAIN_ID,
      });
    }
  }

  return (
    <div className="panel p-6 sm:p-8">
      <h3 className="display text-xl">Register a name</h3>
      <p className="mt-1 text-sm text-[var(--dim)]">
        {phase === 2
          ? "Public registration is live. One-time price, lifetime name."
          : "Opens right after donor claims begin. Prices below are final."}
      </p>

      <div className="relative mt-5">
        <input
          className="input pr-24"
          placeholder="yourname"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          autoCapitalize="none"
        />
        <span className="data pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--faint)]">
          .hoodfi.eth
        </span>
      </div>
      {verdict && <div className={`data mt-2 text-xs ${verdict.cls}`}>{verdict.text}</div>}

      {label && status === 0 && (
        <>
          <div className="mt-4">
            <div className="ledger-row">
              <span className="text-sm text-[var(--dim)]">Price</span>
              <span className="data text-sm">
                {payUsdc
                  ? `${(Number(usdcPrice) / 1e6).toFixed(2)} USDG`
                  : weiPrice > 0n
                    ? `${formatEth(weiPrice)} ETH`
                    : "…"}
              </span>
            </div>
            <div className="ledger-row">
              <span className="text-sm text-[var(--dim)]">Pay with</span>
              <span className="flex gap-2">
                <button
                  className={`data text-xs ${!payUsdc ? "ok" : "text-[var(--faint)]"}`}
                  onClick={() => setPayUsdc(false)}
                  type="button"
                >
                  ETH
                </button>
                <span className="text-[var(--faint)]">/</span>
                <button
                  className={`data text-xs ${payUsdc ? "ok" : "text-[var(--faint)]"}`}
                  onClick={() => setPayUsdc(true)}
                  type="button"
                  disabled={!USDC_ADDRESS}
                >
                  USDG
                </button>
              </span>
            </div>
          </div>

          <button
            className="btn btn-primary mt-5 w-full"
            onClick={mint}
            disabled={phase !== 2 || isPending || receipt.isLoading}
            type="button"
          >
            {phase !== 2
              ? "Not open yet"
              : !isConnected
                ? "Connect to register"
                : isPending
                  ? "Confirm in wallet…"
                  : receipt.isLoading
                    ? "Registering…"
                    : needsApproval
                      ? `Approve ${(Number(usdcPrice) / 1e6).toFixed(2)} USDG`
                      : `Register ${label}.hoodfi.eth`}
          </button>
        </>
      )}

      {receipt.isSuccess && txHash && (
        <div className="data mt-3 text-xs ok">
          ✓ done.{" "}
          <a className="underline" href={`${ROBINHOOD_EXPLORER}/tx/${txHash}`} target="_blank" rel="noreferrer">
            View on Blockscout
          </a>
        </div>
      )}
      {error && (
        <div className="data mt-3 break-words text-xs bad">{error.message.split("\n")[0]}</div>
      )}
    </div>
  );
}

export default function ClaimPage() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const myLabels = useMyReservations();

  const { data: phaseData } = useReadContract({
    address: REGISTRAR_ADDRESS,
    abi: registrarAbi,
    functionName: "phase",
    chainId: ROBINHOOD_CHAIN_ID,
    query: { enabled: Boolean(REGISTRAR_ADDRESS), refetchInterval: 30_000 },
  });
  const phase = Number(phaseData ?? 0);

  const { data: finalized } = useReadContract({
    address: DONATIONS_ADDRESS,
    abi: donationsAbi,
    functionName: "finalized",
    chainId: 1,
    query: { enabled: Boolean(DONATIONS_ADDRESS) },
  });

  const dedupedLabels = useMemo(() => [...new Set(myLabels ?? [])], [myLabels]);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="pt-16 sm:pt-20">
          <Reveal>
            <div className="eyebrow flex items-center gap-2">
              <span className={phase > 0 ? "live-dot" : ""} aria-hidden />
              launch status: {PHASE_LABEL[phase] ?? "—"}
            </div>
            <h1 className="display mt-4 text-3xl sm:text-5xl">
              {phase === 0 ? "Claims open at 1,000 years." : "Claim day."}
            </h1>
            <p className="mt-4 max-w-xl text-sm text-[var(--dim)] sm:text-base">
              {phase === 0 && !finalized
                ? "When the donation goal is reached, this page turns into the claim desk. Reserved names mint free — you pay only Robinhood Chain gas."
                : "Donors: your reserved names are below, free to mint. Everyone else: search and register."}
            </p>
          </Reveal>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-2">
          <Reveal>
            <div className="panel p-6 sm:p-8">
              <h3 className="display text-xl">Your reserved names</h3>
              {!isConnected ? (
                <>
                  <p className="mt-2 text-sm text-[var(--dim)]">
                    Connect the wallet you donated with to see your reservations.
                  </p>
                  <button className="btn btn-ghost mt-5" onClick={() => open()}>
                    Connect
                  </button>
                </>
              ) : myLabels === null ? (
                <p className="data mt-4 text-sm text-[var(--faint)]">reading chain…</p>
              ) : dedupedLabels.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--dim)]">
                  No reservations found for {address?.slice(0, 8)}… — donate on the home
                  page to earn name slots.
                </p>
              ) : (
                <div className="mt-4">
                  {dedupedLabels.map((l) => (
                    <ClaimRow key={l} label={l} phase={phase} />
                  ))}
                </div>
              )}
            </div>
          </Reveal>
          <Reveal delay={80}>
            <MintSearch phase={phase} />
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  );
}
