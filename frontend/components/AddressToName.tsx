"use client";

import { useEffect, useReducer, useState } from "react";

/**
 * The pitch, typed out.
 *
 * A partner has to be told what the product does before they will read a form, and
 * "ENS subnames on Robinhood Chain" is a sentence that only lands for people who
 * already know what it means. This states it in the one currency everybody in the room
 * has felt: forty-two characters of hex, replaced by a word.
 *
 * Deliberately not a video or a GIF — it is ~60 lines of state machine and a monospace
 * span, so it costs nothing to ship, stays sharp at every width, and cannot be the
 * thing that fails to load on the page whose whole job is to be answered.
 *
 * The addresses are synthetic. Pairing a real address with an invented name implies a
 * relationship that does not exist, and these are read as examples by definition.
 */

type Pair = { address: string; name: string };

const PAIRS: Pair[] = [
  { address: "0x7A3fC0d4B81E5a2c9F604e7b8Db31aE05C9f2D6b", name: "payroll.hoodfi.eth" },
  { address: "0xC41e08B7a95D3f206Ea4c1739bB0d5E82F7c34A9", name: "tips.hoodfi.eth" },
  { address: "0x2Fb98E6cA07d514Bf3a9E0d762c8451DbA36e9F0", name: "checkout.hoodfi.eth" },
  { address: "0xE86b19D4cf05A73B2e18c4d90Fa7256Bc3d81e47", name: "agent01.hoodfi.eth" },
];

/**
 * Timings, in ms. The hex types faster per character than the name does: it is forty-two
 * characters of noise nobody reads, so at the name's pace it becomes a wait rather than
 * a demonstration, while the name itself wants to land one letter at a time.
 */
const HEX_CHAR = 16;
const NAME_CHAR = 62;
const ERASE_CHAR = 9;
const HOLD_HEX = 900;
const HOLD_NAME = 2200;

type Phase = "typing-hex" | "hold-hex" | "erasing" | "typing-name" | "hold-name";

type State = { pair: number; phase: Phase; chars: number };

const START: State = { pair: 0, phase: "typing-hex", chars: 0 };

/**
 * One tick of the machine.
 *
 * A reducer rather than a pile of useStates because the phases advance off a single
 * timer whose delay depends on the phase it is currently in — with separate state the
 * timer reads a stale phase on the tick that changes it, and the animation drops a beat
 * every cycle at exactly the transition the eye is watching.
 */
function step(state: State): State {
  const pair = PAIRS[state.pair];

  switch (state.phase) {
    case "typing-hex":
      return state.chars < pair.address.length
        ? { ...state, chars: state.chars + 1 }
        : { ...state, phase: "hold-hex" };

    case "hold-hex":
      return { ...state, phase: "erasing" };

    case "erasing":
      return state.chars > 0
        ? { ...state, chars: state.chars - 1 }
        : { ...state, phase: "typing-name" };

    case "typing-name":
      return state.chars < pair.name.length
        ? { ...state, chars: state.chars + 1 }
        : { ...state, phase: "hold-name" };

    case "hold-name":
      // Wrap to the first pair rather than stopping: this sits above a form, and a
      // demo that runs once is over before most people have scrolled to it.
      return { pair: (state.pair + 1) % PAIRS.length, phase: "typing-hex", chars: 0 };
  }
}

function delayFor(state: State): number {
  switch (state.phase) {
    case "typing-hex":
      return HEX_CHAR;
    case "hold-hex":
      return HOLD_HEX;
    case "erasing":
      return ERASE_CHAR;
    case "typing-name":
      return NAME_CHAR;
    case "hold-name":
      return HOLD_NAME;
  }
}

/** True once the name is what's on screen — drives the colour and the caption. */
function showingName(phase: Phase): boolean {
  return phase === "typing-name" || phase === "hold-name";
}

/** The panel's chrome, shared by the animated and the still version. */
function Frame({
  caption,
  count,
  children,
}: {
  caption: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="panel panel-ink on-ink p-6 sm:p-8">
      <div className="flex items-baseline justify-between gap-4">
        <div className="label">{caption}</div>
        {/* The count is the argument, so it is stated rather than implied. Fixed to the
            full length, not the typed length — a number counting up character by
            character is a progress bar, and the point is the before and after. */}
        <div className="data text-[11px] tracking-[0.14em] text-[var(--faint)]">
          {count} chars
        </div>
      </div>
      {children}
      <p className="mt-5 max-w-[46ch] text-sm leading-relaxed text-[rgba(241,241,234,0.6)]">
        Same destination, both times. One of them your customer can read back over the
        phone.
      </p>
    </div>
  );
}

export function AddressToName() {
  const [state, tick] = useReducer(step, START);
  /**
   * Whether to run at all, resolved after mount.
   *
   * Read in an effect rather than during render because this component is prerendered
   * into static HTML: the build has no media query to answer, so reading it inline
   * would make the server and client disagree on the first paint.
   *
   * `null` is the third state and it matters — it means "not yet known", and it is what
   * the exported HTML is built against. Rendering the still version until the answer
   * arrives means the panel is never blank, including for anyone whose JavaScript
   * failed on the way from an IPFS gateway.
   */
  const [animate, setAnimate] = useState<boolean | null>(null);

  useEffect(() => {
    // One honest opt-out. Someone who has asked for less motion does not want
    // forty-two characters arriving one at a time, however tasteful.
    setAnimate(!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const delay = delayFor(state);

  useEffect(() => {
    if (!animate) return;
    const id = window.setInterval(tick, delay);
    return () => window.clearInterval(id);
    // `delay` is the real dependency: the interval is rebuilt only when the phase
    // changes the cadence, and `tick` is a stable dispatch, so the cadence stays even
    // instead of restarting on every character.
  }, [animate, delay]);

  const pair = PAIRS[state.pair];

  // The still version: both halves at once, which is the same argument without the
  // performance. Also what the prerendered HTML contains.
  if (!animate) {
    return (
      <Frame caption="how it reads" count={pair.name.length}>
        <div className="mt-4 text-[clamp(15px,3.5vw,25px)] leading-[1.3]">
          <div className="data break-all text-[rgba(241,241,234,0.55)] line-through decoration-[rgba(241,241,234,0.3)]">
            {pair.address}
          </div>
          <div className="data mt-2 break-all text-[var(--lime)]">{pair.name}</div>
        </div>
      </Frame>
    );
  }

  const isName = showingName(state.phase);
  const full = isName ? pair.name : pair.address;

  return (
    <Frame caption={isName ? "how it reads" : "how it reads today"} count={full.length}>
      {/* Two lines of headroom, reserved. The hex wraps on a phone and the name does
          not, so without a floor the panel jumps by a line four times a cycle and drags
          the form below it up and down the page.

          aria-hidden because a string that changes every 16ms is not something a screen
          reader can be asked to follow — the still equivalent is next to it, off-screen. */}
      <div
        aria-hidden
        className="mt-4 min-h-[2.6em] text-[clamp(15px,3.5vw,25px)] leading-[1.3]"
      >
        <span
          className={`data break-all transition-colors duration-300 ${
            isName ? "text-[var(--lime)]" : "text-[rgba(241,241,234,0.55)]"
          }`}
        >
          {full.slice(0, state.chars)}
        </span>
        {/* A block, not a pipe: every other edge in this design is square. */}
        <span className="ml-0.5 inline-block h-[0.95em] w-[0.5em] translate-y-[0.08em] animate-pulse bg-[var(--lime)]" />
      </div>
      <p className="sr-only">
        {pair.address} resolves to {pair.name}.
      </p>
    </Frame>
  );
}
