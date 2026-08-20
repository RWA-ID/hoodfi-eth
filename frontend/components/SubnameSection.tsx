"use client";

import { PrimerCard } from "./PrimerCard";
import { SubnameCreator } from "./SubnameCreator";
import { TransferName } from "./TransferName";
import type { OwnedName } from "./useMyNames";

/** The id a deep link or a jump lands on. */
export const SUBNAME_SECTION_ID = "create-subnames";

/**
 * Everything on the manage page that acts on the *name* rather than on its records.
 *
 * A section of its own, below the editor and outside its two-column grid. Creating
 * names beneath yours used to be the bottom half of the records box, sharing its border
 * and its heading weight, which read as a footnote to editing an avatar. It is the
 * second thing a hoodfi name can do, so it gets an ink card, and the primer that used
 * to sit beside the profile card now sits beside the form it describes.
 *
 * `items-stretch` is load-bearing: the rail's lime card grows to take up whatever slack
 * the creator card's row count leaves, so the two columns end on the same line however
 * many names are being created.
 */
export function SubnameSection({
  name,
  onChanged,
}: {
  name: OwnedName;
  onChanged: () => void;
}) {
  // The rail speaks about the immediate parent — `agent`, not `agent.hoodfi.eth` — so
  // the example name it prints stays short enough to read at 12.5px in a 300px column.
  const parentLabel = name.name.split(".")[0];

  return (
    <section id={SUBNAME_SECTION_ID} className="flex scroll-mt-24 flex-col gap-[18px]">
      <div className="flex flex-col items-stretch gap-[18px] min-[900px]:flex-row">
        <SubnameCreator name={name} onCreated={onChanged} />

        {/* Annotation, not chrome: paper blocks on the page ground so they read as
            margin notes against the ink card rather than as a second form. */}
        <div className="flex flex-col gap-[18px] min-[900px]:w-[300px] min-[900px]:flex-none">
          {/* Tailwind classes rather than `.cells`: every rule in globals.css is
              unlayered, so `.cells`'s own `display:flex` would beat the `contents`
              utility and the two cards would stay a row inside a column. Wide enough
              for the rail, they stack; narrower, the rail is full width and they sit
              side by side. */}
          <div className="flex flex-wrap gap-[18px] min-[900px]:contents">
            <PrimerCard
              eyebrow="01 / subnames"
              title="Names under your name"
              className="flex-[1_1_240px] min-[900px]:flex-none"
            >
              {/* break-words, not break-all: a name is read as one token, and splitting
                  `jack.crypto` into `jack.cryp` / `to` mid-word makes it unreadable at
                  exactly the width where it matters most. */}
              Hold <span className="data break-words">{parentLabel}</span> and you can
              create <span className="data break-words">jack.{parentLabel}</span> — as
              many as you like, for gas.
            </PrimerCard>
            <PrimerCard
              eyebrow="02 / forever"
              title="No renewals, no reclaim"
              className="flex-[1_1_240px] min-[900px]:flex-none"
            >
              Nothing expires and nothing lapses. Records are yours to rewrite — we
              can&apos;t change or take one back.
            </PrimerCard>
          </div>

          {/* No button. The form it would point at is directly beside it. */}
          <div className="shadow-card flex flex-col gap-2.5 border border-[var(--ink)] bg-[var(--lime)] px-[17px] pb-5 pt-[18px] text-[var(--ink)] min-[900px]:flex-[1_1_auto]">
            <span className="data text-[10px] uppercase tracking-[0.2em] text-[rgba(11,14,8,0.62)]">
              gas only
            </span>
            <h4 className="text-[20px] font-bold leading-[1.06] tracking-[-0.03em]">
              Give one to a friend.
            </h4>
            <p className="text-[12.5px] leading-[1.55] text-pretty text-[rgba(11,14,8,0.72)]">
              Send them a name beneath yours. It resolves the moment they get it, and
              it&apos;s theirs outright — same lifetime terms as yours.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 bg-[var(--ink)] px-[17px] py-[13px]">
            <span className="data text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--paper)]">
              free wallet names
            </span>
            <span className="data text-[11px] uppercase tracking-[0.14em] text-[var(--lime)]">
              gas only
            </span>
          </div>
        </div>
      </div>

      <TransferName name={name} onTransferred={onChanged} />
    </section>
  );
}
