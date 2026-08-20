"use client";

/** The id the "Create names below" button scrolls to. */
export const SUBNAME_SECTION_ID = "create-subnames";

/**
 * What the left column says under the card.
 *
 * The card and its two buttons are short, and the records column beside them is long,
 * so the column used to run out of content about a fifth of the way down the page and
 * leave a tall empty strip. This fills it with the one thing an owner standing on this
 * page cannot otherwise discover: that the name they are looking at can issue names of
 * its own, and what that costs.
 *
 * Deliberately explanatory rather than decorative. The controls themselves are below
 * the fold in the full-width section, and a reader who never scrolls that far would
 * otherwise never learn they exist.
 */
export function SubnameCallout({ path }: { path: string }) {
  function jump() {
    const el = document.getElementById(SUBNAME_SECTION_ID);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="cells border border-[var(--line-card)]">
        <div className="flex-[1_1_190px] border-l border-[var(--line-card)] bg-[var(--paper-alt)] px-5 py-5">
          <div className="eyebrow">01 / Subnames</div>
          <h4 className="h-sub mt-3">Names under your name</h4>
          <p className="mt-3 text-sm leading-relaxed text-[var(--dim)]">
            {/* break-words, not break-all: a name is read as one token, and splitting
                `jack.crypto.gm` into `jack.crypt` / `o.gm` mid-word makes it unreadable
                at exactly the width where it matters most. */}
            Hold <span className="data break-words">{path}</span> and you can create{" "}
            <span className="data break-words">jack.{path}</span> — as many as you like,
            for gas.
          </p>
        </div>
        <div className="flex-[1_1_190px] border-l border-[var(--line-card)] bg-[var(--paper-alt)] px-5 py-5">
          <div className="eyebrow">02 / Forever</div>
          <h4 className="h-sub mt-3">No renewals, no reclaim</h4>
          <p className="mt-3 text-sm leading-relaxed text-[var(--dim)]">
            Nothing expires and nothing lapses. Records are yours to rewrite — we
            can&apos;t change or take one back.
          </p>
        </div>
      </div>

      <div className="on-ink px-6 py-7">
        <div className="eyebrow" style={{ color: "var(--lime)" }}>
          Gas only
        </div>
        <h4 className="h-sub mt-3 text-[var(--fg)]">Give one to a friend.</h4>
        <p className="mt-3 text-sm leading-relaxed text-[var(--dim)]">
          Send them a name beneath yours. It resolves the moment they get it, and
          it&apos;s theirs outright — same lifetime terms as yours.
        </p>
        <button type="button" className="btn btn-lime mt-6" onClick={jump}>
          Create names below
        </button>
      </div>
    </div>
  );
}
