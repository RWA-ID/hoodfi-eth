import { SILKSCREEN_400, SILKSCREEN_700 } from "./fonts.ts";
import { ICON_CSS, keyed, sprite, type IconId } from "./icons.ts";
import {
  ANCHOR_SCRIPT,
  COPY_SCRIPT,
  attr,
  esc,
  handle,
  paragraphs,
  safeImage,
  safeUrl,
  shortAddress,
} from "./html.ts";
import { BUILDER_URL } from "./html.ts";
import type { SiteData, Template } from "./types.ts";

/**
 * Terminal — full-bleed acid bar, a running ticker, and the headline as the largest
 * object on the page. Built to the Claude Design handoff, template 1a.
 *
 * The face is **Silkscreen**, a true bitmap-grid design, and that constrains every size
 * on the page. Its outlines sit on coordinates that are all multiples of em/8 — measured,
 * not assumed — so one glyph module is `font-size / 8`, and the type is only crisp when
 * that is a whole device pixel. In practice: **font sizes must be multiples of 8**.
 *
 * The handoff specifies 8, 10, 11, 12, 13, 30 and 72, and its README claims those are
 * "integer multiples of the 8px glyph grid", which 10, 11, 12, 13 and 30 are not. Built
 * to the letter, most of this template's text was antialiased — which reads as "some of
 * the font is not pixelated", and differently again on a phone, because a 2x display
 * rescues the sizes divisible by 4 and nothing else. Sizes here are 8 / 16 / 32 / 72.
 *
 * Two knock-on rules, same cause:
 * - **letter-spacing is 0 or .125em** (one whole module). The handoff's .1em / .06em put
 *   every glyph after the first on a fractional x.
 * - **line-height is 1.25 / 1.5 / 1.75**, all of which give whole pixels at a size that
 *   is a multiple of 8. 1.04 of 72 is 74.88, and a fractional baseline smears vertically.
 *
 * `-webkit-font-smoothing:none` is load-bearing for the same reason — antialiasing a
 * pixel face is the one way to make it look broken.
 *
 * The avatar is a LIME TILE rather than a plain framed square: it turns a profile picture
 * into one of the collection cards from the reference, and it is the only place the
 * accent is used as a ground.
 */
function renderTerminal(data: SiteData): string {
  const name = esc(data.displayName || data.label);
  const label = esc(data.label);
  const avatar = safeImage(data.avatar);
  const site = safeUrl(data.website);
  const opensea = safeUrl(data.opensea);

  /** Cells for the lower grid: an icon key, a value, and the URL if it opens. */
  const cells: { id?: IconId; k: string; v: string; url?: string; copy?: string }[] = [];

  for (const l of data.links) {
    const url = safeUrl(l.url);
    if (l.label.trim() && url) {
      cells.push({ k: l.label.trim().toUpperCase(), v: url.replace(/^https?:\/\//, ""), url });
    }
  }
  if (site) cells.push({ k: "WEBSITE", v: site.replace(/^https?:\/\//, ""), url: site });
  if (data.x) cells.push({ id: "x", k: "X", v: `@${handle(data.x)}`, url: `https://x.com/${handle(data.x)}` });
  if (data.github)
    cells.push({ id: "gh", k: "GITHUB", v: `github.com/${handle(data.github)}`, url: `https://github.com/${handle(data.github)}` });
  if (opensea) cells.push({ id: "os", k: "OPENSEA", v: opensea.replace(/^https?:\/\//, ""), url: opensea });
  if (data.ethAddress) cells.push({ id: "eth", k: "ETH", v: shortAddress(data.ethAddress.trim()), copy: data.ethAddress.trim() });
  if (data.btcAddress) cells.push({ id: "btc", k: "BTC", v: shortAddress(data.btcAddress.trim()), copy: data.btcAddress.trim() });
  if (data.solAddress) cells.push({ id: "sol", k: "SOL", v: shortAddress(data.solAddress.trim()), copy: data.solAddress.trim() });
  cells.push({ id: "rh", k: "CHAIN", v: "ROBINHOOD · 4663" });

  const usedIcons = cells.map((c) => c.id).filter(Boolean) as IconId[];

  /*
   * The handoff's stat block reads MINTED 2026 / EXPIRY ∞ / CHAIN 4663. Those are true of
   * every HoodFi name and therefore say nothing about the person whose site this is —
   * three cells of prime space describing the platform. The block keeps the design's
   * geometry and takes the owner's own figures, which was a deliberate earlier decision
   * and is the one place this template departs from the handoff.
   */
  const facts = data.facts.filter((f) => f.label.trim() && f.value.trim()).slice(0, 3);

  const chips = [
    `<span class="chip on"><i class="sq"></i>${label.toUpperCase()}.HOODFI.ETH</span>`,
    data.x ? `<span class="chip">X / ${esc(handle(data.x).toUpperCase())}</span>` : "",
    data.github ? `<span class="chip">GITHUB</span>` : "",
    opensea ? `<span class="chip">OPENSEA</span>` : "",
  ]
    .filter(Boolean)
    .join("");

  const tickerItems = [
    "LIFETIME NAME",
    "ROBINHOOD CHAIN · 4663",
    "ERC-721",
    "NO RENEWALS",
    "SERVED FROM IPFS",
  ];

  /** The bar's copy chip, which needs an address to be worth showing. */
  const barCopy = data.ethAddress.trim() || data.btcAddress.trim() || data.solAddress.trim();

  /*
   * The headline, one word per line, at a size that makes the longest of them fit.
   *
   * The handoff hard-codes a <br> between its two words, which a field filled by a
   * stranger cannot do, and the `max-width: 11ch` that stood in for it broke a
   * thirteen-character name into "GM.HOODFI.ET" and a lonely "H." on the next line.
   * Wrapping per word fixes multi-word headlines; it cannot help a single long word, so
   * the size comes down instead.
   *
   * Silkscreen is monospaced at 0.75em per character — read off the font's own hmtx, not
   * measured in a canvas, because a canvas that has not been given the face silently
   * measures the fallback and answers 0.625. 704px is the 1fr column at the 1180
   * max-width, beside the 380px portrait and its 44px gap.
   *
   * Snapped DOWN to a multiple of 8, which is the glyph grid: any other size antialiases.
   */
  const words = (data.displayName || data.label).trim().split(/\s+/).filter(Boolean);
  const longest = Math.max(1, ...words.map((w) => w.length));
  const headSize = Math.max(32, Math.min(72, Math.floor(704 / (longest * 0.75) / 8) * 8));
  /* The trailing period lives INSIDE the last word: each word is a block, so an inline
     sibling after them becomes its own anonymous line and the dot lands alone. */
  const headline = words
    .map((w, i) => `<span>${esc(w)}${i === words.length - 1 ? '<b class="dim">.</b>' : ""}</span>`)
    .join("");

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
@font-face{font-family:'Silkscreen';src:url(data:font/woff2;base64,${SILKSCREEN_400}) format('woff2');font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:'Silkscreen';src:url(data:font/woff2;base64,${SILKSCREEN_700}) format('woff2');font-weight:700;font-style:normal;font-display:swap}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
/* Antialiasing is what makes a bitmap face look like a mistake: the 5px caps turn to
   grey smear. All three properties are here because no one of them covers every engine. */
body{background:#0b0e08;color:#c6f702;font-family:'Silkscreen',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;-webkit-font-smoothing:none;font-smooth:never;text-rendering:geometricPrecision;font-size:16px;line-height:1.5;overflow-x:hidden}
a{color:inherit;text-decoration:none}
img{display:block;max-width:100%}
${ICON_CSS}
/* The whole page is the handoff's 1180px column, centred. The bar and ticker sit inside
   it rather than bleeding, which is what the design draws. */
.tpl{max-width:1180px;margin:0 auto}
.bar{background:#c6f702;color:#0b0e08;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:0 26px;min-height:56px;font-size:16px;letter-spacing:.125em;flex-wrap:wrap}
.bar nav{display:flex;gap:22px}
.bar nav a:hover,.bar nav a:focus-visible{text-decoration:underline}
.bar .cta{background:#0b0e08;color:#c6f702;padding:8px 16px;border:0;font:inherit;cursor:pointer;letter-spacing:.125em;min-height:44px}
.tick{border-bottom:1px solid rgba(198,247,2,.25);overflow:hidden;white-space:nowrap;font-size:16px;letter-spacing:0;color:rgba(198,247,2,.6);padding:8px 0}
.tick .row{display:inline-block;animation:slide 34s linear infinite}
.tick span{padding-right:32px}
/* Eight copies, slid by one. The handoff says duplicate the run and translate -50%, and
   that only fills the strip while one copy is wider than the viewport — this one is about
   1820px, so past that width the loop drags a gap of dead bar across the screen. The rule
   is that the copies LEFT after one slide must still out-measure the viewport. */
@keyframes slide{from{transform:translateX(0)}to{transform:translateX(-12.5%)}}
@media(prefers-reduced-motion:reduce){.tick .row{animation:none}}
.wrap{padding:0 26px}
.rule{display:flex;justify-content:space-between;gap:16px;font-size:16px;letter-spacing:0;color:rgba(198,247,2,.6);padding:20px 0 10px;border-bottom:1px solid rgba(198,247,2,.22)}
.hero{display:grid;grid-template-columns:1fr 380px;gap:44px;padding:40px 0 34px;align-items:start}
.hero>*{min-width:0}
/* Size is computed per headline — see the note in the render function. overflow-wrap is
   the last resort for a single word too long even at 40px. */
h1{line-height:1.25;letter-spacing:0;font-weight:400;overflow-wrap:anywhere}
h1 span{display:block}
h1 .dim{color:rgba(198,247,2,.34);font-weight:inherit}
.sub{margin-top:24px;font-size:16px;line-height:1.75;color:rgba(198,247,2,.62);max-width:40ch}
.sub p+p{margin-top:14px}
.chips{margin-top:26px;display:flex;gap:8px;flex-wrap:wrap}
/* The square is drawn, not typed. U+25A0 is in none of the four faces this project
   ships, so every ■ was rendered by whatever fallback the device had — which is exactly
   what "some of the font is not pixelated" looked like against Silkscreen, and it looked
   different again on a phone. A box element cannot fall back. */
.sq{display:inline-block;width:.5em;height:.5em;background:currentColor;vertical-align:baseline;margin-right:.5em}
.chip{border:1px solid rgba(198,247,2,.35);padding:8px 12px;font-size:8px;letter-spacing:.125em}
.chip.on{background:#c6f702;color:#0b0e08;border-color:#c6f702}
.port{border:2px solid #c6f702;background:#c6f702;aspect-ratio:1}
.port img{width:100%;height:100%;object-fit:cover}
.portcap{background:#c6f702;color:#0b0e08;display:flex;justify-content:space-between;gap:10px;font-size:8px;letter-spacing:.125em;padding:8px 10px;border:2px solid #c6f702;border-top:0}
.blk{display:grid;grid-template-columns:repeat(3,1fr);margin-bottom:44px;border:1px solid rgba(198,247,2,.22)}
.blk>div{padding:22px;border-right:1px solid rgba(198,247,2,.22);min-width:0}
.blk>div:last-child{border-right:0}
.blk .n{font-size:32px;line-height:1.25;word-break:break-all}
.blk .l{font-size:8px;letter-spacing:0;color:rgba(198,247,2,.6);margin-top:8px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);border-left:1px solid rgba(198,247,2,.22);border-top:1px solid rgba(198,247,2,.22);margin:8px 0 44px}
.cell{border-right:1px solid rgba(198,247,2,.22);border-bottom:1px solid rgba(198,247,2,.22);padding:18px;min-width:0}
.cell .k{font-size:8px;letter-spacing:0;color:rgba(198,247,2,.6)}
.cell .v{margin-top:8px;font-size:16px;line-height:1.5;word-break:break-all;display:block;min-height:24px}
button.v{background:none;border:0;color:inherit;font:inherit;cursor:pointer;text-align:left;padding:0;width:100%}
/* This template's hover vocabulary is inversion, per the handoff. It is applied to the
   cell rather than the value so the whole cell reads as the target. */
.cell:has(a):hover,.cell:has(button):hover,.cell:focus-within{background:#c6f702;color:#0b0e08}
.cell:has(a):hover .k,.cell:has(button):hover .k,.cell:focus-within .k{color:rgba(11,14,8,.7)}
:focus-visible{outline:2px solid #c6f702;outline-offset:2px}
.bar :focus-visible,.cell :focus-visible{outline-color:#0b0e08}
footer{border-top:1px solid rgba(198,247,2,.22);display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;font-size:16px;letter-spacing:0;color:rgba(198,247,2,.6);padding:20px 0 32px}
footer a:hover{color:#c6f702}
/* One breakpoint, 760px, exactly as the handoff specifies. */
@media(max-width:760px){
  .bar{min-height:0;padding:12px 16px;gap:10px;font-size:8px}
  .bar nav{display:none}
  .tick{padding:8px 0;font-size:8px}
  .wrap{padding:0 16px}
  .rule{font-size:8px;padding:16px 0 8px;gap:12px}
  .hero{grid-template-columns:1fr;gap:26px;padding:26px 0}
  h1{font-size:40px!important;line-height:1.1}
  .sub{font-size:16px;line-height:1.75;margin-top:16px}
  .chips{margin-top:18px;gap:6px}
  .chip{font-size:8px;padding:8px 10px}
  .port{max-width:220px}
  .portcap{max-width:220px;font-size:8px}
  .grid{grid-template-columns:repeat(2,1fr);margin-bottom:32px}
  .cell{padding:14px}
  .blk{grid-template-columns:1fr;margin-bottom:32px}
  .blk>div{border-right:0;border-bottom:1px solid rgba(198,247,2,.22);padding:16px}
  .blk>div:last-child{border-bottom:0}
  .blk .n{font-size:24px;line-height:1.25}
  footer{flex-direction:column;gap:8px;font-size:8px;padding:16px 0 24px}
}
</style>
</head>
<body>
${sprite(usedIcons)}
<div class="tpl">
<div class="bar">
  <span>${label.toUpperCase()}.HOODFI.ETH</span>
  <nav>
    ${cells.some((c) => c.url) ? '<a href="#links">LINKS</a>' : ""}
    ${cells.some((c) => c.copy) ? '<a href="#links">ADDRESSES</a>' : ""}
    ${opensea ? `<a href="${attr(opensea)}" target="_blank" rel="noreferrer">OPENSEA</a>` : ""}
  </nav>
  ${barCopy ? `<button class="cta" data-copy="${attr(barCopy)}" title="${attr(barCopy)}"><i class="sq"></i>COPY ADDRESS</button>` : ""}
</div>

<div class="tick"><div class="row">${Array.from({ length: 8 }, () => tickerItems).flat().map((t) => `<span><i class="sq"></i>${t}</span>`).join("")}</div></div>

<div class="wrap">
  <div class="rule"><span>01 / IDENTITY</span><span>${label.toUpperCase()}.HOODFI.ETH</span></div>

  <div class="hero">
    <div>
      <h1 style="font-size:${headSize}px">${headline}</h1>
      ${data.tagline ? `<div class="sub"><p>${esc(data.tagline)}</p></div>` : ""}
      ${data.bio ? `<div class="sub">${paragraphs(data.bio)}</div>` : ""}
      <div class="chips">${chips}</div>
    </div>
    ${
      avatar
        ? `<div>
      <div class="port"><img src="${attr(avatar)}" alt="${attr(name)}"></div>
      <div class="portcap"><span>HOLDER</span><span>${label.toUpperCase()}</span></div>
    </div>`
        : ""
    }
  </div>

  ${
    facts.length
      ? `<div class="blk">
    ${facts
      .map((f) => `<div><div class="n">${esc(f.value)}</div><div class="l">${esc(f.label)}</div></div>`)
      .join("\n    ")}
  </div>`
      : ""
  }

  <div class="rule" id="links"><span>02 / LINKS + ADDRESSES</span><span>TAP TO COPY</span></div>
  <div class="grid">
    ${cells
      .map((c) => {
        const key = c.id ? keyed(c.id, esc(c.k)) : esc(c.k);
        const value = c.url
          ? `<a class="v" href="${attr(c.url)}" target="_blank" rel="noreferrer">${esc(c.v)}</a>`
          : c.copy
            ? `<button class="v" data-copy="${attr(c.copy)}" title="${attr(c.copy)}">${esc(c.v)}</button>`
            : `<span class="v">${esc(c.v)}</span>`;
        return `<div class="cell"><div class="k">${key}</div>${value}</div>`;
      })
      .join("\n    ")}
  </div>

  <footer><span>${label.toUpperCase()}.HOODFI.ETH</span><a href="${BUILDER_URL}" target="_blank" rel="noreferrer">BUILT WITH HOODFI SITES</a></footer>
</div>
</div>
<script>${COPY_SCRIPT}
${ANCHOR_SCRIPT}</script>
</body>
</html>`;
}

export const terminal: Template = {
  id: "terminal",
  name: "Terminal",
  blurb: "Black ground, acid bar, a running ticker, and your art as a lime tile.",
  audience: "Onchain natives",
  render: renderTerminal,
};
