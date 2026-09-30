import {
  LINKS_ARCHIVO,
  LINKS_DMSANS,
  LINKS_GROTESK,
  LINKS_INSTRUMENT,
  LINKS_JETBRAINS,
  LINKS_PLEX_MONO,
  LINKS_SYNE,
} from "./links-fonts.ts";
import { sprite, type IconId } from "./icons.ts";
import {
  BUILDER_URL,
  COPY_SCRIPT,
  IMG_FALLBACK_SCRIPT,
  PAGE_AVATAR,
  attr,
  esc,
  fallbackAttr,
  handle,
  safeImage,
  safeUrl,
  shortAddress,
} from "./html.ts";
import {
  DEFAULT_LOOK,
  type LinkBlock,
  type LinksLook,
  type SiteData,
  type Template,
} from "./types.ts";

/**
 * Links — one column of buttons, the page people put in a bio.
 *
 * Built to the Claude Design handoff "Links". Where it differs, it is because the mock
 * drew a placeholder and a published page cannot: thumbnails, images and embeds are real,
 * the embed provider is read off the pasted URL instead of being a second control that
 * can disagree with it, and the tip jar actually sends.
 *
 * Everything the owner picks in Appearance arrives as a small closed set of ids. Each is
 * looked up in a table here and anything unknown falls back to the default, so a draft
 * that has been hand-edited in localStorage can change how a page looks but can never put
 * its own text into the stylesheet.
 */

/* ── Tokens. Exported so the editor draws its swatches and cards from the same values. ── */

export const ACCENTS: Record<
  LinksLook["accent"],
  { name: string; hex: string; on: string; ink: string; dark: string }
> = {
  lime: { name: "Lime", hex: "#c6f702", on: "#0b0e08", ink: "#4a5a18", dark: "#c6f702" },
  orange: { name: "Orange", hex: "#ff6b1a", on: "#0b0e08", ink: "#b8430a", dark: "#ff7d38" },
  blue: { name: "Blue", hex: "#2f6bff", on: "#ffffff", ink: "#2456d6", dark: "#7098ff" },
  purple: { name: "Purple", hex: "#9a6bff", on: "#0b0e08", ink: "#6a3fe0", dark: "#b394ff" },
  bronze: { name: "Bronze", hex: "#c08a54", on: "#0b0e08", ink: "#8a5a2b", dark: "#d9a56f" },
  silver: { name: "Silver", hex: "#c7cad0", on: "#0b0e08", ink: "#565b63", dark: "#d3d6db" },
};

export const MODES = {
  dark: {
    bg: "#0c0d0b",
    surface: "#1a1b18",
    fg: "#f1f1ea",
    dim: "rgba(241,241,234,.7)",
    faint: "rgba(241,241,234,.5)",
    line: "rgba(241,241,234,.16)",
    glass: "rgba(241,241,234,.07)",
    grid: "rgba(241,241,234,.06)",
    field: "rgba(0,0,0,.25)",
  },
  light: {
    bg: "#f3f3ee",
    surface: "#ffffff",
    fg: "#0b0e08",
    dim: "rgba(11,14,8,.68)",
    faint: "rgba(11,14,8,.52)",
    line: "rgba(11,14,8,.14)",
    glass: "rgba(255,255,255,.6)",
    grid: "rgba(11,14,8,.05)",
    field: "rgba(255,255,255,.7)",
  },
} as const;

export const PRESETS: { id: LinksLook["preset"]; name: string }[] = [
  { id: "fill", name: "Solid" },
  { id: "outline", name: "Outline" },
  { id: "glass", name: "Glass" },
  { id: "brutal", name: "Offset" },
  { id: "accent", name: "Accent" },
  { id: "minimal", name: "List" },
];

type Face = { family: string; data: string; weight: string };

/**
 * Six pairings. `display` sets the name; `body` sets everything else. Three of them pair
 * a display face with DM Sans, because Instrument Serif and Syne are headline faces and
 * set badly at 15px on a button.
 */
export const FONTS: {
  id: LinksLook["font"];
  name: string;
  display: Face;
  body: Face;
  weight: number;
  size: number;
  tracking: string;
}[] = [
  { id: "archivo", name: "Archivo", display: face("L Archivo", LINKS_ARCHIVO, "400 800"), body: face("L Archivo", LINKS_ARCHIVO, "400 800"), weight: 800, size: 28, tracking: "-0.035em" },
  { id: "grotesk", name: "Space Grotesk", display: face("L Grotesk", LINKS_GROTESK, "400 700"), body: face("L Grotesk", LINKS_GROTESK, "400 700"), weight: 700, size: 28, tracking: "-0.03em" },
  { id: "dmsans", name: "DM Sans", display: face("L DM Sans", LINKS_DMSANS, "400 700"), body: face("L DM Sans", LINKS_DMSANS, "400 700"), weight: 700, size: 28, tracking: "-0.03em" },
  { id: "serif", name: "Instrument", display: face("L Instrument", LINKS_INSTRUMENT, "400"), body: face("L DM Sans", LINKS_DMSANS, "400 700"), weight: 400, size: 38, tracking: "-0.01em" },
  { id: "mono", name: "JetBrains", display: face("L JetBrains", LINKS_JETBRAINS, "400 700"), body: face("L JetBrains", LINKS_JETBRAINS, "400 700"), weight: 700, size: 24, tracking: "-0.03em" },
  { id: "syne", name: "Syne", display: face("L Syne", LINKS_SYNE, "800"), body: face("L DM Sans", LINKS_DMSANS, "400 700"), weight: 800, size: 28, tracking: "-0.02em" },
];

function face(family: string, data: string, weight: string): Face {
  return { family, data, weight };
}

const MONO = face("L Plex Mono", LINKS_PLEX_MONO, "400");

export function fontFace(f: Face): string {
  return `@font-face{font-family:'${f.family}';src:url(data:font/woff2;base64,${f.data}) format('woff2');font-weight:${f.weight};font-style:normal;font-display:swap}`;
}

/** Every face at once. The editor's font picker uses this; a page never does. */
export function allFontFaces(): string {
  const seen = new Set<string>();
  return [...FONTS.flatMap((f) => [f.display, f.body]), MONO]
    .filter((f) => (seen.has(f.family) ? false : (seen.add(f.family), true)))
    .map(fontFace)
    .join("");
}

const RADIUS = { square: 0, rounded: 14, pill: 999 } as const;

/** Tip amounts are ETH on Robinhood Chain. */
const CHAIN_ID = 4663;
const CHAIN_HEX = "0x1237";
const CHAIN_RPC = "https://rpc.mainnet.chain.robinhood.com";
const CHAIN_EXPLORER = "https://robinhoodchain.blockscout.com";

/**
 * Where the share card is drawn: the gateway's /site-card route, which reads this page
 * back off the name's contenthash and draws it from the `hoodfi:card` meta below. The
 * page only ever links to it, so the card's design can change without a republish.
 */
const CARD_BASE = "https://hoodfi-gateway.dmpay.workers.dev/site-card/";

/** FNV-1a, 32-bit. Not security: it only has to change when the card data does. */
function shortHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export const MAX_BLOCKS = 24;
export const MAX_BIO = 160;

/* ── Resolving a look ─────────────────────────────────────────────────────────────── */

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export type Resolved = ReturnType<typeof resolveLook>;

export function resolveLook(look: Partial<LinksLook> | undefined) {
  const l = look ?? {};
  const preset = pick(l.preset, PRESETS.map((p) => p.id), DEFAULT_LOOK.preset);
  const mode = pick(l.mode, ["dark", "light"] as const, DEFAULT_LOOK.mode);
  const accent = pick(l.accent, Object.keys(ACCENTS) as LinksLook["accent"][], DEFAULT_LOOK.accent);
  const fontId = pick(l.font, FONTS.map((f) => f.id), DEFAULT_LOOK.font);
  const shape = pick(l.shape, ["square", "rounded", "pill"] as const, DEFAULT_LOOK.shape);
  const bg = pick(l.bg, ["solid", "glow", "band", "grid"] as const, DEFAULT_LOOK.bg);
  const badge = typeof l.badge === "boolean" ? l.badge : DEFAULT_LOOK.badge;

  const m = MODES[mode];
  const a = ACCENTS[accent];
  const r = RADIUS[shape];
  return {
    preset,
    mode,
    accent,
    font: fontId,
    shape,
    bg,
    badge,
    m,
    a,
    f: FONTS.find((f) => f.id === fontId)!,
    r,
    /** Cards cap at 20px, or a pill-shaped card is a lozenge. */
    cr: Math.min(r, 20),
    /** The accent as text: the fill colour itself is unreadable on a light ground. */
    acText: mode === "dark" ? a.dark : a.ink,
  };
}

/** The page background for a look. Also drawn behind the editor's theme cards. */
export function background(L: Resolved): string {
  const { m, a } = L;
  switch (L.bg) {
    case "glow":
      return `radial-gradient(110% 50% at 50% -8%, ${hexA(a.hex, L.mode === "dark" ? 0.34 : 0.45)}, transparent 70%), ${m.bg}`;
    case "band":
      return `linear-gradient(${a.hex} 0 118px, ${m.bg} 118px 100%)`;
    case "grid":
      return `linear-gradient(${m.grid} 1px, transparent 1px) 0 0 / 26px 26px, linear-gradient(90deg, ${m.grid} 1px, transparent 1px) 0 0 / 26px 26px, ${m.bg}`;
    default:
      return m.bg;
  }
}

function hexA(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * How a button looks under a preset, as CSS declarations.
 *
 * One function for the page and for the editor's theme cards, so the thumbnail of a
 * preset cannot drift from the preset.
 */
export function buttonDecl(L: Resolved, preset: LinksLook["preset"], featured: boolean): Record<string, string> {
  const { m, a, acText } = L;
  const d: Record<string, string> = {
    background: m.surface,
    color: m.fg,
    border: `1px solid ${m.line}`,
    "border-radius": `${L.r}px`,
    "box-shadow": "none",
  };
  if (preset === "outline") Object.assign(d, { background: "transparent", border: `1.5px solid ${m.fg}` });
  if (preset === "glass") Object.assign(d, { background: m.glass, "backdrop-filter": "blur(14px)", "-webkit-backdrop-filter": "blur(14px)" });
  if (preset === "brutal") Object.assign(d, { border: `2px solid ${m.fg}`, "box-shadow": `4px 4px 0 ${a.hex}` });
  if (preset === "accent") Object.assign(d, { background: a.hex, color: a.on, border: `1px solid ${a.hex}` });
  if (preset === "minimal")
    Object.assign(d, { background: "transparent", border: "none", "border-bottom": `1px solid ${m.line}`, "border-radius": "0" });

  if (featured) {
    if (preset === "accent") Object.assign(d, { background: m.fg, color: m.bg, border: `1px solid ${m.fg}` });
    else if (preset === "minimal") Object.assign(d, { color: acText });
    else if (preset === "brutal") Object.assign(d, { background: a.hex, color: a.on, "box-shadow": `4px 4px 0 ${m.fg}` });
    else Object.assign(d, { background: a.hex, color: a.on, border: `1px solid ${a.hex}` });
  }
  return d;
}

function cardDecl(L: Resolved): Record<string, string> {
  const { m, a } = L;
  const d: Record<string, string> = {
    background: m.surface,
    border: `1px solid ${m.line}`,
    "border-radius": `${L.cr}px`,
    padding: "14px",
  };
  if (L.preset === "outline") Object.assign(d, { background: "transparent", border: `1.5px solid ${m.fg}` });
  if (L.preset === "glass") Object.assign(d, { background: m.glass, "backdrop-filter": "blur(14px)", "-webkit-backdrop-filter": "blur(14px)" });
  if (L.preset === "brutal") Object.assign(d, { border: `2px solid ${m.fg}`, "box-shadow": `4px 4px 0 ${a.hex}` });
  if (L.preset === "minimal")
    Object.assign(d, { background: "transparent", border: "none", "border-top": `1px solid ${m.line}`, "border-radius": "0", padding: "14px 2px" });
  return d;
}

function css(decl: Record<string, string>): string {
  return Object.entries(decl)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

/* ── Reading what was pasted ──────────────────────────────────────────────────────── */

export type Embed = { provider: "YouTube" | "Spotify" | "SoundCloud"; src: string; height?: number };

/**
 * The player for a pasted YouTube, Spotify or SoundCloud link, or null.
 *
 * Every src is rebuilt from an id pulled out of the URL rather than passed through. The
 * owner pastes a page address; what ends up in the iframe is an address we composed, on
 * a host we named, so there is no way to smuggle a different frame onto the page.
 */
export function embedOf(raw: string): Embed | null {
  const url = parse(raw);
  if (!url) return null;
  const host = url.hostname.replace(/^(www|m|music)\./, "");

  if (host === "youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com") {
    const id =
      host === "youtu.be"
        ? url.pathname.slice(1)
        : url.searchParams.get("v") ?? url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] ?? "";
    return /^[A-Za-z0-9_-]{11}$/.test(id)
      ? { provider: "YouTube", src: `https://www.youtube-nocookie.com/embed/${id}` }
      : null;
  }

  if (host === "open.spotify.com") {
    const m = url.pathname.match(/^\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/);
    if (!m) return null;
    // Spotify's own two heights: the compact player for one item, the list for many.
    const compact = m[1] === "track" || m[1] === "episode";
    return { provider: "Spotify", src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, height: compact ? 152 : 352 };
  }

  if (host === "soundcloud.com" && /^\/[^/]+\/.+/.test(url.pathname)) {
    const track = `https://soundcloud.com${url.pathname}`;
    return {
      provider: "SoundCloud",
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(track)}&auto_play=false&hide_related=true&show_comments=false&visual=false`,
      height: 166,
    };
  }
  return null;
}

function parse(raw: string): URL | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

/** A 0x address, checksummed or not. Tips go nowhere else. */
export function isEthAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

/** Up to three positive ETH amounts, as typed. Anything unreadable is dropped, not guessed. */
export function tipAmounts(raw: string): string[] {
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => /^\d{1,6}(\.\d{1,18})?$/.test(v) && Number(v) > 0)
    .slice(0, 3);
}

/** Where a signup form may post. https only — a form posting to http leaks the address. */
export function formEndpoint(raw: string): string {
  const url = safeUrl(raw);
  return url.startsWith("https://") ? url : "";
}

function isEmail(value: string): boolean {
  return /^[^\s@<>"'()]+@[^\s@<>"'()]+\.[a-z]{2,}$/i.test(value.trim());
}

/* ── Socials ──────────────────────────────────────────────────────────────────────── */

export type Social = { id: IconId; label: string; url: string };

export function socials(data: SiteData): Social[] {
  const out: Social[] = [];
  const add = (id: IconId, label: string, url: string) => url && out.push({ id, label, url });
  const h = (raw: string) => handle(raw ?? "");

  if (h(data.x)) add("x", "X", `https://x.com/${h(data.x)}`);
  if (h(data.instagram)) add("ig", "Instagram", `https://instagram.com/${h(data.instagram)}`);
  if (h(data.tiktok)) add("tt", "TikTok", `https://www.tiktok.com/@${h(data.tiktok)}`);
  if (h(data.youtube)) {
    // A pasted /channel/UC… or /c/name keeps its path; a bare handle becomes /@handle.
    const yt = h(data.youtube);
    add("yt", "YouTube", `https://www.youtube.com/${/^(channel|c|user)\//.test(yt) ? yt : `@${yt}`}`);
  }
  if (h(data.farcaster)) add("fc", "Farcaster", `https://farcaster.xyz/${h(data.farcaster)}`);
  if (h(data.github)) add("gh", "GitHub", `https://github.com/${h(data.github)}`);
  if (h(data.telegram)) add("tg", "Telegram", `https://t.me/${h(data.telegram)}`);
  if (h(data.discord)) add("dc", "Discord", `https://discord.gg/${h(data.discord)}`);
  add("web", "Website", safeUrl(data.website ?? ""));
  add("os", "OpenSea", safeUrl(data.opensea ?? ""));
  if (isEmail(data.email ?? "")) add("mail", "Email", `mailto:${data.email.trim()}`);
  return out;
}

/* ── Rendering ────────────────────────────────────────────────────────────────────── */

function renderBlock(b: LinkBlock, data: SiteData, L: Resolved): string {
  const title = (b.title ?? "").trim();

  switch (b.type) {
    case "link": {
      const url = safeUrl(b.url ?? "");
      if (!url) return "";
      const thumb = typeof b.thumb === "string" ? safeImage(b.thumb, THUMB) : "";
      const thumbHtml = thumb
        ? `<img class="th" src="${attr(thumb)}"${fallbackAttr(b.thumb ?? "")} alt="" loading="lazy">`
        : `<span class="th sp"></span>`;
      const label = title || url.replace(/^(https?:\/\/|mailto:)/, "").replace(/\/$/, "");
      return `<a class="btn${b.featured ? " feat" : ""}${thumb ? " has-th" : ""}" href="${attr(url)}" target="_blank" rel="noopener">${thumbHtml}<span class="bt">${esc(label)}</span><span class="ar" aria-hidden="true">↗</span></a>`;
    }

    case "header":
      return title ? `<h2 class="hd">${esc(title)}</h2>` : "";

    case "embed": {
      const e = embedOf(b.url ?? "");
      if (!e) return "";
      const frame = e.height
        ? `<iframe src="${attr(e.src)}" height="${e.height}" title="${attr(title || e.provider)}" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>`
        : `<div class="vid"><iframe src="${attr(e.src)}" title="${attr(title || e.provider)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`;
      return `<div class="card emb">${frame}<div class="cap">${title ? `<span>${esc(title)}</span>` : "<span></span>"}<span class="mf">${e.provider}</span></div></div>`;
    }

    case "image": {
      const src = safeImage(b.url ?? "", IMAGE);
      if (!src) return "";
      return `<figure class="card img"><img src="${attr(src)}"${fallbackAttr(b.url ?? "")} alt="${attr(title)}" loading="lazy">${title ? `<figcaption>${esc(title)}</figcaption>` : ""}</figure>`;
    }

    case "tip": {
      const to = (b.url ?? "").trim() || data.ethAddress.trim();
      const amounts = tipAmounts(b.amounts ?? "");
      if (!isEthAddress(to) || amounts.length === 0) return "";
      return `<div class="card tip" data-tip="${attr(to)}">
  <div class="row"><strong>${esc(title || "Tip jar")}</strong><span class="mf">ETH · Robinhood Chain</span></div>
  <div class="chips" role="group" aria-label="Amount">${amounts
    .map(
      (v, i) =>
        `<button type="button" class="chip" aria-pressed="${i === 0}" data-amt="${attr(v)}">${esc(v)}</button>`
    )
    .join("")}</div>
  <button type="button" class="go" data-send>Send tip</button>
  <div class="row foot"><span class="mf st" aria-live="polite">${esc(shortAddress(to))}</span><button type="button" class="lnk" data-copy="${attr(to)}">Copy</button></div>
</div>`;
    }

    case "email": {
      const action = formEndpoint(b.url ?? "");
      if (!action) return "";
      return `<form class="card mail" method="post" action="${attr(action)}">
  <label for="em-${attr(b.id)}"><strong>${esc(title || "Join the list")}</strong></label>
  <div class="row"><input id="em-${attr(b.id)}" type="email" name="email" required autocomplete="email" placeholder="you@email.com"><button type="submit" class="go">${esc((b.button ?? "").trim() || "Subscribe")}</button></div>
</form>`;
    }
  }
}

/** Link thumbnails are drawn at 42px; 96 keeps them sharp on a 3x phone. */
const THUMB = { px: 96, fit: "cover" } as const;
/** The column is 560px at most. */
const IMAGE = { px: 1120, fit: "scale-down" } as const;

function renderLinks(data: SiteData): string {
  const L = resolveLook(data.look);
  const { m, a, f, preset } = L;

  const label = esc(data.label);
  const nameText = (data.displayName || data.label).trim();
  const name = esc(nameText);
  const bio = (data.bio ?? "").trim();
  const avatar = safeImage(data.avatar ?? "", PAGE_AVATAR);
  const initial = esc(([...nameText][0] ?? "?").toUpperCase());

  const shown = (data.blocks ?? [])
    .slice(0, MAX_BLOCKS)
    .filter((b) => b && b.visible !== false)
    .map((b) => ({ type: b.type, html: renderBlock(b, data, L) }))
    .filter((b) => b.html);
  const blocks = shown.map((b) => b.html);
  // The tip script is the largest one here; a page with no tip jar does not carry it.
  const hasTip = shown.some((b) => b.type === "tip");

  // What the share card draws, carried by the page itself so the gateway reads it from
  // exactly what was published. Raw values, not the resolved/proxied ones: the gateway
  // validates and fetches for itself. Button titles are the first two visible links.
  const card = {
    v: 1,
    title: nameText,
    bio,
    // The raw record (an ipfs:// stays ipfs://, so the gateway can pick its own mirror),
    // but only when the page itself would have drawn it.
    avatar: avatar ? (data.avatar ?? "").trim() : "",
    buttons: (data.blocks ?? [])
      .filter((b) => b && b.visible !== false && b.type === "link" && safeUrl(b.url ?? ""))
      .slice(0, 2)
      .map((b) => ({
        t: (b.title ?? "").trim() || safeUrl(b.url ?? "").replace(/^(https?:\/\/|mailto:)/, ""),
        f: b.type === "link" && b.featured,
      })),
    look: { preset, mode: L.mode, accent: L.accent, font: L.font, shape: L.shape, bg: L.bg },
  };
  const cardJson = JSON.stringify(card);
  const cardUrl = `${CARD_BASE}${encodeURIComponent(data.label)}.png?v=${shortHash(cardJson)}`;

  const social = socials(data);
  const socialHtml = social.length
    ? `<nav class="so" aria-label="Elsewhere">${social
        .map(
          (s) =>
            `<a href="${attr(s.url)}" target="_blank" rel="noopener" aria-label="${attr(s.label)}" title="${attr(s.label)}"><svg aria-hidden="true"><use href="#lg-${s.id}"></use></svg></a>`
        )
        .join("")}</nav>`
    : "";
  const bottom = data.socialPos === "bottom";

  const faces = [...new Set([f.display, f.body, MONO])].map(fontFace).join("");
  const minimal = preset === "minimal";
  const round = L.shape === "pill" ? "50%" : "0";
  const small = Math.min(L.r, 10);
  const mid = Math.min(L.r, 12);
  const onBand = L.bg === "band";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${name} · ${label}.hoodfi.eth</title>
<meta name="description" content="${attr(bio || `${nameText} on HoodFi`)}">
<meta name="theme-color" content="${L.bg === "band" ? a.hex : m.bg}">
<meta property="og:title" content="${attr(nameText)}">
<meta property="og:description" content="${attr(bio)}">
<meta property="og:type" content="profile">
<meta property="og:url" content="https://${attr(data.label)}.hoodfi.eth.link/">
<meta property="og:image" content="${attr(cardUrl)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${attr(`${nameText} — ${data.label}.hoodfi.eth`)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${attr(cardUrl)}">
<meta name="hoodfi:card" content="${attr(cardJson)}">
<style>
${faces}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;background:${m.bg}}
body{min-height:100vh;background:${background(L)};background-repeat:no-repeat;color:${m.fg};font-family:'${f.body.family}',system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased}
${L.bg === "grid" ? "body{background-repeat:repeat}" : ""}
a{color:inherit;text-decoration:none}
button,input{font:inherit;color:inherit}
img{display:block;max-width:100%}
:focus-visible{outline:2px solid ${L.acText};outline-offset:3px}
.mono,.mf,.hd,.hdl,.share,.chip,.badge,.st{font-family:'${MONO.family}',ui-monospace,SFMono-Regular,Menlo,monospace}
.col{max-width:560px;margin:0 auto;padding:34px 18px 28px}
@media(min-width:720px){.col{padding:56px 24px 56px}}
.top{display:flex;justify-content:flex-end;min-height:30px}
.share{cursor:pointer;font-size:11px;letter-spacing:.04em;padding:7px 11px;border-radius:${L.r}px;background:${onBand ? "rgba(11,14,8,.85)" : m.glass};color:${onBand ? "#f1f1ea" : m.fg};border:1px solid ${onBand ? "transparent" : m.line};-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.share:hover{border-color:${onBand ? "#f1f1ea" : m.fg}}
.pro{display:flex;flex-direction:column;align-items:center;text-align:center}
.av{width:96px;height:96px;margin-top:6px;border-radius:${{ square: "0", rounded: "28px", pill: "50%" }[L.shape]};background:${a.hex};color:${a.on};box-shadow:0 0 0 4px ${m.bg};display:flex;align-items:center;justify-content:center;overflow:hidden;flex:none;font-family:'${f.display.family}',sans-serif;font-weight:${f.weight};font-size:42px;line-height:1}
.av img{width:100%;height:100%;object-fit:cover}
h1{margin-top:16px;font-family:'${f.display.family}',sans-serif;font-weight:${f.weight};font-size:${f.size}px;letter-spacing:${f.tracking};line-height:1.05;overflow-wrap:anywhere;text-wrap:balance}
.hdl{margin-top:8px;display:inline-flex;align-items:center;gap:7px;font-size:12px;color:${L.acText};overflow-wrap:anywhere}
.hdl i,.badge i{width:6px;height:6px;background:${a.hex};border-radius:${round};flex:none}
.bio{margin-top:12px;font-size:14.5px;line-height:1.5;color:${m.dim};max-width:34ch;text-wrap:pretty;overflow-wrap:anywhere}
.so{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:${bottom ? "30px" : "18px"}}
.so a{width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:${L.shape === "square" ? "0" : "50%"};border:1px solid ${preset === "accent" ? a.hex : m.line};background:${preset === "accent" ? a.hex : "transparent"};color:${preset === "accent" ? a.on : m.fg};transition:border-color .15s ease,transform .15s ease}
.so a:hover{border-color:${m.fg};transform:translateY(-1px)}
.so svg{width:16px;height:16px;fill:currentColor}
.list{margin-top:26px;display:flex;flex-direction:column;gap:12px}
.btn{display:flex;align-items:center;gap:12px;min-height:58px;padding:${minimal ? "8px 2px" : "8px"};font-size:15px;font-weight:600;line-height:1.25;transition:transform .15s ease,box-shadow .15s ease;${css(buttonDecl(L, preset, false))}}
.btn.feat{${css(buttonDecl(L, preset, true))}}
.btn:hover{transform:translateY(-1px)}
${preset === "brutal" ? `.btn:hover{transform:translate(2px,2px);box-shadow:2px 2px 0 ${a.hex}}.btn.feat:hover{box-shadow:2px 2px 0 ${m.fg}}.btn:active{transform:translate(4px,4px);box-shadow:none}` : ""}
.th{width:${minimal ? 36 : 42}px;height:${minimal ? 36 : 42}px;flex:none;border-radius:${L.shape === "pill" ? "50%" : `${small}px`};object-fit:cover}
.th.sp{${minimal ? "display:none" : ""}}
.bt{flex:1;min-width:0;text-align:${minimal ? "left" : "center"};overflow-wrap:anywhere}
.ar{width:${minimal ? 36 : 42}px;flex:none;text-align:center;opacity:.55;font-size:14px}
.hd{margin-top:10px;font-size:11px;font-weight:400;letter-spacing:.2em;text-transform:uppercase;color:${m.faint};text-align:${minimal ? "left" : "center"}}
.card{${css(cardDecl(L))};color:${m.fg}}
.row{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.mf{font-size:11px;color:${m.faint}}
.emb iframe{display:block;width:100%;border:0;border-radius:${Math.max(L.cr - 6, 0)}px;background:${m.line}}
.vid{position:relative;aspect-ratio:16/9;border-radius:${Math.max(L.cr - 6, 0)}px;overflow:hidden;background:${m.line}}
.vid iframe{position:absolute;inset:0;height:100%}
.cap{margin-top:10px;display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:14px;font-weight:600}
.img img{width:100%;height:auto;max-height:520px;object-fit:cover;border-radius:${Math.max(L.cr - 6, 0)}px}
.img figcaption{margin-top:10px;font-size:14px;font-weight:600}
.tip strong,.mail strong{font-size:15px;font-weight:700}
.chips{margin-top:12px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.chip{cursor:pointer;text-align:center;padding:9px 4px;border-radius:${small}px;font-size:13px;background:transparent;border:1px solid ${m.line};color:${m.fg}}
.chip[aria-pressed=true]{border-color:${L.acText};color:${L.acText}}
.go{cursor:pointer;border:0;border-radius:${mid}px;background:${a.hex};color:${a.on};font-weight:700;font-size:14px;padding:12px 16px}
.go:hover{filter:brightness(1.08)}
.go:disabled{opacity:.6;cursor:progress}
.tip .go{margin-top:10px;width:100%}
.tip .foot{margin-top:10px;align-items:center}
.lnk{cursor:pointer;background:none;border:0;padding:0;font-family:'${MONO.family}',monospace;font-size:11px;color:${L.acText};text-decoration:underline;text-underline-offset:3px}
.st a{color:${L.acText};text-decoration:underline;text-underline-offset:3px}
.mail .row{margin-top:12px;align-items:stretch;gap:6px}
.mail input{flex:1;min-width:0;padding:11px 12px;border-radius:${mid}px;border:1px solid ${m.line};background:${m.field};font-family:'${MONO.family}',monospace;font-size:14px}
.mail input::placeholder{color:${m.faint}}
.mail .go{flex:none}
.badge{margin-top:36px;display:flex;align-items:center;justify-content:center;gap:7px;font-size:11px;color:${m.faint}}
.badge a:hover{color:${m.fg}}
@media(prefers-reduced-motion:reduce){.btn,.so a{transition:none}.btn:hover,.so a:hover{transform:none}}
</style>
</head>
<body>
${sprite(social.map((s) => s.id))}
<main class="col">
<div class="top"><button type="button" class="share" data-share>Share ↗</button></div>
<header class="pro">
  <div class="av">${avatar ? `<img src="${attr(avatar)}"${fallbackAttr(data.avatar ?? "")} alt="${attr(nameText)}">` : initial}</div>
  <h1>${name}</h1>
  <div class="hdl"><i></i><span>${label}.hoodfi.eth</span></div>
  ${bio ? `<p class="bio">${esc(bio).replace(/\n/g, "<br>")}</p>` : ""}
  ${bottom ? "" : socialHtml}
</header>
${blocks.length ? `<div class="list">\n${blocks.join("\n")}\n</div>` : ""}
${bottom ? socialHtml : ""}
${L.badge ? `<footer class="badge"><i></i><a href="${BUILDER_URL}" target="_blank" rel="noopener">made on HoodFi Sites</a></footer>` : ""}
</main>
<script>${IMG_FALLBACK_SCRIPT}
${COPY_SCRIPT}
${SHARE_SCRIPT}
${hasTip ? TIP_SCRIPT : ""}</script>
</body>
</html>`;
}

/**
 * Share: the native sheet where there is one, the clipboard where there isn't.
 * A share the visitor cancels rejects too, and that is not an error worth showing.
 */
const SHARE_SCRIPT = `
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-share]');
  if(!b)return;
  var u=location.href,t=document.title;
  if(navigator.share){navigator.share({title:t,url:u}).catch(function(){});return;}
  if(!navigator.clipboard)return;
  navigator.clipboard.writeText(u).then(function(){
    var o=b.textContent;b.textContent='Link copied';
    setTimeout(function(){b.textContent=o;},1400);
  }).catch(function(){});
});`.trim();

/**
 * The tip jar.
 *
 * With a wallet in the page (a desktop extension, or a mobile wallet's own browser): ask
 * for an account, move it to Robinhood Chain — adding the chain if the wallet has never
 * seen it — and send. Without one, hand the payment to whatever wallet app claims
 * `ethereum:` links (EIP-681), and say plainly that copying the address is the fallback,
 * since a page cannot tell whether that link opened anything.
 *
 * The amount is converted to wei with BigInt from the typed decimal. Floats would send
 * 0.30000000000000004-style values to someone's address.
 */
const TIP_SCRIPT = `
(function(){
var CHAIN='${CHAIN_HEX}';
function wei(v){var p=v.split('.'),f=(p[1]||'').padEnd(18,'0').slice(0,18);return BigInt(p[0])*1000000000000000000n+BigInt(f||'0');}
function say(card,html){var s=card.querySelector('.st');if(s)s.innerHTML=html;}
document.addEventListener('click',function(e){
  var c=e.target.closest('.chip');
  if(c){var g=c.parentNode.querySelectorAll('.chip');for(var i=0;i<g.length;i++)g[i].setAttribute('aria-pressed',g[i]===c?'true':'false');return;}
  var b=e.target.closest('[data-send]');
  if(!b)return;
  var card=b.closest('[data-tip]'),to=card.getAttribute('data-tip');
  var sel=card.querySelector('.chip[aria-pressed=true]'),amt=sel&&sel.getAttribute('data-amt');
  if(!amt)return;
  var value=wei(amt);
  var eth=window.ethereum;
  if(!eth){
    location.href='ethereum:'+to+'@${CHAIN_ID}?value='+value.toString();
    say(card,'No wallet in this browser. If none opened, copy the address.');
    return;
  }
  b.disabled=true;say(card,'Confirm in your wallet…');
  eth.request({method:'eth_requestAccounts'}).then(function(acc){
    return eth.request({method:'wallet_switchEthereumChain',params:[{chainId:CHAIN}]}).catch(function(err){
      if(err&&(err.code===4902||(err.data&&err.data.originalError&&err.data.originalError.code===4902)))
        return eth.request({method:'wallet_addEthereumChain',params:[{chainId:CHAIN,chainName:'Robinhood Chain',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:['${CHAIN_RPC}'],blockExplorerUrls:['${CHAIN_EXPLORER}']}]});
      throw err;
    }).then(function(){
      return eth.request({method:'eth_sendTransaction',params:[{from:acc[0],to:to,value:'0x'+value.toString(16)}]});
    });
  }).then(function(hash){
    say(card,'Sent — thank you. <a href="${CHAIN_EXPLORER}/tx/'+String(hash).replace(/[^0-9a-fx]/gi,'')+'" target="_blank" rel="noopener">View</a>');
  }).catch(function(err){
    say(card,err&&err.code===4001?'Cancelled.':'Could not send. Copy the address instead.');
  }).then(function(){b.disabled=false;});
});
})();`.trim();

export const links: Template = {
  id: "links",
  name: "Links",
  blurb: "One column of buttons, socials, embeds and a tip jar. Six themes, six accents.",
  audience: "Creators",
  isNew: true,
  render: renderLinks,
};
