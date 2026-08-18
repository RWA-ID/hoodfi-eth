"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  html: string;
  label: string;
};

const WIDTHS = [
  { id: "desktop", label: "Desktop", width: 1280 },
  { id: "phone", label: "Phone", width: 390 },
] as const;

/**
 * The site, as it will actually be.
 *
 * `srcdoc` rather than a blob URL: the preview must be exactly the bytes that get
 * pinned, and a blob URL introduces a different origin and its own lifecycle to leak.
 * The iframe is scaled rather than resized so a 1280px layout can be judged inside a
 * 500px column — transform:scale keeps the page's own media queries answering to 1280,
 * which is the point. Sizing the frame down instead would show the phone layout and
 * call it desktop.
 *
 * `sandbox` allows scripts and same-origin because the templates ship a copy-to-clipboard
 * handler and a hash-anchor interceptor; without allow-scripts the preview would be
 * subtly less alive than the real thing. It withholds allow-top-navigation and
 * allow-popups, so nothing inside can move the builder out from under someone — which
 * matters more here than usual, since template HTML will eventually come from partners.
 */
export function SitePreview({ html, label }: Props) {
  const [mode, setMode] = useState<(typeof WIDTHS)[number]["id"]>("desktop");
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [boxHeight, setBoxHeight] = useState(560);

  const width = WIDTHS.find((w) => w.id === mode)!.width;

  // Both dimensions are measured, and the iframe's height is then set in PIXELS.
  //
  // A percentage height here silently collapses: the frame's parent has a min-height
  // rather than a height, so `height: 156%` resolves against an auto height and the
  // iframe falls back to its 150px default — which the scale transform then shrinks to
  // 96px. The build passes, the types pass, and the preview is a letterbox. Only a
  // screenshot showed it.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      setScale(Math.min(1, el.clientWidth / width));
      setBoxHeight(el.clientHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
        <span className="label">Preview</span>
        <div className="flex items-stretch border border-[var(--line)]">
          {WIDTHS.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setMode(w.id)}
              aria-pressed={mode === w.id}
              className={`data cursor-pointer px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-colors ${
                mode === w.id ? "bg-[var(--ink)] text-[var(--paper)]" : "hover:bg-[var(--hover-fill)]"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* A definite height, not a min-height: the frame inside is sized against this,
          and `flex-1` on a parent that is itself auto-height gives it nothing to
          resolve against. Tall enough to judge a hero, short enough to keep the form
          beside it in view. */}
      <div
        ref={box}
        className="mt-4 h-[min(72vh,760px)] overflow-hidden border border-[var(--line)] bg-[var(--paper-alt)]"
      >
        <iframe
          title={`${label}.hoodfi.eth preview`}
          srcDoc={html}
          sandbox="allow-scripts allow-same-origin"
          /* Never loading="lazy": an iframe outside the initial viewport with lazy set
             never loads at all, which is how the site's phone-frame preview shipped
             invisible once. */
          style={{
            width: `${width}px`,
            height: `${Math.round(boxHeight / scale)}px`,
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            background: "#fff",
          }}
        />
      </div>
    </div>
  );
}
