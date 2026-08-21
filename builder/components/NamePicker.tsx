"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chevron } from "./ArrowNE";
import type { OwnedName } from "./useMyNames";

/**
 * Choosing which name to build on: every name the wallet holds, as one or two rows that
 * slide sideways.
 *
 * Used on both the homepage panel and the editor header, which sit on opposite grounds.
 * Everything here is drawn from the role tokens, so the only thing `tone` decides is the
 * one genuinely per-ground choice — what a selected pill is filled with, since lime on
 * ink and ink on lime are the two ways this design says "this one".
 *
 * Names and subnames are separated because they are different things to publish on: one
 * is the name you bought, the others you created beneath it and can make freely. Before
 * this they were one undifferentiated row, and — because the pills showed only a
 * leftmost label — `crypto.gm.hoodfi.eth` and `crypto.hoodfi.eth` were drawn as the same
 * word, which is how a publish ended up paid for on the wrong name.
 */
export function NamePicker({
  names,
  selectedNode,
  onSelect,
  tone,
  suffix = true,
  className = "",
}: {
  names: OwnedName[];
  selectedNode: string | undefined;
  onSelect: (name: OwnedName) => void;
  tone: "ink" | "lime";
  /**
   * Whether each pill spells out `.hoodfi.eth`.
   *
   * Off in the editor, where the headline beside the picker already says the whole name:
   * repeating the same eleven characters on every pill there is noise that also halves
   * how many names fit before the row has to scroll.
   */
  suffix?: boolean;
  className?: string;
}) {
  // Null when every name falls on the same side — a wallet with no subnames should not be
  // told which kind its names are.
  const split = (() => {
    const roots: OwnedName[] = [];
    const subs: OwnedName[] = [];
    for (const name of names) (name.path.includes(".") ? subs : roots).push(name);
    return roots.length > 0 && subs.length > 0 ? { roots, subs } : null;
  })();

  const row = { selectedNode, onSelect, tone, suffix };

  return (
    <div className={`flex flex-col gap-3.5 ${className}`}>
      {split ? (
        <>
          <NameRow label={`Names · ${split.roots.length}`} group="names" names={split.roots} {...row} />
          <NameRow
            label={`Subnames · ${split.subs.length}`}
            group="subnames"
            names={split.subs}
            {...row}
          />
        </>
      ) : (
        <NameRow names={names} {...row} />
      )}
    </div>
  );
}

function NameRow({
  label,
  group = "names",
  names,
  selectedNode,
  onSelect,
  tone,
  suffix,
}: {
  label?: string;
  /** What the row holds, for the arrows' screen-reader labels. No count: it is noise read
   *  aloud and it changes every time a name is minted. */
  group?: string;
  names: OwnedName[];
  selectedNode: string | undefined;
  onSelect: (name: OwnedName) => void;
  tone: "ink" | "lime";
  suffix: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  // Which way there is more to see. Drives the arrows and the edge fade together, so a
  // row that fits shows neither and reads as a plain row of pills.
  const [more, setMore] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // A pixel of slack: fractional widths mean scrollLeft never quite reaches `max`, which
    // would leave the right arrow live at the end of the row forever.
    setMore({ left: el.scrollLeft > 1, right: el.scrollLeft < max - 1 });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    // Resizing changes what fits without firing a scroll event.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, names.length]);

  function nudge(direction: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    // Most of a screenful, not a fixed number of pills: these are name-width, so there is
    // no pitch to step by.
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }

  const arrows = more.left || more.right;

  return (
    <div className="min-w-0">
      {(label || arrows) && (
        <div className="mb-2 flex items-center gap-3">
          {label && <span className="label">{label}</span>}
          <span className="h-px min-w-4 flex-1 bg-[var(--line-soft)]" />
          {arrows && (
            <div className="flex shrink-0 gap-1.5">
              {(["left", "right"] as const).map((dir) => (
                <button
                  key={dir}
                  aria-label={`Scroll ${group} ${dir}`}
                  className="grid h-6 w-6 cursor-pointer place-items-center border border-[var(--line-card)] text-[10px] text-[var(--fg)] transition-colors hover:bg-[var(--hover-fill)] disabled:cursor-default disabled:border-[var(--line-soft)] disabled:text-[var(--faint)] disabled:hover:bg-transparent"
                  disabled={!more[dir]}
                  onClick={() => nudge(dir === "left" ? -1 : 1)}
                  type="button"
                >
                  <Chevron dir={dir} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Faded on whichever side has more, so the row reads as cut off rather than as
          ending at the container edge. A mask rather than a ground-coloured overlay: this
          row is drawn on ink in one place and on lime in another, and a mask does not care
          which. */}
      <div
        ref={scroller}
        className="-mx-1 -my-1 flex snap-x gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={measure}
        style={{ maskImage: edgeFade(more), WebkitMaskImage: edgeFade(more) }}
      >
        {names.map((name) => {
          const selected = name.node === selectedNode;
          return (
            <button
              key={name.node}
              aria-pressed={selected}
              className={`data shrink-0 cursor-pointer whitespace-nowrap border px-4 py-2.5 text-[13.5px] transition-colors ${
                selected
                  ? tone === "ink"
                    ? "border-[var(--lime)] bg-[var(--lime)] text-[var(--ink)]"
                    : "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
                  : "border-[var(--line-card)] text-[var(--fg)] hover:bg-[var(--hover-fill)]"
              }`}
              onClick={() => onSelect(name)}
              type="button"
            >
              {/* The whole path, never the leftmost label — two names that differ only in
                  their parent must not draw as the same word. */}
              <span className="font-semibold">{name.path}</span>
              {suffix && <span className="opacity-50">.hoodfi.eth</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The mask for a row, or `undefined` when it fits and needs none. */
function edgeFade(more: { left: boolean; right: boolean }): string | undefined {
  if (!more.left && !more.right) return undefined;
  const from = more.left ? "transparent 0, #000 28px" : "#000 0";
  const to = more.right ? "#000 calc(100% - 28px), transparent 100%" : "#000 100%";
  return `linear-gradient(to right, ${from}, ${to})`;
}
