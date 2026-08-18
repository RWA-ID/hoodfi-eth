/**
 * The brand marks, as one inline SVG sprite.
 *
 * `<symbol>` + `<use>` rather than repeating each path: a page showing X, GitHub,
 * OpenSea, ETH, BTC, SOL and the chain mark inline would carry the same path data four
 * or five times over, and these sit in a file whose whole premise is that it is small
 * and self-contained.
 *
 * Drawn rather than typed, for the same reason ArrowNE is: an emoji-class codepoint
 * renders as colour art on iOS and monochrome elsewhere, which is not a choice a
 * template should be making per-visitor.
 *
 * Only the symbols a page actually uses are emitted — `sprite()` takes the ids in play.
 */

export type IconId = "x" | "gh" | "os" | "eth" | "btc" | "sol" | "rh";

const PATHS: Record<IconId, { viewBox: string; body: string }> = {
  x: {
    viewBox: "0 0 24 24",
    body: '<path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>',
  },
  gh: {
    viewBox: "0 0 16 16",
    body: '<path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A7.995 7.995 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>',
  },
  os: {
    viewBox: "0 0 24 24",
    body: '<path fill="none" stroke="currentColor" stroke-width="1.7" d="M12 2.6A9.4 9.4 0 1 1 2.6 12A9.4 9.4 0 0 1 12 2.6Z"/><path fill="currentColor" d="M11.7 6.1v6.6H6.3c.3-2.7 2.1-5.1 5.4-6.6Z"/><rect x="6.2" y="14.6" width="11.6" height="2.2" rx="1.1" fill="currentColor"/>',
  },
  eth: {
    viewBox: "0 0 24 24",
    body: '<path fill="currentColor" d="M12 1.6 5.4 12.2 12 16.1l6.6-3.9L12 1.6Zm0 15.9-6.6-3.9L12 22.4l6.6-8.8-6.6 3.9Z"/>',
  },
  btc: {
    viewBox: "0 0 24 24",
    body: '<path fill="currentColor" d="M12 1.6A10.4 10.4 0 1 0 22.4 12A10.41 10.41 0 0 0 12 1.6Zm0 1.7a8.7 8.7 0 1 1 0 17.4a8.7 8.7 0 0 1 0-17.4Z"/><path fill="currentColor" d="M14.7 10.6c.6-.4.9-1.1.9-1.9c0-1.3-.9-2.1-2.4-2.3V5h-1.4v1.3h-1V5H9.4v1.3H7.7v1.5h1.1v8.4H7.7v1.5h1.7V19h1.4v-1.3h1V19h1.4v-1.4c1.8-.2 2.8-1.1 2.8-2.7c0-1.2-.6-2-1.7-2.3c.6-.3 1-.7 1.1-1.4Zm-4.3-2.8h2c.9 0 1.4.4 1.4 1.1c0 .8-.5 1.2-1.5 1.2h-1.9V7.8Zm2.2 8.4h-2.2v-2.6h2.1c1.1 0 1.7.5 1.7 1.3c0 .8-.6 1.3-1.6 1.3Z"/>',
  },
  sol: {
    viewBox: "0 0 24 24",
    body: '<path fill="currentColor" d="M6.6 5.6a.9.9 0 0 1 .6-.3h14c.4 0 .6.5.3.8l-2.5 2.5a.9.9 0 0 1-.6.3H4.4c-.4 0-.6-.5-.3-.8l2.5-2.5Zm0 9.8a.9.9 0 0 1 .6-.3h14c.4 0 .6.5.3.8l-2.5 2.5a.9.9 0 0 1-.6.3H4.4c-.4 0-.6-.5-.3-.8l2.5-2.5Zm11.2-4.9a.9.9 0 0 0-.6-.3H3.1c-.4 0-.6.5-.3.8l2.5 2.5a.9.9 0 0 0 .6.3h14.2c.4 0 .6-.5.3-.8l-2.6-2.5Z"/>',
  },
  rh: {
    viewBox: "0 0 24 24",
    body: '<path fill="currentColor" d="M18.9 3.1c-4.6.2-8.2 1.9-10.3 4.9c-1.6 2.3-2.2 5.1-1.9 8.2L4.4 18.6a.8.8 0 0 0 1.1 1.1l2.3-2.3c3.2.4 6-.3 8.3-2c3-2.2 4.6-5.9 4.8-10.6a1.6 1.6 0 0 0-2-1.7Zm-1.3 2.2c-.3 3.7-1.6 6.5-3.9 8.2c-1.6 1.2-3.5 1.8-5.7 1.6l8.3-8.3a.8.8 0 0 0-1.1-1.1L6.9 14c-.1-2.1.4-3.9 1.5-5.4c1.7-2.4 4.7-3.8 8.6-4c.4 0 .7.3.6.7Z"/>',
  },
};

/** The hidden `<defs>` block. Emit once, near the top of `<body>`. */
export function sprite(ids: IconId[]): string {
  const used = [...new Set(ids)];
  if (used.length === 0) return "";
  const symbols = used
    .map((id) => `<symbol id="lg-${id}" viewBox="${PATHS[id].viewBox}">${PATHS[id].body}</symbol>`)
    .join("");
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${symbols}</defs></svg>`;
}

/** One icon reference. Sized in `em` by the CSS so it tracks the label beside it. */
export function icon(id: IconId, style = ""): string {
  return `<svg class="ic"${style ? ` style="${style}"` : ""} aria-hidden="true"><use href="#lg-${id}"></use></svg>`;
}

/** An icon and its label as one inline unit, so they never wrap apart. */
export function keyed(id: IconId, label: string): string {
  return `<span class="kk">${icon(id)}${label}</span>`;
}

/** Shared icon CSS. Appended to every template's style block. */
export const ICON_CSS =
  ".ic{width:1em;height:1em;fill:currentColor;flex:none;display:block}" +
  ".kk{display:inline-flex;align-items:center;gap:7px}" +
  ".kk .ic{width:1.15em;height:1.15em;opacity:.85}";
