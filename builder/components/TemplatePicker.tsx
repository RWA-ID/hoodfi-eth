"use client";

import { TEMPLATES, type TemplateId } from "@/lib/templates/index.ts";

type Props = {
  selected: TemplateId;
  onSelect: (id: TemplateId) => void;
};

/**
 * Four cells, one lit.
 *
 * No thumbnails yet, deliberately: the preview beside this updates the instant a
 * template is picked, with the visitor's own content in it, which tells them more than
 * a picture of somebody else's site would. Cover images are what partner templates will
 * need — a template you cannot use until you hold the NFT has to show you what it looks
 * like some other way.
 *
 * flex-wrap with grown children rather than auto-fit columns, so the bordered rectangle
 * closes on its last row at every width.
 */
export function TemplatePicker({ selected, onSelect }: Props) {
  return (
    <div className="cells border-l border-t border-[var(--line)]">
      {TEMPLATES.map((t) => {
        const isSelected = t.id === selected;
        return (
          <button
            aria-pressed={isSelected}
            className={`min-w-0 flex-[1_1_190px] cursor-pointer border-b border-r border-[var(--line)] p-5 text-left transition-colors ${
              isSelected ? "bg-[var(--ink)] text-[var(--paper)]" : "hover:bg-[var(--hover-fill)]"
            }`}
            key={t.id}
            onClick={() => onSelect(t.id)}
            type="button"
          >
            <div
              className={`data text-[10.5px] uppercase tracking-[0.18em] ${
                isSelected ? "text-[var(--lime)]" : "text-[var(--faint)]"
              }`}
            >
              {isSelected ? "Selected" : t.audience}
            </div>
            <div className="mt-3 text-[19px] font-extrabold leading-none tracking-[-0.03em]">
              {t.name}
            </div>
            <p
              className={`mt-2.5 text-[13px] leading-[1.55] ${
                isSelected ? "text-[rgba(241,241,234,0.7)]" : "text-[var(--dim)]"
              }`}
            >
              {t.blurb}
            </p>
          </button>
        );
      })}
    </div>
  );
}
