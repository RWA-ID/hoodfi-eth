"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { formatEther } from "viem";
import qrcode from "qrcode-generator";
import { useAccount, useBalance, useDisconnect } from "wagmi";
import { robinhoodChain, ROBINHOOD_CHAIN_ID } from "@/lib/chains";
import { isDeadConnector, resetWalletSession } from "@/lib/session";

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
  const { address, connector } = useAccount();
  const { disconnect } = useDisconnect();
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

  /**
   * The way out, which for a social login exists nowhere else.
   *
   * AppKit puts Disconnect inside its own account view, and this sheet replaces that
   * view for the embedded wallet — so until this row existed, somebody who signed in
   * with Google had no way to sign out short of clearing site data. A wallet you
   * brought with you keeps reaching AppKit's view from the header, and its Disconnect
   * with it.
   *
   * A connection that has gone dead has no `disconnect` method, so wagmi's
   * `disconnect()` resolves against an object that cannot act and the click is a
   * silent no-op. The header cell will not open this sheet over a dead connector, but
   * an embedded session also drops mid-session with no reload — so it can die while
   * this sheet is on screen, and this has to survive that. Clearing the stored session
   * and reloading is the only way out, and it is what the person pressing this is
   * asking for either way.
   */
  const signOut = () => {
    if (isDeadConnector(connector)) {
      void resetWalletSession();
      return;
    }
    disconnect();
    onClose();
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

          {/*
            The QR is for the second device, which is the normal case here: the
            money is in Robinhood Wallet on a phone and the address is on a
            laptop. Copy/paste doesn't cross that gap; a camera does.
          */}
          <AddressQr address={address} />

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
              icon={
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src="/robinhood/robinhood-wallet-app-icon.png"
                  alt=""
                  className="block h-[34px] w-[34px] flex-none"
                />
              }
              title="From Robinhood Wallet"
              blurb="The self-custody Robinhood app — not the brokerage one. It's the only wallet that sends straight to this chain, so it's the shortest route."
            >
              <Step n={1}>
                Get Robinhood Wallet.
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <StoreLink href={RH_WALLET_IOS} src="/store/appstore-badge.png" alt="Download Robinhood Wallet on the App Store" />
                  <StoreLink href={RH_WALLET_ANDROID} src="/store/googleplay-badge.png" alt="Get Robinhood Wallet on Google Play" />
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
              icon={<MoonPayMark />}
              title="Buy with your card"
              blurb="New to this? MoonPay sells ETH on Robinhood Chain straight to a wallet — no exchange account to open, and nothing to bridge."
            >
              <Step n={1}>
                Get the MoonPay app.
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <StoreLink href={MOONPAY_IOS} src="/store/appstore-badge.png" alt="Download MoonPay on the App Store" />
                  <StoreLink href={MOONPAY_ANDROID} src="/store/googleplay-badge.png" alt="Get MoonPay on Google Play" />
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

          {/* ------------------------------------------------- sign out */}
          <div className="mt-7 border-t border-[color:var(--line)] pt-5">
            <div className="data text-[11px] tracking-[0.12em] text-[color:var(--label)] uppercase">
              Signed in
            </div>
            {/*
              Said before the button, not after, because the fear is the reason
              somebody hesitates over it: a wallet they did not choose, holding a
              name they paid for, behind a button marked "sign out". Nothing is
              deleted and nothing moves — the wallet is derived from the account
              they signed in with, so the same login brings back the same address.
            */}
            <p className="m-0 mt-2 text-[12.5px] leading-[1.55] text-[color:var(--faint)]">
              Signing out only forgets this browser. Your names and your money
              stay exactly where they are — sign back in the same way and this
              wallet comes back with them.
            </p>
            {/* Ghost, not lime: this is the one thing on the card nobody should
                land on by accident, and lime is what the page uses to mean go. */}
            <button onClick={signOut} type="button" className="btn btn-ghost mt-3 w-full">
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ parts */

/**
 * The address as a scannable QR.
 *
 * ALWAYS dark-on-white, in both themes. A QR is read by a camera, not by a
 * person, and inverting it for dark mode is the fastest way to make one that
 * scanners refuse — the quiet zone and the contrast direction are part of the
 * spec, not styling. So it sits in its own white plate whatever the page is
 * doing, with the 4-module quiet zone the spec requires.
 *
 * Encodes the bare address rather than an `ethereum:` URI. EIP-681 would let a
 * wallet prefill the chain as well, but support is patchy and a scanner that
 * doesn't understand the scheme shows the user a URL instead of an address.
 * Every wallet's "scan to send" understands a bare address.
 */
function AddressQr({ address }: { address: string }) {
  const { count, path } = useMemo(() => {
    // Type 0 = pick the smallest version that fits. 'M' tolerates ~15% damage,
    // which is the usual choice for something photographed off a screen.
    const qr = qrcode(0, "M");
    qr.addData(address);
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
      }
    }
    return { count: n, path: d };
  }, [address]);

  const quiet = 4;
  const size = count + quiet * 2;

  return (
    <div className="mt-3 flex justify-center">
      <div className="border border-[color:var(--line-card)] bg-white p-3">
        <svg
          width={168}
          height={168}
          viewBox={`0 0 ${size} ${size}`}
          shapeRendering="crispEdges"
          role="img"
          aria-label="QR code of your wallet address"
        >
          <rect width={size} height={size} fill="#fff" />
          <g transform={`translate(${quiet} ${quiet})`} fill="#000">
            <path d={path} />
          </g>
        </svg>
      </div>
    </div>
  );
}

function Option({
  index,
  title,
  blurb,
  icon,
  children,
}: {
  index: string;
  title: string;
  blurb: string;
  /* The provider's own mark. Both are square app icons rather than wordmarks,
     so they read at 34px and stay legible in either theme. */
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 border border-[color:var(--line-card)] bg-[color:var(--paper-alt)] p-5">
      <div className="data text-[10.5px] tracking-[0.14em] text-[color:var(--label)] uppercase">
        Option {index}
      </div>
      <div className="mt-1.5 flex items-center gap-2.5">
        {icon}
        <h3 className="m-0 text-[18px] leading-[1.15] font-semibold tracking-[-0.01em]">
          {title}
        </h3>
      </div>
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

/*
 * The official store badges, which the repo already carries at 419x141 with
 * transparency — better than the Apple and Play marks this drew by hand, and
 * the treatment both stores actually ask for. Rendered at a fixed height so the
 * two sit on one baseline, and they wrap rather than squeeze on a narrow phone.
 */
function StoreLink({ href, src, alt }: { href: string; src: string; alt: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-w-0 flex-1 basis-[104px] items-center justify-center no-underline"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {/* 36px, not 42: the badge is 419x141, so at 42 each is ~125px wide and two
          will not fit the ~238px a step column leaves on a 390px phone — they
          wrapped to one per line. At 36 they are ~107px and sit side by side. */}
      <img src={src} alt={alt} className="block h-[36px] w-auto max-w-full" />
    </a>
  );
}

/*
 * MoonPay's mark: a large disc with a smaller one at its shoulder.
 *
 * Drawn rather than shipped as an asset, and only the MARK, not the lockup.
 * The lockup sets "MoonPay" in black, which disappears against this site's dark
 * theme; two circles in the brand purple read correctly on either ground and
 * stay sharp at any size. #7715F4 sampled from the official artwork.
 */
function MoonPayMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden className="block flex-none">
      <circle cx="14" cy="21" r="11" fill="#7715F4" />
      <circle cx="25.5" cy="9.5" r="5.5" fill="#7715F4" />
    </svg>
  );
}
