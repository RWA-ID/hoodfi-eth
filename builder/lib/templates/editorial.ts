import { BRICOLAGE_VAR } from "./fonts.ts";
import { ICON_CSS, keyed, sprite, type IconId } from "./icons.ts";
import {
  ANCHOR_SCRIPT,
  COPY_SCRIPT,
  attr,
  esc,
  handle,
  paragraphs,
  fallbackAttr,
  IMG_FALLBACK_SCRIPT,
  OG_AVATAR,
  PAGE_AVATAR,
  safeImage,
  safeUrl,
} from "./html.ts";
import { BUILDER_URL } from "./html.ts";
import type { SiteData, Template } from "./types.ts";

/**
 * Editorial — a lime masthead band, a portrait breaking the baseline, an ink marquee
 * cutting the fold. Built to the Claude Design handoff, template 1b.
 *
 * The face is **Bricolage Grotesque**, shipped as a VARIABLE font rather than instances.
 * That is the cheaper option here, not the fancier one: this template wants 400/500/600
 * and it wants the headline at optical size 96 against text at ~16, and four static cuts
 * of a face with this many contours come to 74KB against 59KB for one variable file.
 *
 * Optical sizing is left to the browser (`font-optical-sizing` is auto by default), so
 * 16px body text gets opsz 16 and the 104px headline gets opsz 96 without anything being
 * declared. The headline pins it anyway, because that one is a design decision rather
 * than a consequence of its size.
 *
 * The portrait DRIFTS — ±26px over 4.2s, alternating. It is the only motion on the page
 * and it is what stops a paper-coloured layout from reading as a document. The typed-on
 * headline this template used to carry is gone: two animations competing in one band was
 * the reason neither was noticed.
 *
 * Deliberately not a copy of hoodfi.name. A personal page that mirrors the official one
 * too closely reads as official, which matters the moment someone puts an address on it.
 */
function renderEditorial(data: SiteData): string {
  const name = esc(data.displayName || data.label);
  const label = esc(data.label);
  const avatar = safeImage(data.avatar, PAGE_AVATAR);
  // Its own copy, larger: the page slots are 30-140px squares, the card is neither.
  const avatarOg = safeImage(data.avatar, OG_AVATAR);
  // Which gateway can serve it is knowable only on load, not here. See fallbackAttr.
  const avatarAlt = fallbackAttr(data.avatar);
  const site = safeUrl(data.website);
  const opensea = safeUrl(data.opensea);

  const rows: { id?: IconId; k: string; v: string; url?: string; copy?: string }[] = [];
  if (data.x) rows.push({ id: "x", k: "X", v: `x.com/${handle(data.x)}`, url: `https://x.com/${handle(data.x)}` });
  if (data.github)
    rows.push({ id: "gh", k: "GitHub", v: `github.com/${handle(data.github)}`, url: `https://github.com/${handle(data.github)}` });
  if (data.telegram) rows.push({ k: "Telegram", v: `t.me/${handle(data.telegram)}`, url: `https://t.me/${handle(data.telegram)}` });
  if (data.discord) rows.push({ k: "Discord", v: `discord.gg/${handle(data.discord)}`, url: `https://discord.gg/${handle(data.discord)}` });
  if (site) rows.push({ k: "Website", v: site.replace(/^https?:\/\//, ""), url: site });
  if (opensea) rows.push({ id: "os", k: "OpenSea", v: opensea.replace(/^https?:\/\//, ""), url: opensea });
  if (data.ethAddress) rows.push({ id: "eth", k: "Ethereum", v: data.ethAddress.trim(), copy: data.ethAddress.trim() });
  if (data.btcAddress) rows.push({ id: "btc", k: "Bitcoin", v: data.btcAddress.trim(), copy: data.btcAddress.trim() });
  if (data.solAddress) rows.push({ id: "sol", k: "Solana", v: data.solAddress.trim(), copy: data.solAddress.trim() });

  const links = data.links
    .map((l) => ({ label: l.label.trim(), url: safeUrl(l.url) }))
    .filter((l) => l.label && l.url);

  /*
   * Each word on its own line, which is what the handoff draws — its mock hard-codes one
   * <span> per word. Done here rather than with a CSS width so it holds at any length:
   * a max-width in ch would break a long word in half at some sizes and not others.
   */
  const headline = (data.displayName || data.label)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `<span>${esc(word)}</span>`)
    .join("");

  const marquee = [label + ".hoodfi.eth", "served from IPFS", "no renewals", "owned outright"];
  const usedIcons = [...(rows.map((r) => r.id).filter(Boolean) as IconId[]), "rh" as IconId];

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
${avatarOg ? `<meta property="og:image" content="${attr(avatarOg)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<style>
/* One variable file covering 400-600. The weight RANGE in the descriptor is what lets the
   browser use it for all three weights; declare a single value and 600 synthesises. */
@font-face{font-family:'Bricolage Grotesque';src:url(data:font/woff2;base64,${BRICOLAGE_VAR}) format('woff2');font-weight:400 600;font-style:normal;font-display:swap}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{background:#f1f1ea;color:#0b0e08;font-family:'Bricolage Grotesque','Helvetica Neue',system-ui,-apple-system,Arial,sans-serif;font-size:16px;line-height:1.6;overflow-x:hidden}
a{color:inherit;text-decoration:none}
img{display:block;max-width:100%}
${ICON_CSS}
.tpl{max-width:1180px;margin:0 auto}
.band{background:#c6f702;border-bottom:1px solid #0b0e08;padding:22px 34px 0;overflow:hidden}
.top{display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:rgba(11,14,8,.62)}
h1{font-size:104px;font-weight:500;line-height:.9;letter-spacing:-.035em;text-transform:uppercase;margin-top:16px;overflow-wrap:anywhere;font-variation-settings:'opsz' 96}
h1 span{display:block}
.lower{display:flex;align-items:flex-end;justify-content:space-between;gap:32px;margin-top:14px}
.tag{font-size:17px;line-height:1.4;max-width:30ch;padding-bottom:22px;font-weight:500;min-width:0}
/* The mat, the hard offset shadow and the second border on the image itself are all
   specified: it is a photograph pinned to paper, not a cropped div. overflow stays
   visible or the shadow is clipped by the frame that casts it. */
.port{width:180px;height:180px;border:1px solid #0b0e08;background:#f1f1ea;padding:8px;box-shadow:9px 9px 0 rgba(11,14,8,.16);overflow:visible;flex:none;margin-top:-104px;margin-bottom:22px;animation:ed-bounce 4.2s cubic-bezier(.45,0,.55,1) infinite alternate}
.port img{width:100%;height:100%;object-fit:cover;border:1px solid #0b0e08}
@keyframes ed-bounce{from{transform:translateX(-26px)}to{transform:translateX(26px)}}
@keyframes ed-bounce-sm{from{transform:translateX(-10px)}to{transform:translateX(10px)}}
@media(prefers-reduced-motion:reduce){.port{animation:none}}
.marq{background:#0b0e08;color:#f1f1ea;font-size:11px;letter-spacing:.3em;text-transform:uppercase;padding:11px 0;white-space:nowrap;overflow:hidden}
.marq .row{display:inline-block;animation:slide 30s linear infinite}
.marq span{padding-right:40px}
/* Drawn, not typed: U+25A0 is in none of the faces this project ships, so a literal ■
   was always somebody's fallback font sitting in the middle of our own. */
.marq i{display:inline-block;width:.5em;height:.5em;background:currentColor;margin-right:.7em}
/* Eight copies, slid by one. The handoff says duplicate the run and translate -50%, which
   only fills the band while one copy out-measures the viewport — this one is about 850px,
   so on anything wider than a laptop the loop dragged a black gap across the screen. What
   has to hold is that the copies LEFT after one slide are still wider than the band. */
@keyframes slide{from{transform:translateX(0)}to{transform:translateX(-12.5%)}}
@media(prefers-reduced-motion:reduce){.marq .row{animation:none}}
.bodyg{padding:48px 34px 0;display:grid;grid-template-columns:180px 1fr;gap:36px}
.bodyg>*{min-width:0}
.mk{font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:rgba(11,14,8,.5)}
.lead{font-size:23px;line-height:1.35;letter-spacing:-.02em;max-width:30ch;font-weight:500}
.p{margin-top:18px;font-size:16px;line-height:1.7;color:rgba(11,14,8,.68);max-width:58ch}
.p p+p{margin-top:16px}
.links{padding:56px 34px 0;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.link{border:1px solid rgba(11,14,8,.2);background:#e9eae1;padding:22px;box-shadow:9px 9px 0 rgba(11,14,8,.09);min-height:132px;display:flex;flex-direction:column;justify-content:space-between;min-width:0;transition:transform .15s ease,box-shadow .15s ease}
/* This template's hover vocabulary: the card shifts toward its own offset shadow. */
.link:hover,.link:focus-visible{transform:translate(3px,3px);box-shadow:6px 6px 0 rgba(11,14,8,.09)}
.link .t{font-size:20px;font-weight:600;letter-spacing:-.02em}
.link .u{font-size:12.5px;color:rgba(11,14,8,.45);word-break:break-all}
.rows{padding:56px 34px 0}
.row{display:grid;grid-template-columns:150px 1fr auto;gap:20px;align-items:baseline;padding:16px 0;border-bottom:1px solid rgba(11,14,8,.16);min-height:44px}
.row:first-child{border-top:1px solid rgba(11,14,8,.16)}
.row .k{font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:rgba(11,14,8,.5)}
.row .v{font-size:15.5px;min-width:0;word-break:break-all;text-align:left}
.row .c{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(11,14,8,.4)}
.row:hover .c{color:rgba(11,14,8,.8)}
button.v{background:none;border:0;font:inherit;cursor:pointer;padding:0;color:inherit}
:focus-visible{outline:2px solid #0b0e08;outline-offset:3px}
footer{margin-top:64px;background:#0b0e08;color:rgba(241,241,234,.8);display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;padding:26px 34px 34px;font-size:12px}
footer a:hover{color:#c6f702}
/* One breakpoint, 760px, exactly as the handoff specifies. */
@media(max-width:760px){
  .band{padding:18px 18px 0}
  .top{flex-direction:column;gap:6px;font-size:9.5px}
  h1{font-size:48px;margin-top:14px;line-height:.95}
  .lower{flex-direction:column;align-items:flex-start;gap:18px;margin-top:18px}
  .tag{font-size:15px;padding-bottom:0;max-width:none}
  .port{width:132px;height:132px;margin:0 0 20px;padding:6px;box-shadow:6px 6px 0 rgba(11,14,8,.16);animation-name:ed-bounce-sm}
  .marq{font-size:9.5px;letter-spacing:.22em;padding:9px 0}
  .bodyg{padding:32px 18px 0;grid-template-columns:1fr;gap:14px}
  .lead{font-size:19px;max-width:none}
  .p{font-size:14.5px;max-width:none}
  .links{padding:32px 18px 0;grid-template-columns:1fr;gap:12px}
  .link{padding:16px;min-height:96px;box-shadow:6px 6px 0 rgba(11,14,8,.09)}
  .link .t{font-size:17px}
  .rows{padding:32px 18px 0}
  /* The label is promoted to its own line rather than squeezed into a 150px column. */
  .row{grid-template-columns:1fr auto;gap:6px 16px}
  .row .k{grid-column:1/-1}
  footer{padding:22px 18px 26px;flex-direction:column;gap:8px}
}
</style>
</head>
<body>
${sprite(usedIcons)}
<div class="tpl">
<div class="band">
  <div class="top"><span>${label}.hoodfi.eth</span>${keyed("rh", "Robinhood Chain · lifetime")}</div>
  <h1>${headline}</h1>
  <div class="lower">
    ${data.tagline ? `<div class="tag">${esc(data.tagline)}</div>` : "<div class=\"tag\"></div>"}
    ${avatar ? `<div class="port"><img src="${attr(avatar)}"${avatarAlt} alt="${attr(name)}"></div>` : ""}
  </div>
</div>

<div class="marq"><div class="row">${Array.from({ length: 8 }, () => marquee).flat().map((m) => `<span><i></i>${esc(m)}</span>`).join("")}</div></div>

${
  data.bio
    ? `<div class="bodyg">
  <div class="mk">01 — About</div>
  <div>
    <div class="lead">${esc(data.bio.split(/\n\s*\n/)[0].trim())}</div>
    ${
      data.bio.split(/\n\s*\n/).length > 1
        ? `<div class="p">${paragraphs(data.bio.split(/\n\s*\n/).slice(1).join("\n\n"))}</div>`
        : ""
    }
  </div>
</div>`
    : ""
}

${
  links.length
    ? `<div class="links" id="links">
  ${links
    .map(
      (l) =>
        `<a class="link" href="${attr(l.url)}" target="_blank" rel="noreferrer"><div class="t">${esc(l.label)}</div><div class="u">${esc(l.url.replace(/^https?:\/\//, ""))}</div></a>`
    )
    .join("\n  ")}
</div>`
    : ""
}

${
  rows.length
    ? `<div class="rows">
  ${rows
    .map((r) => {
      const key = r.id ? `<div class="k">${keyed(r.id, esc(r.k))}</div>` : `<div class="k">${esc(r.k)}</div>`;
      return r.url
        ? `<a class="row" href="${attr(r.url)}" target="_blank" rel="noreferrer">${key}<div class="v">${esc(r.v)}</div><div class="c">open</div></a>`
        : `<button class="row" data-copy="${attr(r.copy ?? "")}" title="${attr(r.copy ?? "")}" style="width:100%;background:none;border:0;border-bottom:1px solid rgba(11,14,8,.16);font:inherit;text-align:left;cursor:pointer">${key}<div class="v">${esc(r.v)}</div><div class="c">copy</div></button>`;
    })
    .join("\n  ")}
</div>`
    : ""
}

<footer><span>${label}.hoodfi.eth</span><a href="${BUILDER_URL}" target="_blank" rel="noreferrer">Built with HoodFi Sites</a></footer>
</div>
<script>${IMG_FALLBACK_SCRIPT}
${COPY_SCRIPT}
${ANCHOR_SCRIPT}</script>
</body>
</html>`;
}

export const editorial: Template = {
  id: "editorial",
  name: "Editorial",
  blurb: "A lime masthead, a portrait breaking the baseline, an ink marquee.",
  audience: "Writers and artists",
  render: renderEditorial,
};
