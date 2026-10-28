import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowNE } from "@/components/ArrowNE";
import { PayboxFlipWord } from "@/components/PayboxFlipWord";
import { ConnectorDemos } from "@/components/ConnectorDemos";
import { CopyLine } from "@/components/CopyLine";
import { PAYBOX_STORES, PAYBOX_URL } from "@/lib/paybox";
import { MCP_URL } from "@/lib/site";

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
      The HoodFi Names connector checks it, quotes the price and shows you the
      transaction; PayBox asks before it signs.
    </>,
  ],
  [
    "03 · you own",
    "One transaction on Robinhood Chain and the lifetime ERC‑721 is in your vault wallet. No renewals, no expiry, from $3.",
  ],
];

/**
 * Adding the HoodFi Names connector, per app. Same menus the PayBox recordings below
 * walk through; the difference is that this server needs no authorisation at all.
 */
const HOODFI_STEPS: [string, string[]][] = [
  [
    "claude",
    [
      "Settings → Connectors → Add custom connector.",
      "Name: HoodFi Names. URL: the one above.",
      "Add. There is no sign-in step.",
    ],
  ],
  [
    "chatgpt",
    [
      "Settings → Advanced security → turn on Developer mode.",
      "Apps & Connectors → Create. Name: HoodFi Names, URL: the one above, Authentication: none.",
      "Create.",
    ],
  ],
  [
    "grok",
    [
      "Settings → Connectors → add a connector by URL.",
      "Paste the URL above and save. Nothing to authorise.",
    ],
  ],
];

const PROMPTS = [
  "Use HoodFi Names and PayBox to register satoshi.hoodfi.eth to my PayBox wallet. Show me each step before you sign it.",
  "Set my hoodfi name's X handle and avatar, then make it my ENS primary name.",
];

/** The records an agent can now write, and the thing it still never needs. */
const RECORD_ROWS: [string, string, boolean][] = [
  ["btc", "set by prompt", true],
  ["sol", "set by prompt", true],
  ["xrp", "set by prompt", true],
  ["eth · evm", "set by prompt", true],
  ["avatar · bio · socials", "set by prompt", true],
  ["subnames", "created by prompt", true],
  ["ens primary name", "set by prompt", true],
  // Not lime: this is the absence of a requirement, not a feature to celebrate.
  ["wallet connect", "not required", false],
];

/**
 * `04 / paybox` on the MCP page: what PayBox is, how the three steps go, the
 * connector being added in each app, and the records an agent can set once it is.
 *
 * The product truth the copy turns on — TWO connectors: HoodFi Names (this project's
 * MCP, added by URL, no sign-in) prepares each transaction complete, and PayBox signs
 * it after the user approves. No key is held by HoodFi. The videos show the PayBox
 * half, so the HoodFi half is written out as steps with its URL beside them.
 *
 * (PayBox can also reach the MCP alone, through use_service's probe mode — proven
 * 2026-09-02 — but that is a diagnostic path MoonPay doesn't advertise, and the
 * two-connector route is the one proven by voice in Claude. Lead with that.)
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
          grant your AI app scoped, revocable access. Add it next to the HoodFi Names
          connector — one prepares the transaction, the other signs it — and a name
          is one sentence away.
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

      {/* ── setup: two connectors ── */}
      <div className="mt-[clamp(56px,7vw,84px)]">
        <div className="eyebrow">setup / two connectors</div>
        <div className="duo mt-[18px] items-end">
          <h3 className="m-0 text-[clamp(28px,3.4vw,46px)] font-extrabold leading-[0.96] tracking-[-0.035em]">
            Add both connectors once.
          </h3>
          <p className="lede m-0 mb-2.5 max-w-[44ch]">
            HoodFi Names is added by its URL alone — no account, no sign-in, no key.
            PayBox is added the same way from its own URL. Then switch both on in a
            chat and ask.
          </p>
        </div>

        {/* 1 · HoodFi Names — the half no video shows. */}
        <div className="mt-11 border border-[var(--line)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] p-6">
            <div>
              <div className="label">1 · the hoodfi names connector</div>
              <div className="mt-2 text-[20px] font-extrabold tracking-[-0.02em]">
                Name it HoodFi Names, paste the URL, add.
              </div>
            </div>
          </div>
          <div className="p-6">
            <CopyLine text={MCP_URL} />
          </div>
          <div className="cells border-t border-l border-[var(--line)]">
            {HOODFI_STEPS.map(([app, steps]) => (
              <div key={app} className="flex-[1_1_260px] border-r border-b border-[var(--line)] p-6">
                <div className="label">{app}</div>
                <ol className="m-0 mt-3 list-none p-0">
                  {steps.map((step, i) => (
                    <li key={i} className="flex gap-3 py-1.5 text-[14.5px] leading-[1.5] text-[var(--dim)]">
                      <span className="data flex-none text-[12px] leading-[1.8] text-[var(--olive)]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>

        {/* 2 · PayBox — the recordings show exactly this. */}
        <div className="mt-[clamp(40px,5vw,56px)]">
          <div className="label">2 · the paybox connector</div>
          <p className="lede m-0 mt-2 max-w-[60ch]">
            Install PayBox, paste the PayBox connector (its URL is on{" "}
            <a href={PAYBOX_URL} target="_blank" rel="noreferrer" className="border-b border-[var(--line-card)] font-bold">
              paybox.sh
            </a>
            ) and fund the vault. Watch it added in each app:
          </p>
          <div className="mt-6">
            {/* The one interactive piece of this section — the cards start their own
                playback and open a centred player. Everything around it stays static. */}
            <ConnectorDemos />
          </div>
        </div>

        {/* 3 · ask */}
        <div className="mt-[clamp(40px,5vw,56px)] max-w-[760px]">
          <div className="label">3 · switch both on in a new chat, then ask</div>
          <div className="mt-3 flex flex-col gap-2.5">
            {PROMPTS.map((prompt) => (
              <CopyLine key={prompt} text={prompt} prose />
            ))}
          </div>
        </div>
      </div>

      {/* ── records by prompt ── */}
      <div className="on-ink shadow-lime mt-[clamp(56px,7vw,84px)] grid border border-[var(--line-card)] bg-[var(--ink)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
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
            Your agent sets the Bitcoin, Solana, XRP and Ethereum address records on your
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
