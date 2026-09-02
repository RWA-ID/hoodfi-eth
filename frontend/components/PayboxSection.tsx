import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowNE } from "@/components/ArrowNE";
import { PayboxFlipWord } from "@/components/PayboxFlipWord";
import { PAYBOX_APPS, PAYBOX_STORES, PAYBOX_URL } from "@/lib/paybox";

const STEPS: [string, ReactNode][] = [
  [
    "01 · you vault",
    "Fund a PayBox vault from a wallet or card. Keys stay yours — PayBox is non-custodial and access is revocable at any time.",
  ],
  [
    "02 · you ask",
    <>
      “Register{" "}
      <span className="data text-[13.5px]">satoshi.hoodfi.eth</span> for me.”
      PayBox calls the HoodFi Names MCP, quotes the price in ETH or USDG, and
      waits for your go-ahead.
    </>,
  ],
  [
    "03 · you own",
    "One transaction on Robinhood Chain and the lifetime ERC‑721 is in your vault wallet. No renewals, no expiry, from $3.",
  ],
];

/** The records an agent can now write, and the thing it still never needs. */
const RECORD_ROWS: [string, string, boolean][] = [
  ["btc", "set by prompt", true],
  ["sol", "set by prompt", true],
  ["eth · evm", "set by prompt", true],
  // Not lime: this is the absence of a requirement, not a feature to celebrate.
  ["wallet connect", "not required", false],
];

/**
 * `04 / paybox` on the MCP page: what PayBox is, how the three steps go, the
 * connector being added in each app, and the records an agent can set once it is.
 *
 * The product truth the copy turns on — a user pastes the *PayBox* connector, and
 * PayBox calls this project's MCP on their behalf. There is no HoodFi connector to
 * install, and no key is held by either side.
 *
 * Headings here set their own sizes rather than borrowing `.h-section` / `.h-sub`:
 * those classes are unlayered, so their `font-size` would win against any Tailwind
 * utility trying to step them down, and this section's scale sits between the two.
 */
export function PayboxSection() {
  return (
    <section
      id="paybox"
      className="shell section border-t border-[var(--line)]"
    >
      <div className="eyebrow">04 / paybox</div>

      <div className="duo mt-[18px] items-end">
        {/* `.h-page`, the same class 01–03 use on this page. The handoff's literal
            (clamp(32px,4.4vw,62px)/0.94/-0.04em) and this token differ only at the
            very bottom of the range, and matching the page beats matching the spec
            to the pixel. The two h3s below keep their literals — no token sits at
            their size. */}
        <h2 className="h-page m-0 max-w-[20ch]">
          <span className="sr-only">Now your AI app can buy a HoodFi Name.</span>
          <span aria-hidden>
            Now your <PayboxFlipWord /> can buy a HoodFi Name.
          </span>
        </h2>
        <p className="lede m-0 mb-2.5 max-w-[46ch]">
          <a
            href={PAYBOX_URL}
            target="_blank"
            rel="noreferrer"
            className="border-b border-[var(--line-card)] font-bold"
          >
            PayBox
          </a>{" "}
          is a non-custodial control plane for agent payments: vault once, then
          grant your AI app scoped, revocable access. Add the PayBox connector — it
          speaks to the HoodFi Names MCP on your behalf — and a name is one sentence
          away.
        </p>
      </div>

      {/* ── the three steps ── */}
      <div className="cells mt-11 border-l border-t border-[var(--line)]">
        {STEPS.map(([key, body]) => (
          <div
            key={key}
            className="flex-[1_1_300px] border-r border-b border-[var(--line)] p-6"
          >
            <div className="label">{key}</div>
            <p className="mt-3 text-[15px] leading-[1.55] text-[var(--dim)]">
              {body}
            </p>
          </div>
        ))}
      </div>

      {/* ── setup, one card per app ── */}
      <div className="mt-[clamp(56px,7vw,84px)]">
        <div className="eyebrow">setup / three apps</div>
        <div className="duo mt-[18px] items-end">
          <h3 className="m-0 text-[clamp(28px,3.4vw,46px)] font-extrabold leading-[0.96] tracking-[-0.035em]">
            Add the connector once.
          </h3>
          <p className="lede m-0 mb-2.5 max-w-[44ch]">
            Same three steps everywhere: install PayBox, paste the PayBox connector,
            fund the vault. PayBox talks to the HoodFi Names MCP for you — you just
            prompt. Watch yours below.
          </p>
        </div>

        {/*
         * Grid, not `.cells`. With flex-wrap a lone third card grows to the full row
         * and renders its video 1.6× taller than the two above it; `auto-fit` +
         * `minmax` keeps every column the same width at every breakpoint. Do not
         * swap this for flex-wrap without capping the basis.
         */}
        <div className="mt-9 grid items-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
          {PAYBOX_APPS.map((app, index) => (
            <div
              key={app.id}
              className="flex min-w-0 flex-col border border-[var(--line-card)] bg-[var(--paper-alt)]"
            >
              <div className="flex items-center gap-3.5 border-b border-[var(--line-soft)] px-5 py-4">
                <span className="data text-[10.5px] tracking-[0.18em] text-[var(--faint)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="flex h-6 w-[140px] flex-none items-center">
                  <Image
                    src={app.lockup.src}
                    alt={app.label}
                    width={app.lockup.width}
                    height={app.lockup.height}
                    className="block h-auto max-h-full w-auto max-w-full"
                  />
                </span>
              </div>
              {/*
               * Muted autoplay is the only kind mobile Safari and Chrome will start.
               * `preload="metadata"` plus a poster keeps three simultaneous loops off
               * the critical path — the clips were re-encoded to 960px/30fps for the
               * same reason, since they render in a ~400px card at most.
               */}
              <video
                src={app.video}
                poster={app.poster}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label={`Adding the PayBox connector in ${app.label}`}
                className="block h-auto w-full bg-[var(--ink)]"
              />
              <p className="px-5 pb-5 pt-4 text-sm leading-[1.55] text-[var(--dim)]">
                {app.step}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── records by prompt ── */}
      <div className="on-ink mt-[clamp(56px,7vw,84px)] grid border border-[var(--line-card)] bg-[var(--ink)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
        <div className="p-[clamp(24px,3.4vw,40px)]">
          {/*
           * Was "coming next" in the design, drawn while the record tooling was still
           * unbuilt. `hoodfi_build_set_address_tx` shipped with this change, so the
           * block now describes something that exists — which means the MCP worker
           * has to be deployed for this to be true. If it is ever rolled back, this
           * is the block to revert first.
           */}
          <div className="label">now live</div>
          <h3 className="mt-3.5 text-[clamp(26px,3vw,40px)] font-extrabold leading-none tracking-[-0.035em] text-[var(--fg)]">
            Records by prompt.
          </h3>
          <p className="mt-4 max-w-[44ch] text-[15.5px] leading-[1.55] text-[var(--dim)] text-pretty">
            Your agent sets the Bitcoin, Solana and Ethereum address records on your
            name too — spoken, not signed. No wallet ever connects to this site.
          </p>
          <p className="data mt-5 max-w-[52ch] text-[11.5px] leading-[1.7] text-[var(--faint)]">
            Owner-only, checked against the registry before any calldata comes back.
            Same rule as every other HoodFi MCP tool.
          </p>
        </div>
        <div className="flex flex-col justify-center border-l border-[var(--line-soft)] p-[clamp(24px,3.4vw,40px)]">
          <div className="border-t border-[var(--line-soft)]">
            {RECORD_ROWS.map(([key, value, accent]) => (
              <div key={key} className="ledger-line">
                <span className="data text-[12.5px] text-[var(--label)]">
                  {key}
                </span>
                <span
                  className={`data text-[12.5px] ${accent ? "text-[var(--lime)]" : "text-[var(--dim)]"}`}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── get the app ── */}
      <div className="mt-[clamp(48px,6vw,72px)] flex flex-wrap items-center gap-8 border-t border-[var(--line)] pt-9">
        <div className="flex flex-[1_1_260px] items-center gap-[18px]">
          <Image
            src="/paybox/paybox-icon.png"
            alt="PayBox"
            width={168}
            height={168}
            /* The square store artwork, not the handoff's pre-rounded copy: app
               icons are always seen masked, so the radius belongs to us and a source
               with its own corners baked in would be rounded twice. Same treatment
               as the Robinhood icon in WalletLockup. */
            className="h-14 w-14 flex-none rounded-[13px] object-cover"
          />
          <div>
            <div className="label">get the app</div>
            {/* Named as the stores name it — "PayBox by MoonPay" on the App Store,
                "PayBox" by developer MoonPay on Google Play. The developer line
                matters here: this section features someone else's product. */}
            <div className="mt-1 text-[17px] font-bold tracking-[-0.02em]">
              PayBox
            </div>
            <div className="data mt-0.5 text-[11px] text-[var(--faint)]">
              by MoonPay
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3.5">
          {/*
           * The real badges, not the prototype's placeholder pills. Apple's and
           * Google's badge art is generic — the same image for every app — so these
           * are the two PNGs already in the repo under `/store/`, rendered through
           * `.store-badge` exactly as WalletLockup does, with the focus ring held
           * outside the art in its own clear space. Never recolour or crop them.
           */}
          {PAYBOX_STORES.map((store) => (
            <a
              key={store.href}
              href={store.href}
              target="_blank"
              rel="noopener noreferrer"
              className="store-badge"
            >
              <Image
                src={store.src}
                alt={store.alt}
                width={419}
                height={141}
                priority={false}
              />
            </a>
          ))}
          <a
            href={PAYBOX_URL}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ink btn-lg"
          >
            paybox.sh <ArrowNE />
          </a>
        </div>
      </div>

      {/* Supplied wording, verbatim — the short form of the PayBox section on
          /disclaimer/. Do not paraphrase or trim it: it carries the permission, the
          non-affiliation, and the trademark attribution in one breath. */}
      <p className="data mt-4 max-w-[76ch] text-[11px] leading-[1.7] text-[var(--faint)]">
        PayBox is a product of MoonPay Inc., referenced with permission. HoodFi Names
        is an independent project and is not affiliated with, endorsed by, or operated
        by MoonPay. We hold no funds, process no payments, and perform no identity
        verification. PayBox&apos;s terms, fees, verification requirements and regional
        availability apply. PayBox and MoonPay are trademarks of MoonPay Inc.{" "}
        <Link href="/disclaimer/" className="link">
          Full disclaimer
        </Link>
        .
      </p>
    </section>
  );
}
