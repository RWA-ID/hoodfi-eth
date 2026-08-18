"use client";

import type { ReactNode } from "react";

/**
 * Browser and phone chrome around the preview.
 *
 * A bare rectangle of scaled HTML reads as a screenshot of something unfinished. The
 * chrome does real work beyond decoration: it tells you which of the two layouts you
 * are looking at without reading a toggle, and the address bar shows the URL the site
 * will actually answer at — which is the single fact most people want confirmed before
 * they pay.
 *
 * Drawn in CSS rather than shipped as images: two PNGs at 2x would outweigh every font
 * in the app put together, and they could not carry live text in the address bar.
 */

export function BrowserFrame({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-[var(--line-card)] bg-[var(--paper-alt)] shadow-[0_18px_40px_-24px_rgba(11,14,8,0.5)]">
      <div className="flex items-center gap-3 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-3 py-2.5">
        <span className="flex shrink-0 gap-[6px]" aria-hidden>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span
              className="block h-[10px] w-[10px] rounded-full"
              key={c}
              style={{ background: c }}
            />
          ))}
        </span>
        {/* The real destination, not a placeholder. */}
        <span className="data min-w-0 flex-1 truncate rounded-[5px] bg-[var(--paper)] px-2.5 py-1 text-center text-[11px] text-[var(--label)]">
          {url}
        </span>
        <span className="w-[52px] shrink-0" aria-hidden />
      </div>
      {children}
    </div>
  );
}

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-fit rounded-[34px] border border-[var(--line-card)] bg-[var(--ink)] p-[9px] shadow-[0_18px_40px_-24px_rgba(11,14,8,0.55)]">
      <div className="relative overflow-hidden rounded-[26px] bg-[var(--paper)]">
        {/* Dynamic island. Sits over the page, as it does on the device — so a template
            whose header hides under it is a real finding rather than a framing artefact. */}
        <span
          aria-hidden
          className="absolute left-1/2 top-[7px] z-10 h-[18px] w-[62px] -translate-x-1/2 rounded-full bg-[var(--ink)]"
        />
        {children}
      </div>
    </div>
  );
}
