/**
 * The three AI apps the PayBox connector is demonstrated in, shared by the home
 * teaser band and the `/mcp` section so the two can never fall out of step.
 *
 * The product truth this data encodes, because the copy around it depends on it: a
 * user pastes the **PayBox** connector into their AI app, and PayBox then calls the
 * HoodFi Names MCP on their behalf. There is no "HoodFi connector" to install, and
 * neither PayBox nor this site ever holds a key.
 *
 * Gemini assets exist in the design handoff and are deliberately not here — no demo
 * recording was made, and a "connector ready" row we cannot show is a claim.
 *
 * Marks and lockups are raster, keyed to alpha from each vendor's brand art so the
 * glyph antialiasing survives on both paper and lime. Never recolour one: the Claude
 * mark is its own orange, ChatGPT and Grok are black. If official vector art becomes
 * available, prefer it and follow each vendor's clear-space rules.
 */

export const PAYBOX_URL = "https://paybox.sh";

/**
 * The live store listings. Both badges are Apple's and Google's own generic art,
 * shared with the Robinhood lockup from `/store/` — the image is identical for every
 * app, so there is one copy rather than one per vendor folder.
 */
export const PAYBOX_STORES = [
  {
    href: "https://apps.apple.com/us/app/paybox-by-moonpay/id6776329908",
    src: "/store/appstore-badge.png",
    alt: "Download PayBox by MoonPay on the App Store",
  },
  {
    href: "https://play.google.com/store/apps/details?id=com.moonpay.paybox",
    src: "/store/googleplay-badge.png",
    alt: "Get PayBox by MoonPay on Google Play",
  },
];

export interface PayboxApp {
  id: string;
  label: string;
  /** The glyph alone, for the flip headline. Sized in `em` against the heading. */
  mark: { src: string; width: number; height: number };
  /** The full wordmark, for the connector rows and demo card headers. */
  lockup: { src: string; width: number; height: number };
  video: string;
  poster: string;
  /** What the recording actually shows, step by step. */
  step: string;
}

export const PAYBOX_APPS: PayboxApp[] = [
  {
    id: "claude",
    label: "Claude",
    mark: { src: "/paybox/claude-mark.png", width: 160, height: 160 },
    lockup: { src: "/paybox/claude-lockup.png", width: 444, height: 96 },
    video: "/paybox/claude-connect.mp4",
    poster: "/paybox/claude-connect.jpg",
    step: "Settings → Connectors → Add custom connector, then paste the PayBox connector URL.",
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    mark: { src: "/paybox/chatgpt-mark.png", width: 157, height: 160 },
    lockup: { src: "/paybox/chatgpt-lockup.png", width: 444, height: 105 },
    video: "/paybox/chatgpt-connect.mp4",
    poster: "/paybox/chatgpt-connect.jpg",
    /*
     * Deliberately not the handoff's "Settings → Connectors → Advanced, then add the
     * PayBox connector as an MCP server". The recording shows the developer-mode
     * toggle being turned on first, under Advanced security — without it the Plugins
     * screen the rest of the clip uses cannot be reached, so the original caption
     * described a route the video does not take. A caption that disagrees with its
     * own video is worse than a long one.
     */
    step: "Settings → Advanced security → turn on Developer mode, then add the PayBox connector as an MCP server.",
  },
  {
    id: "grok",
    label: "Grok",
    mark: { src: "/paybox/grok-mark.png", width: 160, height: 153 },
    lockup: { src: "/paybox/grok-lockup.png", width: 444, height: 162 },
    video: "/paybox/grok-connect.mp4",
    poster: "/paybox/grok-connect.jpg",
    step: "Settings → Connectors → paste the PayBox connector URL and authorise it.",
  },
];
