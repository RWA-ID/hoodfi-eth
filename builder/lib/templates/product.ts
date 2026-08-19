import { MANROPE_400, MANROPE_700, MANROPE_800 } from "./fonts.ts";
import { ICON_CSS, icon, sprite, type IconId } from "./icons.ts";
import { ANCHOR_SCRIPT, COPY_SCRIPT, attr, esc, handle, paragraphs, safeImage, safeUrl, shortAddress } from "./html.ts";
import { BUILDER_URL } from "./html.ts";
import type { SiteData, Template } from "./types.ts";

/**
 * Product — the generative field behind the whole hero, with a glass card floating over
 * it. Built to the Claude Design handoff, template 1d.
 *
 * The only warm one in the set: white ground, Manrope's soft terminals, pill buttons,
 * rounded corners. It exists because the other three are hard-edged, and someone making
 * a page for a small team or a tool is not served by any of them.
 */

/**
 * The hero field: a 44 x 18 lattice at 27px, quarter-disc petals with faint plus marks,
 * ramping left to right from #dbe4fb through blue with lime landing occasionally.
 *
 * The handoff ships this as 792 literal paths and says to export it as an SVG asset. It
 * is REGENERATED here instead, to the same lattice, the same 10.5 radius, the same four
 * rotations and the same palette — because these pages are single self-contained files,
 * so "reference an asset" is not available and inlining the literal version would put
 * 85KB of identical paths into every Product site ever published. Generating costs a few
 * hundred bytes and keeps the one property the static export loses: the seed is the
 * name, so two sites never get the same arrangement and neither ever changes on reload.
 */
function heroField(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rnd = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return Math.abs(h % 1000) / 1000;
  };

  const COLS = 44;
  const ROWS = 18;
  const STEP = 27;
  const R = 10;

  /*
   * Subpaths are ACCUMULATED PER COLOUR rather than emitted per cell.
   *
   * One <path> element per cell is how the handoff's export does it, and at 792 cells
   * that is ~103KB of markup repeating `fill=` and a transform 792 times — on a page
   * that gets pinned to IPFS forever. An SVG `d` holds any number of subpaths, so six
   * fills become six elements, the transform is folded into absolute coordinates, and
   * the same field costs about a quarter as much.
   */
  const byFill = new Map<string, string[]>();
  const plus = new Map<string, string[]>();

  /**
   * The petal, as the four rotations of a quarter disc within its cell.
   *
   * The handoff rotates one path about the cell centre; a 90° rotation maps the cell's
   * box onto itself, so each rotation is just the same arc hung off a different corner
   * — which is expressible in absolute coordinates and needs no transform.
   */
  const petalPath = (x: number, y: number, rot: number): string => {
    if (rot === 90) return `M${x + R} ${y}v${R}a${R} ${R} 0 0 1-${R}-${R}z`;
    if (rot === 180) return `M${x + R} ${y + R}h-${R}a${R} ${R} 0 0 1 ${R}-${R}z`;
    if (rot === 270) return `M${x} ${y + R}v-${R}a${R} ${R} 0 0 1 ${R} ${R}z`;
    return `M${x} ${y}h${R}a${R} ${R} 0 0 1-${R} ${R}z`;
  };

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = x / (COLS - 1);

      /*
       * Every cell carries a mark. An earlier version skipped cells at random, which
       * produced scattered clumps instead of a field: the regularity is what makes the
       * left-to-right ramp read as one gradient rather than as noise that thins out.
       * What varies is the KIND of mark and its colour, never whether there is one.
       */
      const isPetal = t + (rnd() - 0.5) * 0.34 > 0.1;
      const px = x * STEP + 8;
      const py = y * STEP + 8;

      if (!isPetal) {
        // Bucketed to two decimals so cells sharing an opacity share an element.
        const o = (Math.round((0.24 + t * 0.16) * 25) / 25).toFixed(2);
        const cx = x * STEP + 13;
        const cy = y * STEP + 13;
        (plus.get(o) ?? plus.set(o, []).get(o)!).push(`M${cx - 4} ${cy}h8M${cx} ${cy - 4}v8`);
        continue;
      }

      const r = rnd();
      const fill =
        r > 0.94 && t > 0.3
          ? "#c6f702"
          : t > 0.86
            ? "#1d55e8"
            : t > 0.66
              ? "#2f6bff"
              : t > 0.44
                ? "#7d9dff"
                : t > 0.22
                  ? "#b3c6ff"
                  : "#dbe4fb";
      const rot = Math.floor(rnd() * 4) * 90;
      (byFill.get(fill) ?? byFill.set(fill, []).get(fill)!).push(petalPath(px, py, rot));
    }
  }

  const marks = [
    ...[...byFill].map(([fill, ds]) => `<path fill="${fill}" d="${ds.join("")}"/>`),
    ...[...plus].map(
      ([o, ds]) => `<path stroke="#8fa2c9" stroke-width="1.1" opacity="${o}" d="${ds.join("")}"/>`
    ),
  ];

  return `<svg class="field" viewBox="0 0 ${COLS * STEP} ${ROWS * STEP}" preserveAspectRatio="xMidYMid slice" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${marks.join("")}</svg>`;
}

function renderProduct(data: SiteData): string {
  const name = esc(data.displayName || data.label);
  const label = esc(data.label);
  const avatar = safeImage(data.avatar);
  const site = safeUrl(data.website);
  const opensea = safeUrl(data.opensea);

  const rows: { id?: IconId; k: string; v: string; url?: string; copy?: string }[] = [];
  if (data.x) rows.push({ id: "x", k: "X", v: `x.com/${handle(data.x)}`, url: `https://x.com/${handle(data.x)}` });
  if (data.github) rows.push({ id: "gh", k: "GitHub", v: `github.com/${handle(data.github)}`, url: `https://github.com/${handle(data.github)}` });
  if (data.telegram) rows.push({ k: "Telegram", v: `t.me/${handle(data.telegram)}`, url: `https://t.me/${handle(data.telegram)}` });
  if (data.discord) rows.push({ k: "Discord", v: `discord.gg/${handle(data.discord)}`, url: `https://discord.gg/${handle(data.discord)}` });
  if (opensea) rows.push({ id: "os", k: "OpenSea", v: opensea.replace(/^https?:\/\//, ""), url: opensea });
  if (data.ethAddress) rows.push({ id: "eth", k: "Ethereum", v: `${shortAddress(data.ethAddress.trim())} · copy`, copy: data.ethAddress.trim() });
  if (data.btcAddress) rows.push({ id: "btc", k: "Bitcoin", v: `${shortAddress(data.btcAddress.trim())} · copy`, copy: data.btcAddress.trim() });
  if (data.solAddress) rows.push({ id: "sol", k: "Solana", v: `${shortAddress(data.solAddress.trim())} · copy`, copy: data.solAddress.trim() });

  const links = data.links.map((l) => ({ label: l.label.trim(), url: safeUrl(l.url) })).filter((l) => l.label && l.url);
  const primary = links[0];
  const facts = data.facts.filter((f) => f.label.trim() && f.value.trim()).slice(0, 3);
  const usedIcons = [...(rows.map((r) => r.id).filter(Boolean) as IconId[]), "rh" as IconId, ...(opensea ? (["os"] as IconId[]) : [])];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name} · ${label}.hoodfi.eth</title>
<meta name="description" content="${attr(data.tagline || `${data.displayName || data.label} on HoodFi`)}">
<meta property="og:title" content="${attr(name)}">
<meta property="og:description" content="${attr(data.tagline)}">
<meta property="og:type" content="profile">
${avatar ? `<meta property="og:image" content="${attr(avatar)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<style>
@font-face{font-family:'Manrope';src:url(data:font/woff2;base64,${MANROPE_400}) format('woff2');font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:'Manrope';src:url(data:font/woff2;base64,${MANROPE_700}) format('woff2');font-weight:700;font-style:normal;font-display:swap}
@font-face{font-family:'Manrope';src:url(data:font/woff2;base64,${MANROPE_800}) format('woff2');font-weight:800;font-style:normal;font-display:swap}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{background:#fff;color:#0d1117;font-family:'Manrope',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:14.5px;line-height:1.65;overflow-x:hidden}
a{color:inherit;text-decoration:none}
img{display:block;max-width:100%}
${ICON_CSS}
.tpl{max-width:1180px;margin:0 auto}
.nav{border-bottom:1px solid #e4e9f2;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;padding:0 34px;min-height:70px}
.brand{display:flex;align-items:center;gap:11px;font-weight:700;font-size:16.5px;min-width:0}
.brand .d{width:30px;height:30px;border-radius:9px;overflow:hidden;background:#2f6bff;flex:none}
.brand .d img{width:100%;height:100%;object-fit:cover}
.nav .links{display:flex;gap:26px;font-size:14.5px;color:#4a5568}
.nav .links a:hover{color:#2f6bff}
.pill{display:inline-flex;align-items:center;gap:7px;height:44px;padding:0 19px;border-radius:999px;font-weight:700;font-size:14px;background:#2f6bff;color:#fff;white-space:nowrap;transition:box-shadow .15s ease,transform .15s ease}
.pill.g{background:transparent;color:#0d1117;border:1px solid #e4e9f2}
.pill:hover{transform:translateY(-1px);box-shadow:0 10px 20px -12px rgba(13,17,23,.5)}
.hero{position:relative;padding:52px 34px 70px;overflow:hidden;min-height:470px}
/* The field is the whole hero's backdrop, not a decoration in one corner. */
.field{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.pfp{position:relative;width:140px;height:140px;border-radius:34px;overflow:hidden;background:#2f6bff;box-shadow:0 0 0 5px #fff,0 18px 34px -20px rgba(13,17,23,.45);margin-bottom:24px}
.pfp img{width:100%;height:100%;object-fit:cover}
h1{font-size:56px;font-weight:800;line-height:1.05;letter-spacing:-.035em;max-width:14ch;position:relative}
.tag{margin-top:20px;font-size:18.5px;line-height:1.6;color:#4a5568;max-width:38ch;position:relative}
.cta{margin-top:30px;display:flex;flex-wrap:wrap;gap:12px;position:relative}
.card{position:absolute;right:34px;bottom:40px;width:340px;max-width:calc(100% - 68px);background:rgba(255,255,255,.86);backdrop-filter:blur(9px);border:1px solid #e4e9f2;border-radius:18px;padding:22px;box-shadow:0 22px 44px -26px rgba(13,17,23,.4)}
.card .t{font-weight:700;font-size:15.5px}
.card .s{margin-top:7px;font-size:13.5px;color:#4a5568;line-height:1.55}
.chain{margin-top:12px;display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:#2f6bff;background:#eef3ff;border-radius:999px;padding:6px 11px}
.stats{margin-top:20px;display:flex;flex-wrap:wrap;gap:20px 30px}
.stats .n{font-size:26px;font-weight:800;letter-spacing:-.02em}
.stats .l{font-size:12px;color:#8a94a6}
.sec{padding:56px 34px 0;border-top:1px solid #e4e9f2}
.mk{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#8a94a6}
h2{margin-top:11px;font-size:34px;font-weight:800;letter-spacing:-.03em}
.body{margin-top:20px;max-width:62ch;color:#4a5568}
.body p+p{margin-top:14px}
.cards{margin-top:26px;display:grid;grid-template-columns:repeat(3,1fr);gap:15px}
.c{border:1px solid #e4e9f2;border-radius:16px;padding:21px;min-height:116px;display:flex;flex-direction:column;justify-content:space-between;min-width:0;transition:border-color .15s ease,transform .15s ease,box-shadow .15s ease}
/* This template's hover vocabulary: a 1px lift, a stronger shadow, an accent border. */
.c:hover,.c:focus-visible{border-color:#2f6bff;transform:translateY(-1px);box-shadow:0 14px 28px -22px rgba(13,17,23,.5)}
.c .t{font-weight:700;font-size:17px}
.c .u{font-size:13.5px;color:#8a94a6;word-break:break-all}
.rows{margin-top:26px}
.row{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px 20px;padding:15px 0;border-bottom:1px solid #e4e9f2;font-size:14.5px;min-height:44px}
.row .k{font-weight:700}
.row .v{color:#4a5568;min-width:0;word-break:break-all;text-align:right}
button.v{background:none;border:0;font:inherit;cursor:pointer;color:#2f6bff;padding:0}
:focus-visible{outline:2px solid #2f6bff;outline-offset:3px}
footer{margin-top:56px;background:#f6f8fc;border-top:1px solid #e4e9f2;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;padding:26px 34px 34px;font-size:14px;color:#8a94a6}
footer a:hover{color:#2f6bff}
/* One breakpoint, 760px, exactly as the handoff specifies. */
@media(max-width:760px){
  .nav{min-height:0;padding:14px 18px;gap:12px}
  .nav .links{display:none}
  .brand{font-size:15px}
  .pill{height:44px;padding:0 15px;font-size:13px}
  .hero{padding:28px 18px 34px;min-height:0}
  .pfp{width:104px;height:104px;border-radius:26px;margin-bottom:18px}
  h1{font-size:34px;max-width:none}
  .tag{font-size:15.5px;margin-top:14px;max-width:none}
  .cta{margin-top:22px}
  .card{position:relative;right:auto;bottom:auto;width:100%;max-width:none;margin-top:28px;padding:18px;border-radius:14px}
  .stats{gap:22px;margin-top:16px}
  .stats .n{font-size:22px}
  .sec{padding:36px 18px 0}
  h2{font-size:26px}
  .cards{grid-template-columns:1fr;gap:12px;margin-top:20px}
  .c{padding:17px;min-height:0;gap:10px}
  .row{gap:4px 16px;font-size:13.5px}
  .row .v{text-align:left}
  footer{flex-direction:column;gap:6px;margin-top:40px;padding:20px 18px 26px;font-size:12.5px}
}
</style>
</head>
<body>
${sprite(usedIcons)}
<div class="tpl">
<div class="nav">
  <span class="brand">
    <span class="d">${avatar ? `<img src="${attr(avatar)}" alt="">` : ""}</span>${name}
  </span>
  <span class="links">
    ${data.bio ? '<a href="#about">About</a>' : ""}
    ${links.length ? '<a href="#links">Links</a>' : ""}
    ${rows.length ? '<a href="#addresses">Contact</a>' : ""}
  </span>
  <span style="display:flex;gap:10px;flex-wrap:wrap">
    ${opensea ? `<a class="pill g" href="${attr(opensea)}" target="_blank" rel="noreferrer">${icon("os", "width:16px;height:16px")}OpenSea</a>` : ""}
    ${site ? `<a class="pill" href="${attr(site)}" target="_blank" rel="noreferrer">Visit site</a>` : ""}
  </span>
</div>

<div class="hero">
  ${heroField(data.label || "hoodfi")}
  ${avatar ? `<div class="pfp"><img src="${attr(avatar)}" alt="${attr(name)}"></div>` : ""}
  <h1>${name}</h1>
  ${data.tagline ? `<p class="tag">${esc(data.tagline)}</p>` : ""}
  <div class="cta">
    ${primary ? `<a class="pill" href="${attr(primary.url)}" target="_blank" rel="noreferrer">${esc(primary.label)} →</a>` : ""}
    ${links.length ? '<a class="pill g" href="#links">All links</a>' : ""}
  </div>
  <div class="card">
    <div class="t">${label}.hoodfi.eth</div>
    <div class="s">A lifetime name on Robinhood Chain, serving this site straight from IPFS.</div>
    <div class="chain">${icon("rh", "width:15px;height:15px")}Robinhood Chain · 4663</div>
    ${
      facts.length
        ? `<div class="stats">
      ${facts
        .map((f) => `<div><div class="n">${esc(f.value)}</div><div class="l">${esc(f.label)}</div></div>`)
        .join("\n      ")}
    </div>`
        : ""
    }
  </div>
</div>

${
  data.bio
    ? `<section class="sec" id="about">
  <div class="mk">About</div>
  <h2>What this is.</h2>
  <div class="body">${paragraphs(data.bio)}</div>
</section>`
    : ""
}

${
  links.length
    ? `<section class="sec" id="links">
  <div class="mk">Links</div>
  <h2>Everything in one place.</h2>
  <div class="cards">
    ${links
      .map(
        (l) =>
          `<a class="c" href="${attr(l.url)}" target="_blank" rel="noreferrer"><div class="t">${esc(l.label)}</div><div class="u">${esc(l.url.replace(/^https?:\/\//, ""))}</div></a>`
      )
      .join("\n    ")}
  </div>
</section>`
    : ""
}

${
  rows.length
    ? `<section class="sec" id="addresses">
  <div class="mk">Reach and receive</div>
  <div class="rows">
    ${rows
      .map((r) => {
        const key = r.id
          ? `<span class="k kk">${icon(r.id)}${esc(r.k)}</span>`
          : `<span class="k">${esc(r.k)}</span>`;
        const value = r.url
          ? `<a class="v" href="${attr(r.url)}" target="_blank" rel="noreferrer">${esc(r.v)}</a>`
          : `<button class="v" data-copy="${attr(r.copy ?? "")}" title="${attr(r.copy ?? "")}">${esc(r.v)}</button>`;
        return `<div class="row">${key}${value}</div>`;
      })
      .join("\n    ")}
  </div>
</section>`
    : ""
}

<footer><span>${label}.hoodfi.eth</span><a href="${BUILDER_URL}" target="_blank" rel="noreferrer">Built with HoodFi Sites</a></footer>
</div>
<script>${COPY_SCRIPT}
${ANCHOR_SCRIPT}</script>
</body>
</html>`;
}

export const product: Template = {
  id: "product",
  name: "Product",
  blurb: "Light and generous, with a generative field behind the headline.",
  audience: "Teams and tools",
  render: renderProduct,
};
