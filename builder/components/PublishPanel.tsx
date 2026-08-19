"use client";

import { useState } from "react";
import { keccak256, sha256, stringToBytes, toBytes, type Hex } from "viem";
import {
  useAccount,
  usePublicClient,
  useSignMessage,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { ArrowNE } from "./ArrowNE";
import { robinhoodChain } from "@/lib/chains";
import { L2_REGISTRY_ADDRESS, SITES_ADDRESS, registryAbi, sitesAbi } from "@/lib/contracts";
import {
  SIGNATURE_LIFETIME_MS,
  confirmSite,
  pinSite,
  publishedUrl,
  sitePublishMessage,
} from "@/lib/publish";
import { encodeContenthash } from "@/shared/contenthash";
import type { OwnedName } from "./useMyNames";
import type { TemplateId } from "@/lib/templates/index.ts";

type Props = {
  name: OwnedName;
  templateId: TemplateId;
  html: string;
};

type Step = "idle" | "signing" | "pinning" | "paying" | "confirming" | "linking" | "done";

const LABELS: Record<Step, string> = {
  idle: "",
  signing: "Waiting for your signature…",
  pinning: "Pinning your site to IPFS…",
  paying: "Confirm the payment in your wallet…",
  confirming: "Checking the payment on chain…",
  linking: "Point your name at the site…",
  done: "Live.",
};

/**
 * Publishing, as four things the owner does and two the gateway does.
 *
 * The sequence is fixed by the fact that a payment names a CID: pin, pay, confirm, then
 * write the record. The last step is the owner's own transaction on their own name —
 * this app never holds a key to it, and that is the property worth protecting even
 * though it costs a second signature.
 *
 * Every step is reported by name. A single spinner over a flow with two wallet prompts
 * and a chain read is how somebody ends up paying twice.
 */
export function PublishPanel({ name, templateId, html }: Props) {
  const { address, chainId, isConnected, connector } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();
  /**
   * Writes go through wagmi's connector, not through a viem wallet client we hold.
   *
   * useWalletClient has to obtain a provider from the WalletConnect connector, and when
   * the relay socket to the phone is not live at that instant it resolves to undefined —
   * while every stored record still says connected. Captured state from a real failure
   * showed exactly that: status connected, a live wagmi connection on 4663, both chains
   * in requestedChains, nothing in the disconnected list, and still no client. Gating on
   * it produced a dead button, and reporting it produced a true but useless sentence.
   *
   * writeContractAsync asks the connector at the moment of the write, which is also what
   * wakes the session and deep-links the wallet app. There is nothing to hold and
   * nothing to be stale.
   */
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient({ chainId: robinhoodChain.id });

  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cid, setCid] = useState<string | null>(null);
  const [needsReset, setNeedsReset] = useState(false);

  const configured = Boolean(SITES_ADDRESS && L2_REGISTRY_ADDRESS);

  /**
   * Why the button is off, in words, or null when it is on.
   *
   * Gating on `wallet` was wrong: useWalletClient is chain-scoped and resolves
   * asynchronously, so it is undefined for a moment on every load and indefinitely if the
   * connector is in a bad state — and the only signal was a button that would not light
   * up. A disabled control that cannot say why is the same failure as an error message
   * that says nothing, which this project has now hit several times.
   */
  // A rehydrated connector stub has no methods on it — see ConnectionGuard. Catching it
  // here means the failure is named before a signature is requested, rather than
  // surfacing as "connector.getChainId is not a function" halfway through publishing.
  const stubConnector = Boolean(
    isConnected && connector && typeof connector.getChainId !== "function"
  );

  const blocked: string | null = !configured
    ? "Publishing isn't configured in this deployment yet."
    : !isConnected
      ? "Connect the wallet holding this name to publish."
      : stubConnector
        ? "Your wallet session was restored without a working link. Reset it below, then reconnect."
        : null;

  async function run() {
    if (!SITES_ADDRESS || !L2_REGISTRY_ADDRESS) return;
    setError(null);

    if (!address || !client) {
      setError("Your wallet isn't connected. Reconnect and try again.");
      return;
    }

    try {
      // Both writes are on Robinhood Chain. Switching inside the same try as the writes
      // matters: a rejected switch escapes an async onClick as an unhandled promise and
      // the button silently does nothing.
      if (chainId !== robinhoodChain.id) {
        setStep("signing");
        await switchChainAsync({ chainId: robinhoodChain.id });
      }

      // ── 1. Sign, so the gateway will pin for this name ──────────────────────
      setStep("signing");
      const bytes = new TextEncoder().encode(html);
      const expiry = Date.now() + SIGNATURE_LIFETIME_MS;
      const signature = await signMessageAsync({
        message: sitePublishMessage(`${name.label}.hoodfi.eth`, sha256(bytes), expiry),
      });

      // ── 2. Pin, which is what gives the payment something to name ───────────
      setStep("pinning");
      const pinned = await pinSite({
        label: name.label,
        html,
        templateId,
        signature: signature as Hex,
        expiry,
      });
      setCid(pinned.cid);

      // ── 3. Pay for that exact CID, unless it is already paid for ────────────
      //
      // Resumable on purpose. A publish can fail AFTER the payment lands — the confirm
      // step or the record write can throw, or a laptop can close — and re-running would
      // then hit AlreadyPaid and revert, stranding somebody who has already paid with no
      // way to finish. Identical content produces an identical CID, so asking the chain
      // first turns a retry into a resume. It happened on the first real publish.
      setStep("paying");
      const templateHash = keccak256(stringToBytes(templateId));

      const alreadyPaid = (await client.readContract({
        address: SITES_ADDRESS,
        abi: sitesAbi,
        functionName: "isPaid",
        args: [name.node, pinned.cid],
      })) as boolean;

      if (!alreadyPaid) {

      // Simulate against our own RPC first. A wallet that estimates on its own node can
      // drop the revert payload entirely — that is the Brave signature — and the person
      // is then asked to sign a transaction that was always going to fail.
      //
      // The simulate is for the REVERT REASON only; its `request` is deliberately not
      // forwarded to writeContract. That object carries a chain inherited from whatever
      // the public client resolved to, and handing it straight over is what produced
      // "the current chain of the wallet (id: 4663) does not match the target chain for
      // the transaction (id: 1 – Ethereum)". Every write below names its chain outright.
        await client.simulateContract({
          address: SITES_ADDRESS,
          abi: sitesAbi,
          functionName: "publish",
          args: [name.node, templateHash, pinned.cid],
          account: address,
          value: 0n,
        });
        const payHash = await writeContractAsync({
          address: SITES_ADDRESS,
          abi: sitesAbi,
          functionName: "publish",
          args: [name.node, templateHash, pinned.cid],
          value: 0n,
          chainId: robinhoodChain.id,
        });
        await client.waitForTransactionReceipt({ hash: payHash, timeout: 180_000 });
      }

      // ── 4. Tell the gateway to keep it. Retried, because isPaid cannot see the
      //       payment until it is mined and a wallet returns before that. ───────
      setStep("confirming");
      let confirmed = false;
      for (let attempt = 0; attempt < 5 && !confirmed; attempt++) {
        try {
          await confirmSite(name.label, pinned.cid);
          confirmed = true;
        } catch (err) {
          if (attempt === 4) throw err;
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      // ── 5. The owner points their own name at it ────────────────────────────
      setStep("linking");
      const encoded = encodeContenthash(`ipfs://${pinned.cid}`);
      if (!encoded) throw new Error("Could not encode the contenthash for that CID.");

      const linkHash = await writeContractAsync({
        address: L2_REGISTRY_ADDRESS,
        abi: registryAbi,
        functionName: "setContenthash",
        args: [name.node, encoded],
        chainId: robinhoodChain.id,
      });
      await client.waitForTransactionReceipt({ hash: linkHash, timeout: 180_000 });

      setStep("done");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Never echo a raw viem error: they embed the full RPC URL, key included.
      const cancelled = /user rejected|denied/i.test(message);
      const unreachable =
        /timeout|no matching key|session|expired|not connected|provider|is not a function/i.test(
          message
        );
      if (unreachable && !cancelled) setNeedsReset(true);
      setError(
        cancelled
          ? "You cancelled that in your wallet."
          : unreachable
            ? "Your wallet didn't answer. Open the wallet app so it can receive the request, then try again."
            : message.split("\n")[1]?.trim() || message.split("\n")[0]?.trim() || "That didn't work."
      );
      setStep("idle");
    }
  }

  function resetSession() {
    try {
      Object.keys(window.localStorage)
        .filter((k) => /^(@appkit\/|wagmi\.|wc@|walletconnect)/i.test(k))
        .forEach((k) => window.localStorage.removeItem(k));
    } catch {
      // Private mode; the reload below still helps more often than not.
    }
    window.location.reload();
  }

  if (step === "done") {
    return (
      <div className="on-ink panel-ink shadow-hero border border-[var(--ink)] p-7">
        <span className="label">Published</span>
        <p className="mt-4 text-[19px] font-semibold leading-[1.35] tracking-[-0.02em] text-[var(--fg)]">
          {name.label}.hoodfi.eth is a website.
        </p>
        <a
          className="btn btn-lime mt-6 w-full"
          href={publishedUrl(name.label)}
          rel="noreferrer"
          target="_blank"
        >
          Open it <ArrowNE />
        </a>
        <p className="mt-4 break-all text-[12px] leading-[1.6] text-[var(--faint)]">
          <span className="data">ipfs://{cid}</span>
        </p>
        <p className="mt-3 text-[13px] leading-[1.6] text-[var(--faint)]">
          Gateways cache aggressively, so the first load can take a minute. Nothing else
          is needed from you — the record is written.
        </p>
      </div>
    );
  }

  const busy = step !== "idle";

  return (
    <div className="on-ink panel-ink shadow-hero border border-[var(--ink)] p-7">
      <span className="label">Publish</span>
      <p className="mt-4 max-w-[40ch] text-[15px] leading-[1.6] text-[var(--dim)]">
        Two signatures: one to pay, one to point your name at the finished site. The
        record is written by you, from your wallet — we never hold a key to your name.
      </p>

      {blocked ? (
        <p className="mt-6 text-[14px] leading-[1.6] text-[var(--warn)]">{blocked}</p>
      ) : null}

      <button
        className="btn btn-lime mt-6 w-full"
        disabled={busy || blocked !== null}
        onClick={run}
        type="button"
      >
        {busy ? LABELS[step] : "Publish this site"}
        {busy ? null : <ArrowNE />}
      </button>

      {error ? (
        <p className="mt-4 text-[14px] leading-[1.6] text-[var(--bad)]">{error}</p>
      ) : null}

      {needsReset || stubConnector ? (
        <>
          <button className="btn btn-ghost btn-sm mt-4 w-full" onClick={resetSession} type="button">
            Reset wallet session and reload
          </button>
          <p className="mt-3 text-[12.5px] leading-[1.6] text-[var(--faint)]">
            This clears the stored session only. It cannot touch your wallet, your names or
            your draft — the draft is saved and will still be here.
          </p>
        </>
      ) : null}

      {cid && step !== "idle" ? (
        <p className="data mt-4 break-all text-[11.5px] leading-[1.6] text-[var(--faint)]">
          {cid}
        </p>
      ) : null}
    </div>
  );
}
