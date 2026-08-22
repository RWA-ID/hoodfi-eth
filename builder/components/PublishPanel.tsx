"use client";

import { useState } from "react";
import { sha256, type Hex } from "viem";
import {
  useAccount,
  usePublicClient,
  useSignMessage,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { ArrowNE } from "./ArrowNE";
import { robinhoodChain } from "@/lib/chains";
import {
  L2_REGISTRY_ADDRESS,
  SITES_ADDRESS,
  USDG_ADDRESS,
  erc20Abi,
  registryAbi,
  sitesAbi,
} from "@/lib/contracts";
import { formatEth, formatUsdg } from "@/lib/format";
import {
  SIGNATURE_LIFETIME_MS,
  confirmSite,
  pinSite,
  publishedUrl,
  sitePublishMessage,
} from "@/lib/publish";
import { encodeContenthash } from "@/shared/contenthash";
import { templateHash, useQuote } from "./useQuote";
import { useUsdg } from "./useUsdg";
import type { OwnedName } from "./useMyNames";
import type { TemplateId } from "@/lib/templates/index.ts";

type Props = {
  name: OwnedName;
  templateId: TemplateId;
  html: string;
  /**
   * The headline as typed, which is empty until the owner chooses one.
   *
   * Passed separately rather than sniffed out of `html`, because by the time it reaches
   * `html` the editor has already substituted its stand-in and the two are
   * indistinguishable — which is exactly the string that must never be pinned.
   */
  displayName: string;
};

type Step =
  | "idle"
  | "signing"
  | "pinning"
  | "approving"
  | "paying"
  | "confirming"
  | "linking"
  | "done";

const LABELS: Record<Step, string> = {
  idle: "",
  signing: "Waiting for your signature…",
  pinning: "Pinning your site to IPFS…",
  approving: "Approve USDG in your wallet…",
  paying: "Confirm the payment in your wallet…",
  confirming: "Checking the payment on chain…",
  linking: "Point your name at the site…",
  done: "Live.",
};

/** Which token the publish is paid in. */
type Currency = "eth" | "usdg";

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
export function PublishPanel({ name, templateId, html, displayName }: Props) {
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
  const quote = useQuote(name.node, templateId, address);
  const usdg = useUsdg(address);

  /**
   * ETH by default because it needs no token and one fewer transaction. USDG is the
   * exact-dollar option and is offered beside it, not instead of it.
   */
  const [currency, setCurrency] = useState<Currency>("eth");

  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cid, setCid] = useState<string | null>(null);
  /**
   * What this panel actually put on chain, and the exact bytes it was.
   *
   * Kept so the finished state can be checked against the editor rather than trusted:
   * a success screen that outlives the content it describes is the same lie as one that
   * outlives the name it describes.
   */
  const [published, setPublished] = useState<{ html: string; cid: string } | null>(null);
  const [needsReset, setNeedsReset] = useState(false);
  const [copied, setCopied] = useState(false);

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

  // An if-chain rather than the ternary this used to be: the price states doubled its
  // length, and a six-deep nested ternary beside a payment button is not worth the
  // symmetry.
  function whyBlocked(): string | null {
    if (!configured) return "Publishing isn't configured in this deployment yet.";
    if (!isConnected) return "Connect the wallet holding this name to publish.";
    if (stubConnector) {
      return "Your wallet session was restored without a working link. Reset it below, then reconnect.";
    }
    if (!displayName.trim()) {
      return "Give your site a headline first — it's the big line at the top, and it's yours to choose.";
    }
    // Never let the button run without a price in hand. Publishing with an unread price
    // is what sent `value: 0` for the whole free period — harmless then, a guaranteed
    // InsufficientPayment revert the moment a price is set.
    if (quote.status === "loading") return "Checking the price…";
    if (quote.status === "unreachable") {
      return "Couldn't read the publishing price from Robinhood Chain. Reload the page and try again.";
    }
    if (quote.status === "ok" && !quote.quote.eligible) {
      return "That template isn't available to this wallet. Pick another one.";
    }

    if (currency === "usdg" && quote.status === "ok" && quote.quote.usdgPrice > 0n) {
      if (!USDG_ADDRESS) return "Paying in USDG isn't configured in this deployment.";
      if (usdg.status === "loading") return "Checking your USDG balance…";
      if (usdg.status === "unconfigured") {
        return "Paying in USDG isn't configured in this deployment.";
      }
      // Not "you have none" — see useUsdg. A read that did not happen must not be
      // reported as an empty wallet.
      if (usdg.status === "unreachable") {
        return "Couldn't read your USDG balance. Reload the page, or pay in ETH instead.";
      }
      // Said here rather than discovered at the transfer, which is the moment it costs
      // gas and reads as a broken button.
      if (usdg.balance < quote.quote.usdgPrice) {
        return `You need ${formatUsdg(quote.quote.usdgPrice)} USDG to publish and this wallet holds ${formatUsdg(usdg.balance)}. Pay in ETH instead, or top up.`;
      }
    }

    return null;
  }

  const blocked = whyBlocked();

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
        // The whole path. This string is the name as far as the gateway is concerned:
        // it recovers the signer against it, pins under it, and later reads isPaid at its
        // namehash. Signing the leftmost label instead authorised a different name and
        // stranded the payment — see `pathBelowRoot`.
        message: sitePublishMessage(`${name.path}.hoodfi.eth`, sha256(bytes), expiry),
      });

      // ── 2. Pin, which is what gives the payment something to name ───────────
      setStep("pinning");
      const pinned = await pinSite({
        path: name.path,
        html,
        templateId,
        signature: signature as Hex,
        expiry,
      });
      setCid(pinned.cid);

      // The gateway derived a node from the path we sent it. If that disagrees with the
      // node we are about to pay on, the two halves of this protocol are addressing
      // different names — which is exactly how a publish once got paid for on
      // crypto.gm.hoodfi.eth and then confirmed against crypto.hoodfi.eth, failing with
      // "No payment found" over a payment that had landed. Stop before the money moves,
      // not after.
      if (pinned.node.toLowerCase() !== name.node.toLowerCase()) {
        throw new Error(
          "That site was pinned against a different name than the one selected. Reload the page and try again."
        );
      }

      // ── 3. Pay for that exact CID, unless it is already paid for ────────────
      //
      // Resumable on purpose. A publish can fail AFTER the payment lands — the confirm
      // step or the record write can throw, or a laptop can close — and re-running would
      // then hit AlreadyPaid and revert, stranding somebody who has already paid with no
      // way to finish. Identical content produces an identical CID, so asking the chain
      // first turns a retry into a resume. It happened on the first real publish.
      setStep("paying");
      const template = templateHash(templateId);

      const alreadyPaid = (await client.readContract({
        address: SITES_ADDRESS,
        abi: sitesAbi,
        functionName: "isPaid",
        args: [name.node, pinned.cid],
      })) as boolean;

      if (!alreadyPaid) {
        // Priced again here rather than trusting the number on screen. The displayed
        // quote can be up to a cache-lifetime old, and the owner can call setPrices
        // between a page load and a click — this is the figure the contract will actually
        // check the payment against.
        const [weiPrice, usdgPrice] = (await client.readContract({
          address: SITES_ADDRESS,
          abi: sitesAbi,
          functionName: "quote",
          args: [name.node, template, address],
        })) as readonly [bigint, bigint, boolean, bigint];

        const price = currency === "usdg" ? usdgPrice : weiPrice;
        const shown =
          quote.status === "ok"
            ? currency === "usdg"
              ? quote.quote.usdgPrice
              : quote.quote.weiPrice
            : null;

        // Charging more than was shown, without saying so, is the one failure here that
        // costs somebody money quietly. Underpaying only ever reverts, so a price that
        // moved DOWN needs no ceremony — it is simply charged.
        if (shown !== null && price > shown) {
          throw new Error(
            `The price changed while you were editing — it is now ${
              currency === "usdg" ? `${formatUsdg(price)} USDG` : `${formatEth(price)} ETH`
            }. Reload the page to publish at the new price.`
          );
        }

      // Simulate against our own RPC first. A wallet that estimates on its own node can
      // drop the revert payload entirely — that is the Brave signature — and the person
      // is then asked to sign a transaction that was always going to fail.
      //
      // The simulate is for the REVERT REASON only; its `request` is deliberately not
      // forwarded to writeContract. That object carries a chain inherited from whatever
      // the public client resolved to, and handing it straight over is what produced
      // "the current chain of the wallet (id: 4663) does not match the target chain for
      // the transaction (id: 1 – Ethereum)". Every write below names its chain outright.
        if (currency === "usdg") {
          if (!USDG_ADDRESS) throw new Error("Paying in USDG isn't configured here.");

          // Approve exactly the price, never an unlimited allowance. It is spent to zero
          // by the transfer below, so the next publish approves again from a clean slate
          // — which also sidesteps the ERC-20 wart where a non-zero allowance cannot be
          // changed to another non-zero one without a reset in between.
          //
          // Read fresh rather than reusing the hook's value: an approval granted in
          // another tab, or the leftovers of a publish that failed after approving,
          // both make a second approval pointless.
          const allowance = (await client.readContract({
            address: USDG_ADDRESS,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address, SITES_ADDRESS],
          })) as bigint;

          if (allowance < price) {
            setStep("approving");
            const approveHash = await writeContractAsync({
              address: USDG_ADDRESS,
              abi: erc20Abi,
              functionName: "approve",
              args: [SITES_ADDRESS, price],
              chainId: robinhoodChain.id,
            });
            await client.waitForTransactionReceipt({ hash: approveHash, timeout: 180_000 });
          }

          setStep("paying");
          await client.simulateContract({
            address: SITES_ADDRESS,
            abi: sitesAbi,
            functionName: "publishWithUsdg",
            args: [name.node, template, pinned.cid],
            account: address,
          });
          const payHash = await writeContractAsync({
            address: SITES_ADDRESS,
            abi: sitesAbi,
            functionName: "publishWithUsdg",
            args: [name.node, template, pinned.cid],
            chainId: robinhoodChain.id,
          });
          await client.waitForTransactionReceipt({ hash: payHash, timeout: 180_000 });
        } else {
          await client.simulateContract({
            address: SITES_ADDRESS,
            abi: sitesAbi,
            functionName: "publish",
            args: [name.node, template, pinned.cid],
            account: address,
            value: price,
          });
          const payHash = await writeContractAsync({
            address: SITES_ADDRESS,
            abi: sitesAbi,
            functionName: "publish",
            args: [name.node, template, pinned.cid],
            value: price,
            chainId: robinhoodChain.id,
          });
          await client.waitForTransactionReceipt({ hash: payHash, timeout: 180_000 });
        }
      }

      // ── 4. Tell the gateway to keep it. Retried, because isPaid cannot see the
      //       payment until it is mined and a wallet returns before that. ───────
      setStep("confirming");
      let confirmed = false;
      for (let attempt = 0; attempt < 5 && !confirmed; attempt++) {
        try {
          // Must be the same string the payment's node was derived from, or the gateway
          // checks a different name and answers "No payment found" over a payment that
          // did land.
          await confirmSite(name.path, pinned.cid);
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

      setPublished({ html, cid: pinned.cid });
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

  /**
   * Editing after publishing drops back to the publish button.
   *
   * The name still serves what was published, so leaving "Live." on screen over a site
   * that has since been edited tells someone their changes are out there when nothing
   * has been pinned or paid for. Publishing again is a new CID, a new payment and a new
   * record — the button is the honest thing to show.
   *
   * Adjusted during render rather than in an effect, so the stale success screen is never
   * painted. `html` is memoised on the editor's data and the templates are deterministic,
   * which is the same property the resume path depends on, so this compares equal until
   * something is actually typed.
   */
  if (step === "done" && published && published.html !== html) {
    setStep("idle");
  }

  if (step === "done") {
    return (
      <div className="on-ink panel-ink shadow-hero border border-[var(--ink)] p-7">
        <span className="label">Published</span>
        <p className="mt-4 text-[19px] font-semibold leading-[1.35] tracking-[-0.02em] text-[var(--fg)]">
          {name.path}.hoodfi.eth is a website.
        </p>
        <a
          className="btn btn-lime mt-6 w-full"
          href={publishedUrl(name.path)}
          rel="noreferrer"
          target="_blank"
        >
          Open it <ArrowNE />
        </a>

        {/*
          The CID, offered to be kept.
          
          This is the one piece of the transaction that is not recoverable from anywhere
          we control: it is the address of their site on IPFS, it is what their name
          points at, and it is what lets them re-pin the site elsewhere if this service
          ever stops existing. That last part is the actual promise being made — "you own
          this" is only true if they hold the thing they own.
        */}
        <div className="mt-6 border border-[var(--line-card)] p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="label">Your site&rsquo;s address on IPFS</span>
            <button
              className="data cursor-pointer text-[11px] uppercase tracking-[0.14em] text-[var(--lime)] underline underline-offset-4"
              onClick={() => {
                if (!cid) return;
                navigator.clipboard?.writeText(cid).then(
                  () => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  },
                  () => {}
                );
              }}
              type="button"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="data mt-3 break-all text-[12.5px] leading-[1.6] text-[var(--fg)]">{cid}</p>
          <p className="mt-3 text-[13px] leading-[1.6] text-[var(--dim)]">
            <strong className="text-[var(--fg)]">Save this somewhere.</strong> It is the
            permanent address of your site. With it you can pin the site yourself, or point
            any name you own at it, without needing us at all.
          </p>
        </div>

        <p className="mt-4 text-[13px] leading-[1.6] text-[var(--faint)]">
          Gateways cache aggressively, so the first load can take a minute. Nothing else is
          needed from you — the record is written.
        </p>
      </div>
    );
  }

  const busy = step !== "idle";
  // Whether the editor currently differs from what is live. Not simply "has published
  // once": editing away and back leaves the live site correct, and a notice saying
  // otherwise would be telling someone to publish something already published.
  const editedSincePublish = published !== null && published.html !== html;

  return (
    <div className="on-ink panel-ink shadow-hero border border-[var(--ink)] p-7">
      <span className="label">Publish</span>
      <p className="mt-4 max-w-[40ch] text-[15px] leading-[1.6] text-[var(--dim)]">
        {currency === "usdg" &&
        quote.status === "ok" &&
        quote.quote.usdgPrice > 0n
          ? "Three signatures: one to approve the USDG, one to pay, one to point your name at "
          : "Two signatures: one to pay, one to point your name at "}
        {published ? "the new version" : "the finished site"}. The record is written by
        you, from your wallet — we never hold a key to your name.
      </p>

      {/*
        The price, before the button rather than in the wallet dialog.

        Shown only from a quote that actually landed — a loading or unreachable read
        renders nothing here and blocks the button instead, because the one number that
        must never be guessed at is the one someone is about to pay. The republish wording
        comes from `publishCount`, so it says what this name will really be charged rather
        than what a first-time publisher would be.
      */}
      {quote.status === "ok" ? (
        <div className="mt-6 border border-[var(--line-card)] p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="label">
              {quote.quote.publishCount === 0n ? "To publish" : "To republish"}
            </span>
            <span className="data text-[15px] text-[var(--fg)]">
              {(currency === "usdg" ? quote.quote.usdgPrice : quote.quote.weiPrice) === 0n
                ? "Free"
                : currency === "usdg"
                  ? `${formatUsdg(quote.quote.usdgPrice)} USDG`
                  : `${formatEth(quote.quote.weiPrice)} ETH`}
            </span>
          </div>

          {/*
            The currency choice, offered only when there is something to pay. While
            publishing is free both buttons would charge nothing, and asking somebody to
            choose how to pay zero is a decision with no consequence.

            USDG is hidden rather than disabled when this deployment has no token
            configured: an option that cannot ever work is not a choice.
          */}
          {(quote.quote.weiPrice > 0n || quote.quote.usdgPrice > 0n) && USDG_ADDRESS ? (
            <div className="mt-4 flex gap-2">
              {(["eth", "usdg"] as const).map((option) => (
                <button
                  aria-pressed={currency === option}
                  className={`btn btn-sm flex-1 ${currency === option ? "btn-lime" : "btn-ghost"}`}
                  disabled={busy}
                  key={option}
                  onClick={() => setCurrency(option)}
                  type="button"
                >
                  {option === "eth" ? "Pay in ETH" : "Pay in USDG"}
                </button>
              ))}
            </div>
          ) : null}

          {/* Said before the button, because it is the reason the flow has three wallet
              prompts instead of two rather than a sign that something went wrong. */}
          {currency === "usdg" && quote.quote.usdgPrice > 0n ? (
            <p className="mt-3 text-[12.5px] leading-[1.6] text-[var(--faint)]">
              USDG is an exact dollar amount and never moves with the ETH price. It needs
              one extra transaction to approve the payment.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Only ever shown after this panel has published once and the site has since been
          edited — the state the `done` check above drops out of. Says what is actually
          live, so "publish again" reads as updating something rather than as a warning
          that the last attempt failed. */}
      {editedSincePublish ? (
        <div className="mt-6 border border-[var(--line-card)] p-4">
          <span className="label">Not yet live</span>
          <p className="mt-2.5 text-[13.5px] leading-[1.6] text-[var(--dim)]">
            <strong className="text-[var(--fg)]">You&rsquo;ve edited since publishing.</strong>{" "}
            {name.path}.hoodfi.eth still serves the version you published — these changes
            reach it when you publish again.
          </p>
          <a
            className="btn btn-ghost btn-sm mt-4 w-full"
            href={publishedUrl(name.path)}
            rel="noreferrer"
            target="_blank"
          >
            Open the published version <ArrowNE />
          </a>
        </div>
      ) : null}

      {blocked ? (
        <p className="mt-6 text-[14px] leading-[1.6] text-[var(--warn)]">{blocked}</p>
      ) : null}

      <button
        className="btn btn-lime mt-6 w-full"
        disabled={busy || blocked !== null}
        onClick={run}
        type="button"
      >
        {busy ? LABELS[step] : published ? "Publish your changes" : "Publish this site"}
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
