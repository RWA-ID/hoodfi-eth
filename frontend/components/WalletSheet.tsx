"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatEther } from "viem";
import { useAccount, useBalance } from "wagmi";
import { robinhoodChain, ROBINHOOD_CHAIN_ID } from "@/lib/chains";

/*
 * "Where is my wallet, and how do I put money in it?"
 *
 * Signing in with Google hands someone a non-custodial wallet and no idea what
 * to do next. AppKit's own account view is not the answer here: for an embedded
 * wallet it renders blank after any reload (reown-com/appkit#5765), which is
 * exactly the state someone is in when they come back to fund it.
 *
 * FUNDING THIS CHAIN IS NOT LIKE FUNDING MAINNET, and the differences are the
 * kind that lose money rather than merely confuse:
 *
 *  - Gas on Robinhood Chain is ETH. A wallet holding only USDG can pay for
 *    nothing at all, including a mint priced in USDG — so every route here
 *    lands ETH, not a stablecoin.
 *  - You cannot withdraw from the Robinhood BROKERAGE app onto Robinhood Chain.
 *    Robinhood's own docs say to bridge. The app that can send here is
 *    Robinhood WALLET, the separate self-custody one.
 *  - MoonPay does sell ETH on Robinhood Chain directly (confirmed in the app
 *    2026-09-05). Press coverage of the integration mentions only USDG, which
 *    is the sort of thing to check in the product rather than in an article.
 *  - A normal exchange (Coinbase, Kraken, Binance) cannot send to Robinhood
 *    Chain at all. Their "ETH" withdrawal lands on Ethereum mainnet, and the
 *    money is not on this chain. This is why this card does not say "any
 *    exchange" the way the yournames.io one does — that sentence would be
 *    actively dangerous here.
 *
 * So the order is: the route that delivers the gas token first.
 */

/* Verified 2026-09-05 — both resolve. The Play package is `com.robinhood.gateway`,
   which is not something to guess at: `com.robinhood.wallet` 404s. */
const RH_WALLET_IOS =
  "https://apps.apple.com/us/app/robinhood-wallet-swap-crypto/id1634080733";
const RH_WALLET_ANDROID =
  "https://play.google.com/store/apps/details?id=com.robinhood.gateway";
const MOONPAY_IOS =
  "https://apps.apple.com/us/app/moonpay-buy-crypto-bitcoin/id1635031432";
const MOONPAY_ANDROID = "https://play.google.com/store/apps/details?id=com.moonpay";

export default function WalletSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { address } = useAccount();
  const [copied, setCopied] = useState(false);

  /* Polled while open — this is the moment somebody is watching for a deposit
     to land. Stopped on close; a permanent poll buys nothing. */
  const { data: balance } = useBalance({
    address,
    chainId: ROBINHOOD_CHAIN_ID,
    query: { enabled: open && !!address, refetchInterval: open ? 15_000 : false },
  });

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2_000);
    return () => clearTimeout(t);
  }, [copied]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !address) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
    } catch {
      /* Clipboard needs a secure context and a permission that can be refused.
         A selection beats a button that lies, and on a phone it raises the
         native Copy tooltip. */
      const el = document.getElementById("hoodfi-wallet-address");
      if (!el) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  };

  const empty = balance != null && balance.value === 0n;

  /* Portalled: the trigger lives in a sticky header, and a sticky element makes
     its own stacking context — a fixed child of it stacks at the header's
     level, not the page's. */
  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain sm:p-4"
      style={{ background: "rgba(11,14,8,0.6)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Your wallet"
    >
      <div
        className="mx-auto min-h-full w-full border-[color:var(--line-card)] bg-[color:var(--bg)] sm:min-h-0 sm:max-w-[460px] sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-[color:var(--line)] bg-[color:var(--bg)] px-6 py-4">
          <span className="data text-[11px] tracking-[0.12em] text-[color:var(--label)] uppercase">
            Your wallet
          </span>
          <button
            onClick={onClose}
            type="button"
            className="data cursor-pointer text-[12px] text-[color:var(--faint)] hover:text-[color:var(--fg)]"
          >
            Close ✕
          </button>
        </div>

        <div className="px-6 pt-6 pb-7">
          {/* ------------------------------------------------- address */}
          <div className="data text-[11px] tracking-[0.12em] text-[color:var(--label)] uppercase">
            Your address
          </div>
          {/*
            Wrapped, not scrolled. An address is 42 characters and a phone is
            390px wide — a single-line input silently clips the last third of
            the one thing this screen exists to show. `select-all` makes one tap
            select the whole thing.
          */}
          <div
            id="hoodfi-wallet-address"
            className="data mt-2.5 border border-[color:var(--line-card)] bg-[color:var(--paper-alt)] px-3 py-3 text-[12.5px] leading-[1.6] break-all select-all text-[color:var(--fg)]"
          >
            {address}
          </div>

          <button onClick={copy} type="button" className="btn btn-lime mt-3 w-full">
            {copied ? "Copied ✓" : "Copy address"}
          </button>

          <p className="m-0 mt-3 text-[12.5px] leading-[1.55] text-[color:var(--faint)]">
            This is where your names and your money live. Safe to share — anyone
            can send to it, nobody can take from it.
          </p>

          {/* ------------------------------------------------- balance */}
          <div className="mt-7 border-t border-[color:var(--line)] pt-5">
            <div className="data text-[11px] tracking-[0.12em] text-[color:var(--label)] uppercase">
              Balance
            </div>
            <div className="mt-1.5 text-[32px] leading-none font-semibold tracking-[-0.02em]">
              {balance
                ? `${Number(formatEther(balance.value)).toFixed(5)} ${balance.symbol}`
                : "—"}
            </div>
            <div className="data mt-1.5 text-[11.5px] text-[color:var(--faint)]">
              on {robinhoodChain.name}
            </div>
            {empty && (
              <p className="m-0 mt-3 border border-[color:var(--line-card)] bg-[color:var(--lime)] px-3 py-2.5 text-[13px] leading-[1.5] text-[color:var(--ink)]">
                Nothing here yet. Add a little ETH below and you can mint a name.
              </p>
            )}
          </div>

          {/* ------------------------------------------------ add funds */}
          <div className="mt-7 border-t border-[color:var(--line)] pt-5">
            <div className="data text-[11px] tracking-[0.12em] text-[color:var(--label)] uppercase">
              Add funds
            </div>
            <p className="m-0 mt-2 text-[14px] leading-[1.6] text-[color:var(--dim)]">
              Names are paid for in ETH or USDG, and the network fee is always
              paid in <strong className="font-semibold">ETH</strong> — so start
              with a little ETH whichever way you fund this.
            </p>

            <Option
              index="01"
              title="From Robinhood Wallet"
              blurb="The self-custody Robinhood app — not the brokerage one. It's the only wallet that sends straight to this chain, so it's the shortest route."
            >
              <Step n={1}>
                Get Robinhood Wallet.
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <StoreLink href={RH_WALLET_IOS} caption="Download on" name="App Store">
                    <AppleMark />
                  </StoreLink>
                  <StoreLink href={RH_WALLET_ANDROID} caption="Get it on" name="Google Play">
                    <PlayMark />
                  </StoreLink>
                </div>
              </Step>
              <Step n={2}>
                Move some ETH into it, then switch the network to{" "}
                <strong className="font-semibold text-[color:var(--fg)]">
                  Robinhood Chain
                </strong>
                .
              </Step>
              <Step n={3}>Send it to the address above.</Step>
            </Option>

            <Option
              index="02"
              title="Buy with your card"
              blurb="New to this? MoonPay sells ETH on Robinhood Chain straight to a wallet — no exchange account to open, and nothing to bridge."
            >
              <Step n={1}>
                Get the MoonPay app.
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <StoreLink href={MOONPAY_IOS} caption="Download on" name="App Store">
                    <AppleMark />
                  </StoreLink>
                  <StoreLink href={MOONPAY_ANDROID} caption="Get it on" name="Google Play">
                    <PlayMark />
                  </StoreLink>
                </div>
              </Step>
              <Step n={2}>
                Buy{" "}
                <strong className="font-semibold text-[color:var(--fg)]">ETH</strong>{" "}
                and pick{" "}
                <strong className="font-semibold text-[color:var(--fg)]">
                  Robinhood Chain
                </strong>{" "}
                as the network. MoonPay lists several — Ethereum is a different
                one, and money sent there won&apos;t appear here.
              </Step>
              <Step n={3}>
                When it asks where to send it, paste the address above.
              </Step>
            </Option>

            {/*
              The mistake that cannot be undone, and on this chain it is much
              easier to make than on mainnet: every exchange offers "ETH", and
              almost none of them can put it on Robinhood Chain.
            */}
            <p className="m-0 mt-5 border border-[color:var(--bad)] px-3 py-2.5 text-[12.5px] leading-[1.55] text-[color:var(--bad)]">
              Send only on{" "}
              <strong className="font-semibold">Robinhood Chain</strong>. A
              withdrawal from Coinbase, Kraken or Binance — or from the Robinhood
              brokerage app — lands on Ethereum instead and will not appear here.
              Getting it across needs a bridge, and money sent on the wrong
              network can&apos;t be recovered.
            </p>

            <p className="m-0 mt-4 text-[12px] leading-[1.55] text-[color:var(--faint)]">
              Already hold ETH on Ethereum? It can be bridged to Robinhood Chain
              with the canonical Arbitrum bridge. A few dollars of ETH covers a
              name and its network fee.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ parts */

function Option({
  index,
  title,
  blurb,
  children,
}: {
  index: string;
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 border border-[color:var(--line-card)] bg-[color:var(--paper-alt)] p-5">
      <div className="data text-[10.5px] tracking-[0.14em] text-[color:var(--label)] uppercase">
        Option {index}
      </div>
      <h3 className="m-0 mt-1.5 text-[18px] leading-[1.15] font-semibold tracking-[-0.01em]">
        {title}
      </h3>
      <p className="m-0 mt-2 text-[12.5px] leading-[1.55] text-[color:var(--faint)]">
        {blurb}
      </p>
      <ol className="m-0 mt-4 list-none space-y-3.5 p-0">{children}</ol>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="data flex h-[20px] w-[20px] flex-none items-center justify-center border border-[color:var(--line-card)] text-[10.5px] font-medium text-[color:var(--dim)]">
        {n}
      </span>
      {/* flex-1 as well as min-w-0: without it the content sizes to max-content
          and the store badges push the whole sheet wider than the phone. */}
      <div className="min-w-0 flex-1 text-[13.5px] leading-[1.55] text-[color:var(--dim)]">
        {children}
      </div>
    </li>
  );
}

function StoreLink({
  href,
  caption,
  name,
  children,
}: {
  href: string;
  caption: string;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-[50px] min-w-0 flex-1 basis-[132px] items-center justify-center gap-2 border border-[color:var(--line-card)] bg-[color:var(--bg)] no-underline transition-colors hover:bg-[var(--hover-fill)]"
    >
      {children}
      <span className="min-w-0">
        <span className="data block text-[7.5px] tracking-[0.1em] whitespace-nowrap text-[color:var(--faint)] uppercase">
          {caption}
        </span>
        <span className="block text-[12.5px] leading-[1.2] font-semibold whitespace-nowrap">
          {name}
        </span>
      </span>
    </a>
  );
}

/* Drawn, not fetched: these sit in the first paint of a panel whose job is
   "get the app", and a logo that arrives late — or not at all behind a blocked
   CDN — undercuts exactly that. Apple's mark follows the page's ink so it stays
   legible in dark mode; the Play arrow keeps its own colours, which are the
   part people recognise. */
function AppleMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="block flex-none">
      <path
        fill="currentColor"
        d="M17.05 12.72c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.18-1.72-1.35-.14-2.64.79-3.33.79-.69 0-1.75-.77-2.87-.75-1.48.02-2.84.86-3.6 2.18-1.54 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.25 2.74 2.2 1.1-.04 1.52-.71 2.85-.71s1.7.71 2.87.69c1.19-.02 1.94-1.08 2.66-2.14.84-1.23 1.19-2.42 1.21-2.48-.03-.01-2.32-.89-2.34-3.51zM14.9 5.86c.6-.74 1.01-1.75.9-2.76-.87.04-1.93.58-2.56 1.31-.56.65-1.05 1.69-.92 2.68.97.08 1.96-.49 2.58-1.23z"
      />
    </svg>
  );
}

function PlayMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="30 336.7 120.9 129.2"
      aria-hidden
      className="block flex-none"
    >
      <path
        fill="#FFCD00"
        d="M119.2,421.2c15.3-8.4,27-14.8,28-15.3c3.2-1.7,6.5-6.2,0-9.7c-2.1-1.1-13.4-7.3-28-15.3l-20.1,20.2L119.2,421.2z"
      />
      <path
        fill="#FF3A44"
        d="M99.1,401.1l-64.2,64.7c1.5,0.2,3.2-0.2,5.2-1.3c4.2-2.3,48.8-26.7,79.1-43.3L99.1,401.1z"
      />
      <path
        fill="#00E576"
        d="M99.1,401.1l20.1-20.2c0,0-74.6-40.7-79.1-43.1c-1.7-1-3.6-1.3-5.3-1L99.1,401.1z"
      />
      <path
        fill="#00C3FF"
        d="M99.1,401.1l-64.3-64.3c-2.6,0.6-4.8,2.9-4.8,7.6c0,7.5,0,107.5,0,113.8c0,4.3,1.7,7.4,4.9,7.7L99.1,401.1z"
      />
    </svg>
  );
}
