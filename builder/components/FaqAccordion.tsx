"use client";

import { useState } from "react";

export type FaqItem = { q: string; a: string };

/**
 * Single-open accordion. Clicking the open item closes it, so there is always a way
 * back to the list of questions without scrolling past an answer you have read.
 *
 * `startIndex` continues the numbering across the grouped sections on /faq/ — the
 * indices are a running count through the page, not a per-group one, so no two rows
 * carry the same number.
 */
export function FaqAccordion({
  items,
  startIndex = 0,
}: {
  items: FaqItem[];
  startIndex?: number;
}) {
  const [open, setOpen] = useState(-1);

  return (
    <div className="border-t border-[var(--line)]">
      {items.map((item, i) => {
        const isOpen = open === i;
        const n = String(startIndex + i + 1).padStart(2, "0");
        return (
          <div key={item.q} className="border-b border-[var(--line)]">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? -1 : i)}
              aria-expanded={isOpen}
              className="grid w-full cursor-pointer grid-cols-[44px_minmax(0,1fr)_40px] items-baseline gap-4 py-6 text-left"
            >
              <span className="data text-[11px] tracking-[0.14em] text-[var(--faint)]">{n}</span>
              <span className="text-[clamp(18px,2.2vw,22px)] font-bold leading-[1.2] tracking-[-0.025em]">
                {item.q}
              </span>
              <span className="text-right text-[20px] leading-none text-[var(--label)]" aria-hidden>
                {isOpen ? "–" : "+"}
              </span>
            </button>
            {isOpen && (
              <div className="max-w-[80ch] pb-7 pl-[44px] pr-10 text-[16px] leading-[1.65] text-[var(--dim)] sm:pl-20">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
