"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserFrame, PhoneFrame } from "./DeviceFrame";

type Props = {
  html: string;
  label: string;
  /** Changes to this apply immediately; only content edits are debounced. */
  instantKey?: string;
};

const WIDTHS = [
  { id: "desktop", label: "Desktop", width: 1280 },
  { id: "phone", label: "Phone", width: 390 },
] as const;

/** Frame heights. Shorter than the old bare box, per the brief. */
const DESKTOP_H = "h-[min(58vh,560px)]";
const PHONE_H = 620;

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
export function SitePreview({ html, label, instantKey }: Props) {
  const [mode, setMode] = useState<(typeof WIDTHS)[number]["id"]>("desktop");

  /**
   * Two frames, alternating, and a settle delay before either is touched.
   *
   * Replacing `srcdoc` tears the iframe document down and reloads it, so updating on
   * every keystroke meant a full reload per character — which is the flicker: the frame
   * repaints empty before the new document paints. Neither half fixes this alone.
   * Debouncing alone still flashes, once per pause. Swapping alone flashes less but
   * still reloads constantly and burns CPU on a page that also holds a wallet
   * connection.
   *
   * So: wait until typing settles, render into whichever frame is hidden, and reveal it
   * only once it reports `load`. The visible frame never goes blank because it is never
   * the one being written to.
   */
  const [docs, setDocs] = useState<[string, string]>([html, ""]);
  const [front, setFront] = useState(0);
  const pending = useRef<number | null>(null);

  const lastKey = useRef(instantKey);

  /**
   * Which buffer, if any, is waiting to be revealed once it paints.
   *
   * Without this the reveal was "any hidden frame that fires `load` and holds something",
   * and a hidden frame holds the PREVIOUS template. Two ways that fired wrongly, both
   * reported:
   *
   * 1. Switching device toggles the whole frame between BrowserFrame and PhoneFrame —
   *    different component types, so React unmounts and remounts both iframes and BOTH
   *    fire `load` again. The stale one won, and the phone frame showed the template you
   *    had been on before. Terminal's preview arriving in Archivo bold was the same bug
   *    wearing a different template.
   * 2. Picking A, then B, then A again before B painted: the effect saw the wanted html
   *    already in the front buffer and returned early, leaving B's swap armed. B landed a
   *    moment later and the picker and the preview disagreed.
   */
  const awaiting = useRef<number | null>(null);

  useEffect(() => {
    if (html === docs[front]) {
      // Already showing what was asked for, so any armed swap is stale by definition.
      // Disarming here is the whole of case 2 above.
      awaiting.current = null;
      if (pending.current) window.clearTimeout(pending.current);
      lastKey.current = instantKey;
      return;
    }
    if (pending.current) window.clearTimeout(pending.current);

    const apply = () => {
      const back = front === 0 ? 1 : 0;
      awaiting.current = back;
      setDocs((d) => (back === 0 ? [html, d[1]] : [d[0], html]));
    };

    // A template change is a deliberate click, not typing — waiting on it reads as the
    // picker being slow. Only content edits get the settle delay.
    if (instantKey !== lastKey.current) {
      lastKey.current = instantKey;
      apply();
      return;
    }

    // 220ms: past a fast typist's inter-key gap, under the point where the preview feels
    // detached from the field being edited.
    pending.current = window.setTimeout(apply, 220);
    return () => {
      if (pending.current) window.clearTimeout(pending.current);
    };
  }, [html, docs, front, instantKey]);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [innerHeight, setInnerHeight] = useState(560);

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
      setInnerHeight(el.clientHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  const frameUrl = `${label}.hoodfi.eth.link`;

  const frameStyle = {
    width: `${width}px`,
    height: `${Math.round(innerHeight / scale)}px`,
    border: 0,
    transform: `scale(${scale})`,
    transformOrigin: "top left",
    background: "#fff",
    display: "block",
  } as const;

  const frame = (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {docs.map((doc, i) => (
        <iframe
          aria-hidden={i !== front}
          key={i}
          title={i === front ? `${label}.hoodfi.eth preview` : ""}
          srcDoc={doc || undefined}
          sandbox="allow-scripts allow-same-origin"
          /* Never loading="lazy": an iframe outside the initial viewport with lazy set
             never loads at all, which is how the site's phone-frame preview shipped
             invisible once. */
          onLoad={() => {
            // Reveal only the frame that was armed for it, and only once. A `load` from
            // anything else — a remount, an about:blank after the clear below — is noise.
            if (awaiting.current !== i) return;
            awaiting.current = null;
            setFront(i);
            // Empty the frame we just left. It holds a render nobody will see again, and
            // an empty buffer cannot be mistaken for a current one on the next remount.
            setDocs((d) => (i === 0 ? [d[0], ""] : ["", d[1]]));
          }}
          style={{
            ...frameStyle,
            position: "absolute",
            inset: 0,
            opacity: i === front ? 1 : 0,
            pointerEvents: i === front ? "auto" : "none",
          }}
        />
      ))}
    </div>
  );

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

      <div className="mt-5">
        {mode === "desktop" ? (
          <BrowserFrame url={frameUrl}>
            {/* Measured here, not on an ancestor: the scale is a ratio of THIS box's
                width to the page's 1280, and the height the iframe needs is this box's
                height divided by that scale. A percentage would resolve against an auto
                height and collapse the frame — it shipped at 96px once. */}
            <div ref={box} className={`${DESKTOP_H} overflow-hidden bg-white`}>{frame}</div>
          </BrowserFrame>
        ) : (
          <PhoneFrame>
            <div ref={box} style={{ width: 390 * scale, height: PHONE_H }} className="overflow-hidden bg-white">
              {frame}
            </div>
          </PhoneFrame>
        )}
      </div>
    </div>
  );
}
