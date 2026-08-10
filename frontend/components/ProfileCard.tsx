"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NameAvatar } from "./NameAvatar";
import type { L1State } from "@/lib/resolution";
import { XLogo } from "./ShareOnX";
import { track } from "@/lib/analytics";
import { nameShareUrl } from "@/lib/site";

/**
 * The shareable artifact, shared by /search and /manage.
 *
 * /manage feeds it the *draft* record values rather than what's on chain, so the card
 * is a live preview of what you're about to publish. That only works because the card
 * takes a plain value object and does no reading of its own.
 */
export type { L1State };

export type CardName = {
  label: string;
  node: `0x${string}`;
  avatar: string;
  description: string;
};

/** Clipboard write plus the confirmation label the caller shows for 1.5s. */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const copy = useCallback(async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Throws in sandboxed frames and over plain http — say nothing rather than
      // claiming a copy that didn't happen.
      return;
    }
    setCopied(key);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 1500);
  }, []);

  return { copied, copy };
}

/**
 * Whether the name also resolves through Ethereum mainnet.
 *
 * The one thing an L2 read cannot tell you. A name can be perfectly stored on
 * Robinhood Chain and still be invisible to every wallet if the CCIP gateway in front
 * of it is failing — which is exactly what happened, silently, because a broken gateway
 * returns a signed empty answer indistinguishable from "no records set".
 */
export function L1Badge({ state }: { state: L1State }) {
  if (state.status === "idle") return null;

  const view = {
    checking: {
      text: "Checking resolution…",
      cls: "border-[var(--line)] text-[var(--faint)]",
      dot: "bg-[var(--faint)]",
    },
    ok: {
      text: "Resolving across EVM chains",
      cls: "border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_8%,transparent)] text-[var(--green)]",
      dot: "bg-[var(--green)]",
    },
    mismatch: {
      text: "Mainnet returns a different address",
      cls: "border-[color-mix(in_srgb,var(--amber)_45%,transparent)] bg-[color-mix(in_srgb,var(--amber)_8%,transparent)] text-[var(--amber)]",
      dot: "bg-[var(--amber)]",
    },
    empty: {
      text: "Not resolving — wallets can't see this",
      cls: "border-[color-mix(in_srgb,var(--red)_45%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] text-[var(--red)]",
      dot: "bg-[var(--red)]",
    },
    error: {
      text: "Couldn't check resolution",
      cls: "border-[var(--line)] text-[var(--faint)]",
      dot: "bg-[var(--faint)]",
    },
  }[state.status];

  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className={`data inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] ${view.cls}`}
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${view.dot}`} />
        {view.text}
      </span>
      {state.status === "empty" && (
        <p className="max-w-[34ch] text-center text-[11px] leading-relaxed text-[var(--faint)]">
          The records are stored correctly on Robinhood Chain, but mainnet lookups
          return nothing — wallets won&apos;t see this name until that clears.
        </p>
      )}
      {state.status === "mismatch" && (
        <p className="data max-w-[34ch] break-all text-center text-[11px] text-[var(--faint)]">
          Mainnet says {state.addr}
        </p>
      )}
    </div>
  );
}

const SUFFIX = ".hoodfi.eth";

/**
 * Font size for the name line, as a share of the card's own width.
 *
 * The name is the one piece of card content with no bounded length — labels run to 32
 * characters — so a fixed size can only ever fit the short ones. `cqi` is a percentage
 * of the containing block's inline size, which makes this exact at every card width
 * instead of tuned for one viewport: N glyphs of a monospace face at 0.62em apiece fill
 * the line when the size is `100 / (0.62 * N)` cqi.
 *
 * IBM Plex Mono actually advances 0.6em and the -0.02em tracking claws a little back;
 * 0.62 is deliberately pessimistic so the fit lands with slack rather than on the edge.
 *
 * The 20px floor is what stops a 32-character name from rendering as fine print — past
 * that the line is allowed to wrap at the <wbr/> instead, which puts `.hoodfi.eth` on
 * its own line. That is the only break point in the string, so a name can never be
 * split mid-word the way `break-all` used to split it.
 */
function nameLineSize(label: string): string {
  const cqi = 100 / (0.62 * (label.length + SUFFIX.length));
  return `max(20px, min(36px, ${cqi.toFixed(2)}cqi))`;
}

export function ProfileCard({
  name,
  l1,
  mintedOn,
  actions = true,
  eyebrow,
}: {
  name: CardName;
  l1: L1State;
  mintedOn: string | null;
  /** /manage hides these — you don't share a card you haven't saved yet. */
  actions?: boolean;
  /** Overrides the "Lifetime" chip, e.g. to mark a preview as unsaved. */
  eyebrow?: string;
}) {
  const { copied, copy } = useCopy();
  const shareUrl = nameShareUrl(name.label);
  const shareText = `${name.label}.hoodfi.eth — a lifetime name on Robinhood Chain.\n\nLook it up:`;
  const token = `#${name.node.slice(2, 6)}…${name.node.slice(-4)}`;

  return (
    <div className="flex w-full max-w-[480px] flex-col gap-3">
      <div className="card-frame">
        <div className="card-surface">
          <div className="card-grid pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="card-sheen absolute -left-1/2 -top-1/2" />
          </div>

          <div className="relative">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
                <img
                  src="/hoodfi-h.png"
                  alt=""
                  className="h-[18px] w-[18px] object-contain"
                />
                <span className="data text-[10px] uppercase tracking-[0.22em] text-[var(--faint)]">
                  HoodFi Names
                </span>
              </div>
              <span className="data rounded-full border border-[color-mix(in_srgb,var(--green)_45%,transparent)] bg-[color-mix(in_srgb,var(--green)_9%,transparent)] px-2.5 py-1 text-[9.5px] uppercase tracking-[0.2em] text-[var(--green)]">
                {eyebrow ?? "Lifetime"}
              </span>
            </div>

            <div className="flex flex-col items-center gap-3.5 px-6 pb-6 pt-8 text-center">
              <div className="avatar-ring">
                <NameAvatar
                  label={name.label}
                  avatar={name.avatar}
                  className="h-[104px] w-[104px] !border-0"
                  textClassName="text-2xl"
                />
              </div>
              {/* The sizing container. It has to be its own element: `cqi` resolves
                  against the nearest container ancestor, so the element being sized
                  can't be the one that establishes it. */}
              <div className="w-full [container-type:inline-size]">
                <div
                  className="data font-semibold leading-[1.08] tracking-[-0.02em]"
                  style={{ fontSize: nameLineSize(name.label) }}
                >
                  {name.label}
                  <wbr />
                  <span className="text-[color-mix(in_srgb,var(--paper)_32%,transparent)]">
                    {SUFFIX}
                  </span>
                </div>
              </div>
              <L1Badge state={l1} />
              {name.description && (
                <p className="max-w-[34ch] text-[13.5px] leading-relaxed text-[var(--dim)]">
                  {name.description}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 border-t border-[var(--line)]">
              {[
                { label: "Token", value: token, green: false },
                { label: "Minted", value: mintedOn ?? "—", green: false },
                { label: "Expires", value: "Never", green: true },
              ].map((s, i) => (
                <div
                  key={s.label}
                  className={`px-4 py-3.5 ${i > 0 ? "border-l border-[var(--line)]" : ""}`}
                >
                  <div className="data text-[9.5px] uppercase tracking-[0.18em] text-[var(--faint)]">
                    {s.label}
                  </div>
                  <div
                    className={`data mt-1 truncate text-[13px] ${s.green ? "text-[var(--green)]" : ""}`}
                  >
                    {s.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between bg-[color-mix(in_srgb,var(--green)_90%,transparent)] px-4 py-2.5">
              <span className="data truncate text-[10.5px] font-semibold tracking-[0.12em] text-[#04270a]">
                hoodfi.name/{name.label}
              </span>
              <span className="data shrink-0 text-[10.5px] font-semibold tracking-[0.12em] text-[rgba(4,39,10,0.7)]">
                ROBINHOOD CHAIN
              </span>
            </div>
          </div>
        </div>
      </div>

      {actions && (
        <div className="flex flex-wrap gap-2.5">
          <a
            className="btn btn-primary min-w-[150px] flex-1"
            href={`https://x.com/intent/post?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => track("share_clicked", { method: "search" })}
          >
            <XLogo /> Share on X
          </a>
          <button
            type="button"
            className="btn btn-ghost min-w-[150px] flex-1"
            onClick={() => copy("link", shareUrl)}
          >
            {copied === "link" ? "Link copied ✓" : "Copy link"}
          </button>
        </div>
      )}
    </div>
  );
}
