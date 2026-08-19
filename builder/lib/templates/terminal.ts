import { DEPARTURE_MONO } from "./fonts.ts";
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
 * Terminal — full-bleed acid bar, a running ticker, and the name as the largest object
 * on the page.
 *
 * The move that makes it work is the avatar rendered as a LIME TILE rather than a plain
 * framed square: it turns a profile picture into one of the collection cards from the
 * reference, and it is the only place the accent is used as a ground.
 *
 * One typeface doing every job, 13px caption to 104px headline, which is also why this
 * is the cheapest of the four to embed.
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

  const facts = data.facts.filter((f) => f.label.trim() && f.value.trim()).slice(0, 3);

  const chips = [
    `<span class="tm-chip on">■ ${label}.HOODFI.ETH</span>`,
    data.x ? `<span class="tm-chip">X / ${esc(handle(data.x).toUpperCase())}</span>` : "",
    data.github ? `<span class="tm-chip">GITHUB</span>` : "",
    opensea ? `<span class="tm-chip">OPENSEA</span>` : "",
  ]
    .filter(Boolean)
    .join("");

  const tickerItems = [
    "■ LIFETIME NAME",
    "■ ROBINHOOD CHAIN · 4663",
    "■ ERC-721",
    "■ NO RENEWALS",
    "■ SERVED FROM IPFS",
  ];

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
@font-face{font-family:'DepartureMono';src:url(data:font/woff2;base64,${DEPARTURE_MONO}) format('woff2');font-weight:400;font-style:normal;font-display:swap}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{background:#0b0e08;color:#c6f702;font-family:'DepartureMono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:15px;line-height:1.55;overflow-x:hidden}
a{color:inherit;text-decoration:none}
${ICON_CSS}
.bar{background:#c6f702;color:#0b0e08;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:0 clamp(16px,4vw,26px);min-height:54px;font-size:12px;letter-spacing:.16em;flex-wrap:wrap}
.bar nav{display:flex;gap:22px;flex-wrap:wrap}
.bar nav a:hover{text-decoration:underline}
.tick{border-bottom:1px solid rgba(198,247,2,.25);overflow:hidden;white-space:nowrap;font-size:11px;letter-spacing:.22em;color:rgba(198,247,2,.5);padding:9px 0}
.tick .row{display:inline-block;animation:slide 34s linear infinite}
.tick span{padding-right:34px}
@keyframes slide{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@media(prefers-reduced-motion:reduce){.tick .row{animation:none}}
.wrap{padding:0 clamp(16px,4vw,26px);max-width:1280px;margin:0 auto}
.rule{display:flex;justify-content:space-between;gap:16px;font-size:10.5px;letter-spacing:.2em;color:rgba(198,247,2,.45);padding:20px 0 10px;border-bottom:1px solid rgba(198,247,2,.22)}
.hero{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:44px;padding:40px 0 34px;align-items:start}
.hero>*{min-width:0}
h1{font-size:clamp(46px,8.4vw,104px);line-height:.82;letter-spacing:-.045em;font-weight:400;overflow-wrap:anywhere;min-width:0}
h1 .dim{color:rgba(198,247,2,.34)}
.sub{margin-top:26px;font-size:15px;line-height:1.7;color:rgba(198,247,2,.62);max-width:44ch}
.sub p+p{margin-top:14px}
.chips{margin-top:26px;display:flex;gap:8px;flex-wrap:wrap}
.tm-chip{border:1px solid rgba(198,247,2,.35);padding:7px 12px;font-size:11px;letter-spacing:.14em}
.tm-chip.on{background:#c6f702;color:#0b0e08;border-color:#c6f702}
.port{border:2px solid #c6f702;background:#c6f702;aspect-ratio:1;max-width:380px;width:100%;margin-left:auto}
.port img{width:100%;height:100%;object-fit:cover;display:block}
.portcap{background:#c6f702;color:#0b0e08;display:flex;justify-content:space-between;font-size:11px;letter-spacing:.1em;padding:8px 10px;border:2px solid #c6f702;border-top:0;max-width:380px;width:100%;margin-left:auto}
.blk{display:flex;flex-wrap:wrap;margin-bottom:44px;border:1px solid rgba(198,247,2,.22)}
.blk>div{flex:1 1 200px;min-width:0;padding:22px;border-right:1px solid rgba(198,247,2,.22)}
.blk>div:last-child{border-right:0}
.blk .n{font-size:34px;line-height:1}
.blk .l{font-size:10px;letter-spacing:.2em;color:rgba(198,247,2,.42);margin-top:8px}
.grid{display:flex;flex-wrap:wrap;border-left:1px solid rgba(198,247,2,.22);border-top:1px solid rgba(198,247,2,.22);margin:8px 0 44px}
.cell{flex:1 1 230px;min-width:0;border-right:1px solid rgba(198,247,2,.22);border-bottom:1px solid rgba(198,247,2,.22);padding:18px}
.cell .k{font-size:10px;letter-spacing:.2em;color:rgba(198,247,2,.42)}
.cell .v{margin-top:9px;font-size:14px;word-break:break-all;display:block}
.cell a.v:hover{text-decoration:underline}
button.v{background:none;border:0;color:inherit;font:inherit;cursor:pointer;text-align:left;padding:0}
footer a:hover{text-decoration:underline}
footer{border-top:1px solid rgba(198,247,2,.22);display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;font-size:10.5px;letter-spacing:.16em;color:rgba(198,247,2,.4);padding:20px 0 34px}
</style>
</head>
<body>
${sprite(usedIcons)}
<div class="bar">
  <span>${label}.HOODFI.ETH</span>
  <nav>
    ${cells.some((c) => c.url) ? '<a href="#links">LINKS</a>' : ""}
    ${cells.some((c) => c.copy) ? '<a href="#links">ADDRESSES</a>' : ""}
    ${opensea ? `<a href="${attr(opensea)}" target="_blank" rel="noreferrer">OPENSEA</a>` : ""}
  </nav>
</div>

<div class="tick"><div class="row">${[...tickerItems, ...tickerItems].map((t) => `<span>${t}</span>`).join("")}</div></div>

<div class="wrap">
  <div class="rule"><span>01 / IDENTITY</span><span>${label}.HOODFI.ETH</span></div>

  <div class="hero">
    <div>
      <h1>${name}<span class="dim">.</span></h1>
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

  <footer><span>${label}.HOODFI.ETH</span><a href="${BUILDER_URL}" target="_blank" rel="noreferrer">BUILT WITH HOODFI SITES</a></footer>
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
  audience: "Collectors and PFP holders",
  render: renderTerminal,
};
