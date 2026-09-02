"use client";

import { useEffect, useState } from "react";
import { PAYBOX_APPS } from "@/lib/paybox";

const INTERVAL_MS = 2400;
/** Half of the flip: how long the word spends edge-on before the next one appears. */
const HALF_MS = 320;

/**
 * The brand that cycles inside the PayBox headlines — Claude → ChatGPT → Grok.
 *
 * The only client component in either PayBox section; both are otherwise server
 * rendered around it.
 *
 * ## Two properties that are not decoration
 *
 * **The width never reflows.** All three brands are rendered stacked in a single grid
 * cell with the inactive ones `visibility: hidden`, so the span always reserves the
 * *widest* brand's width. Rendering only the active one instead makes the headline
 * resize four times a second, and "Claude" → "ChatGPT" is wide enough to push the
 * line onto an extra row and shove everything below it down. Any reimplementation has
 * to keep the stack.
 *
 * **It starts on index 0 and only moves in an effect.** The first paint is identical
 * on the server and the client, so there is no hydration mismatch to reconcile — the
 * cycle begins after mount.
 *
 * `prefers-reduced-motion: reduce` is honoured by never starting the interval, which
 * leaves the first brand showing statically rather than flashing once and stopping.
 */
export function PayboxFlipWord() {
  const [brand, setBrand] = useState(0);
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let half: ReturnType<typeof setTimeout> | undefined;
    const timer = setInterval(() => {
      setFlipping(true);
      half = setTimeout(() => {
        setBrand((current) => (current + 1) % PAYBOX_APPS.length);
        setFlipping(false);
      }, HALF_MS);
    }, INTERVAL_MS);

    // Both must go: the nested timeout can otherwise fire after unmount.
    return () => {
      clearInterval(timer);
      clearTimeout(half);
    };
  }, []);

  return (
    <span
      /* Stacking is done with `grid-area: 1/1` on the children rather than a named
         template area: one less quoted arbitrary value for Tailwind to parse, same
         single cell. */
      className="inline-grid items-center justify-items-start whitespace-nowrap align-baseline [perspective:800px]"
      /* One live region would announce a word changing every 2.4s forever, so the
         whole thing is hidden from assistive tech and the sentence is completed for
         a screen reader by the visually-hidden text in the headings that use it. */
      aria-hidden
    >
      {PAYBOX_APPS.map((app, index) => (
        <span
          key={app.id}
          className="inline-flex items-center gap-[0.16em] [grid-area:1/1]"
          /* The whole flip is expressed here rather than as arbitrary utilities: the
             transition is two comma-separated parts, which is exactly the shape
             Tailwind's arbitrary-value parser can split in the wrong place. */
          style={{
            transformOrigin: "50% 55%",
            transition:
              "transform .32s cubic-bezier(.4,0,.2,1), opacity .32s ease",
            visibility: index === brand ? "visible" : "hidden",
            transform:
              flipping && index === brand ? "rotateX(88deg)" : "rotateX(0deg)",
            opacity: flipping && index === brand ? 0.15 : 1,
          }}
        >
          {/* Plain <img>, not next/image: the mark is sized in `em` so it tracks the
              headline's clamp, and next/image's width/height attributes exist to
              reserve a pixel box this deliberately does not have. `images.unoptimized`
              is set, so there is no optimisation being given up. */}
          <img
            src={app.mark.src}
            alt=""
            width={app.mark.width}
            height={app.mark.height}
            className="block h-[0.72em] w-auto translate-y-[-0.02em]"
          />
          <span>{app.label}</span>
        </span>
      ))}
    </span>
  );
}
