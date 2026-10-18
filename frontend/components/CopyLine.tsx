"use client";

import { useState } from "react";

/**
 * A value someone pastes somewhere else — the connector URL, a first prompt — on the
 * ink ground the page's code blocks use, with a Copy button. `prose` wraps for a
 * sentence; otherwise it is one mono line that breaks anywhere rather than overflow.
 */
export function CopyLine({ text, prose = false }: { text: string; prose?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the text is selectable */
    }
  };
  return (
    <div className="panel panel-ink on-ink flex items-center gap-3 p-2 pl-5">
      <span
        className={`min-w-0 flex-1 py-2 text-[var(--fg)] select-all ${
          prose ? "text-[15px] leading-[1.55]" : "data break-all text-[13px]"
        }`}
      >
        {prose ? `“${text}”` : text}
      </span>
      <button type="button" onClick={copy} className="btn btn-lime flex-none">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
