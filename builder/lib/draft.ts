import type { SiteData, TemplateId } from "./templates/index.ts";
import { EMPTY_SITE } from "./templates/index.ts";

/**
 * A site in progress, remembered across reloads.
 *
 * Not a convenience. Publishing hands off to a wallet app, and on a phone coming back
 * reloads the page — so without this, the round trip to sign a transaction destroys
 * everything someone typed, at the exact moment they were about to pay for it. The
 * avatar uploader on the main site learned this the same way.
 *
 * Keyed per node, so drafts for two names cannot leak into each other, and versioned so
 * a change to SiteData's shape discards old drafts instead of half-restoring them.
 */
const VERSION = 1;
const PREFIX = "hoodfi-sites-draft";

export type Draft = {
  version: number;
  templateId: TemplateId;
  data: SiteData;
  /** Set once a draft has been touched. Drives the "Draft saved" line and autosave. */
  edited: boolean;
  /**
   * The fields the visitor has actually typed in, so the ones they haven't can keep
   * following their records.
   *
   * `edited` used to do this job alone, and it is far too coarse: one character anywhere
   * froze every field, so changing an avatar on /manage never reached a draft that
   * existed — the editor showed the old picture for good and looked like it had lost the
   * update. Absent on drafts written before this existed, and read as "nothing typed":
   * those get re-synced from the chain once, which is the behaviour that was expected all
   * along.
   */
  touched?: (keyof SiteData)[];
  savedAt: number;
};

function key(node: string): string {
  return `${PREFIX}:${node}`;
}

export function loadDraft(node: string): Draft | null {
  if (typeof window === "undefined" || !node) return null;
  try {
    const raw = window.localStorage.getItem(key(node));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft;
    if (parsed.version !== VERSION) return null;
    // Merge onto EMPTY_SITE so a draft written before a field existed still loads.
    return { ...parsed, data: { ...EMPTY_SITE, ...parsed.data } };
  } catch {
    return null;
  }
}

export function saveDraft(node: string, draft: Omit<Draft, "version" | "savedAt">): void {
  if (typeof window === "undefined" || !node) return;
  try {
    window.localStorage.setItem(
      key(node),
      JSON.stringify({ ...draft, version: VERSION, savedAt: Date.now() })
    );
  } catch {
    // Private mode, or a full quota. Losing autosave is survivable; throwing here would
    // take down the editor on every keystroke.
  }
}

export function clearDraft(node: string): void {
  if (typeof window === "undefined" || !node) return;
  try {
    window.localStorage.removeItem(key(node));
  } catch {
    /* see above */
  }
}
