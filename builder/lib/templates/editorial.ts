import { ARCHIVO_400, ARCHIVO_800 } from "./fonts.ts";
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
} from "./html.ts";
import type { SiteData, Template } from "./types.ts";

/**
 * Editorial — type filling the lime band edge to edge, the portrait cutting up into it.
 *
 * The negative margin on the portrait is the whole design: it lifts the picture into the
 * headline's own space so the two overlap rather than sit in tidy columns. Below the
 * fold an ink marquee cuts the page in half, which is what keeps a paper-coloured
 * layout from reading as a document.
 *
 * Deliberately not a copy of hoodfi.name. A personal page that mirrors the official one
 * too closely reads as official, which matters the moment someone puts an address on it.
 */
function renderEditorial(data: SiteData): string {
  const name = esc(data.displayName || data.label);
  const label = esc(data.label);
  const avatar = safeImage(data.avatar);
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

  /**
   * The headline, typed on.
   *
   * Per-character spans with a staggered delay, and three things the canvas version got
   * wrong:
   *
   * 1. It looped, erasing at 87% of a shared 7s cycle. Because every character carries
   *    the same duration and a different delay, the erase is staggered in the SAME
   *    direction as the type-on — so the FIRST letter vanishes first. Deleting runs
   *    backwards from the end; forwards reads as a rendering fault. Typing once on load
   *    and staying removes the problem rather than reversing it, and a name that
   *    endlessly retypes itself is a novelty that wears out on the second visit.
   * 2. One <b> per character plus `overflow-wrap:anywhere` lets the browser break
   *    between any two letters — GREEN wrapping to GRE / EN. Each WORD is now its own
   *    nowrap span, so lines break between words only.
   * 3. The caret sat on the baseline at 0.72em tall, riding low against the caps.
   *
   * Under prefers-reduced-motion every character is simply visible: the animation is
   * decoration, and the name is the content.
   */
  const STEP = 0.055; // seconds between characters
  const START = 0.25;
  let charIndex = 0;
  const typed = (data.displayName || data.label)
    .trim()
    .split(/\s+/)
    .map((word) => {
      const chars = [...word]
        .map((ch) => {
          const delay = (START + charIndex * STEP).toFixed(3);
          charIndex += 1;
          return `<b style="animation-delay:${delay}s">${esc(ch)}</b>`;
        })
        .join("");
      return `<span class="w">${chars}</span>`;
    })
    .join(" ");
  const caretDelay = (START + charIndex * STEP).toFixed(3);

  const marquee = ["■ " + label + ".hoodfi.eth", "■ served from IPFS", "■ no renewals", "■ owned outright"];
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
${avatar ? `<meta property="og:image" content="${attr(avatar)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<style>
@font-face{font-family:'Archivo';src:url(data:font/woff2;base64,${ARCHIVO_400}) format('woff2');font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:'Archivo';src:url(data:font/woff2;base64,${ARCHIVO_800}) format('woff2');font-weight:800;font-style:normal;font-display:swap}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{background:#f1f1ea;color:#0b0e08;font-family:'Archivo',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:16.5px;line-height:1.6;overflow-x:hidden}
a{color:inherit;text-decoration:none}
${ICON_CSS}
.shell{max-width:1280px;margin:0 auto;padding:0 clamp(20px,4vw,34px)}
.band{background:#c6f702;border-bottom:1px solid #0b0e08;overflow:hidden}
.band .shell{padding-top:30px}
.top{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:rgba(11,14,8,.62)}
h1{font-size:clamp(56px,13vw,158px);font-weight:500;line-height:.86;letter-spacing:-.04em;text-transform:uppercase;margin-top:26px}
/* Each word is its own unbreakable run. Without this, one <b> per character lets a line
   break land between any two letters of a name. */
h1 .w{display:inline-block;white-space:nowrap}
h1 b{font-weight:inherit;opacity:0;animation:ed-in .001s linear forwards}
@keyframes ed-in{to{opacity:1}}
/* Sits against the cap height rather than the baseline, where it read as dropped. */
h1 i{display:inline-block;width:.055em;height:.66em;background:currentColor;margin-left:.06em;vertical-align:-.02em;opacity:0;animation:ed-caret .9s steps(1) infinite}
@keyframes ed-caret{0%,49.9%{opacity:1}50%,100%{opacity:0}}
@media(prefers-reduced-motion:reduce){h1 b{opacity:1;animation:none}h1 i{display:none}}
.lower{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:32px;margin-top:22px}
.tag{font-size:clamp(17px,2.2vw,20px);line-height:1.35;max-width:32ch;padding-bottom:34px;font-weight:500;min-width:0;flex:1 1 280px}
/* Lifts the portrait up into the headline. The overlap IS the layout — without it this
   is two tidy columns and the band stops feeling composed. Clamped so it never eats the
   headline on a narrow screen, where the two stack instead. */
.port{width:min(250px,42vw);aspect-ratio:1;border:1px solid #0b0e08;overflow:hidden;flex:none;margin-bottom:34px}
@media(min-width:900px){.port{margin-top:-152px}}
.port img{width:100%;height:100%;object-fit:cover;display:block}
.marq{background:#0b0e08;color:#f1f1ea;font-size:11px;letter-spacing:.3em;text-transform:uppercase;padding:11px 0;white-space:nowrap;overflow:hidden}
.marq .row{display:inline-block;animation:slide 30s linear infinite}
.marq span{padding-right:40px}
@keyframes slide{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@media(prefers-reduced-motion:reduce){.marq .row{animation:none}}
section{padding-top:clamp(44px,7vw,64px)}
.duo{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:24px 44px}
@media(min-width:820px){.duo{grid-template-columns:200px minmax(0,1fr)}}
.mk{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:rgba(11,14,8,.5)}
.lead{font-size:clamp(21px,2.6vw,26px);line-height:1.35;letter-spacing:-.02em;max-width:30ch;font-weight:500}
.body{margin-top:18px;font-size:16px;line-height:1.7;color:rgba(11,14,8,.68);max-width:58ch}
.body p+p{margin-top:16px}
.links{display:flex;flex-wrap:wrap;gap:16px;margin-top:8px}
.link{flex:1 1 260px;min-width:0;border:1px solid rgba(11,14,8,.2);background:#e9eae1;padding:22px;box-shadow:9px 9px 0 rgba(11,14,8,.09);min-height:132px;display:flex;flex-direction:column;justify-content:space-between}
.link .t{font-size:21px;font-weight:800;letter-spacing:-.02em}
.link .u{font-size:12.5px;color:rgba(11,14,8,.45);word-break:break-all}
.rows{margin-top:8px;border-top:1px solid rgba(11,14,8,.16)}
.row{display:grid;grid-template-columns:minmax(0,150px) minmax(0,1fr) auto;gap:14px 20px;align-items:baseline;padding:16px 0;border-bottom:1px solid rgba(11,14,8,.16)}
@media(max-width:640px){.row{grid-template-columns:1fr auto}}
.row .k{font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:rgba(11,14,8,.5)}
.row .v{font-size:15.5px;min-width:0;word-break:break-all}
.row .c{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(11,14,8,.4)}
button.v{background:none;border:0;color:inherit;font:inherit;cursor:pointer;text-align:left;padding:0}
footer{margin-top:clamp(48px,8vw,64px);background:#0b0e08;color:rgba(241,241,234,.8)}
footer .shell{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;padding-top:26px;padding-bottom:34px;font-size:12px}
</style>
</head>
<body>
${sprite(usedIcons)}
<div class="band"><div class="shell">
  <div class="top"><span>${label}.hoodfi.eth</span>${keyed("rh", "Robinhood Chain · lifetime")}</div>
  <h1>${typed}<i style="animation-delay:${caretDelay}s"></i></h1>
  <div class="lower">
    <div class="tag">${esc(data.tagline)}</div>
    ${avatar ? `<div class="port"><img src="${attr(avatar)}" alt="${attr(name)}"></div>` : ""}
  </div>
</div></div>

<div class="marq"><div class="row">${[...marquee, ...marquee].map((m) => `<span>${esc(m)}</span>`).join("")}</div></div>

<div class="shell">
  ${
    data.bio
      ? `<section><div class="duo">
    <div class="mk">01 — About</div>
    <div><div class="body">${paragraphs(data.bio)}</div></div>
  </div></section>`
      : ""
  }

  ${
    links.length
      ? `<section id="links">
    <div class="mk">02 — Links</div>
    <div class="lead" style="margin-top:12px">Things worth opening.</div>
    <div class="links" style="margin-top:26px">
      ${links
        .map(
          (l) =>
            `<a class="link" href="${attr(l.url)}" target="_blank" rel="noreferrer"><div class="t">${esc(l.label)}</div><div class="u">${esc(l.url.replace(/^https?:\/\//, ""))}</div></a>`
        )
        .join("\n      ")}
    </div>
  </section>`
      : ""
  }

  ${
    rows.length
      ? `<section id="addresses">
    <div class="mk">03 — Elsewhere</div>
    <div class="rows" style="margin-top:26px">
      ${rows
        .map((r) => {
          const key = r.id ? keyed(r.id, esc(r.k)) : esc(r.k);
          const value = r.url
            ? `<a class="v" href="${attr(r.url)}" target="_blank" rel="noreferrer">${esc(r.v)}</a>`
            : `<button class="v" data-copy="${attr(r.copy ?? "")}" title="${attr(r.copy ?? "")}">${esc(r.v)}</button>`;
          return `<div class="row"><div class="k">${key}</div>${value}<div class="c">${r.url ? "open" : "copy"}</div></div>`;
        })
        .join("\n      ")}
    </div>
  </section>`
      : ""
  }
</div>

<footer><div class="shell"><span>${label}.hoodfi.eth</span><span>Built with HoodFi Sites</span></div></footer>
<script>${COPY_SCRIPT}
${ANCHOR_SCRIPT}</script>
</body>
</html>`;
}

export const editorial: Template = {
  id: "editorial",
  name: "Editorial",
  blurb: "Paper and lime, type edge to edge, your picture cutting into the headline.",
  audience: "Personal identity",
  render: renderEditorial,
};
