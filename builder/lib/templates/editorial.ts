import { ARCHIVO_400, ARCHIVO_800 } from "./fonts.ts";
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
import type { SiteData, Template } from "./types.ts";

/**
 * Editorial — the house look, one step away from the house.
 *
 * Paper ground, one lime field, Archivo at full height, radius zero, hairlines instead
 * of shadows. Deliberately *not* a copy of hoodfi.name: the hero puts the name across a
 * lime band with the portrait breaking into it, where the site runs a two-column hero
 * with a dark panel. A personal page that mirrors the official one too closely reads as
 * an official page, which is a problem the moment someone puts an address on it.
 */
function renderEditorial(data: SiteData): string {
  const name = esc(data.displayName || data.label);
  const label = esc(data.label);
  const avatar = safeImage(data.avatar);
  const site = safeUrl(data.website);
  const opensea = safeUrl(data.opensea);

  const socials = (
    [
      data.x ? ["X", `https://x.com/${handle(data.x)}`] : null,
      data.github ? ["GitHub", `https://github.com/${handle(data.github)}`] : null,
      data.telegram ? ["Telegram", `https://t.me/${handle(data.telegram)}`] : null,
      data.discord ? ["Discord", `https://discord.gg/${handle(data.discord)}`] : null,
      site ? ["Website", site] : null,
      opensea ? ["OpenSea", opensea] : null,
    ].filter(Boolean) as [string, string][]
  );

  const addresses = (
    [
      data.ethAddress ? ["Ethereum", data.ethAddress.trim()] : null,
      data.btcAddress ? ["Bitcoin", data.btcAddress.trim()] : null,
      data.solAddress ? ["Solana", data.solAddress.trim()] : null,
    ].filter(Boolean) as [string, string][]
  );

  const links = data.links
    .map((l) => ({ label: l.label.trim(), url: safeUrl(l.url) }))
    .filter((l) => l.label && l.url);

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
:root{--paper:#f1f1ea;--paper-alt:#e9eae1;--ink:#0b0e08;--lime:#c6f702;--dim:rgba(11,14,8,.66);--label:rgba(11,14,8,.55);--faint:rgba(11,14,8,.45);--line:rgba(11,14,8,.18)}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{background:var(--paper);color:var(--ink);font-family:'Archivo',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:16.5px;line-height:1.6;overflow-x:hidden}
a{color:inherit}
.shell{max-width:1180px;margin:0 auto;padding:0 clamp(20px,4vw,40px)}
.band{background:var(--lime);border-bottom:1px solid var(--ink)}
.hero{display:grid;gap:clamp(24px,4vw,56px);padding:clamp(40px,6vw,72px) 0 0;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));align-items:end}
.headcol{container-type:inline-size}
.eyebrow{font-size:11.5px;letter-spacing:.2em;text-transform:uppercase;color:rgba(11,14,8,.66)}
h1{font-weight:800;font-size:clamp(44px,15cqi,132px);line-height:.86;letter-spacing:-.035em;text-transform:uppercase;margin-top:18px;overflow-wrap:anywhere}
.tagline{margin-top:22px;font-size:clamp(16px,2vw,21px);font-weight:400;line-height:1.4;max-width:34ch;padding-bottom:clamp(28px,4vw,44px)}
.portrait{width:100%;max-width:360px;aspect-ratio:1;border:1px solid var(--ink);overflow:hidden;justify-self:end;margin-bottom:-1px}
.portrait img{display:block;width:100%;height:100%;object-fit:cover}
section{padding:clamp(48px,7vw,88px) 0 0}
.marker{font-size:11.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--label)}
h2{font-weight:800;font-size:clamp(28px,4vw,52px);line-height:.94;letter-spacing:-.04em;margin-top:16px}
.bio{margin-top:26px;max-width:62ch;color:var(--dim);font-size:17px}
.bio p+p{margin-top:16px}
.rows{margin-top:34px;border-top:1px solid var(--line)}
.row{display:grid;grid-template-columns:minmax(0,140px) minmax(0,1fr);gap:20px;align-items:baseline;padding:18px 0;border-bottom:1px solid var(--line)}
.row .k{font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--label)}
.row .v{min-width:0;word-break:break-word;font-size:16px}
button.v{background:none;border:0;color:inherit;font:inherit;cursor:pointer;text-align:left;padding:0;text-decoration:underline;text-underline-offset:3px}
.cards{display:flex;flex-wrap:wrap;gap:14px;margin-top:34px}
.card{flex:1 1 260px;min-width:0;border:1px solid var(--line);background:var(--paper-alt);padding:22px;text-decoration:none;box-shadow:10px 10px 0 rgba(11,14,8,.08)}
.card .k{font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--label)}
.card .t{margin-top:10px;font-weight:800;font-size:20px;letter-spacing:-.02em}
.card .u{margin-top:6px;font-size:14px;color:var(--faint);word-break:break-all}
footer{margin-top:clamp(56px,8vw,104px);background:var(--ink);color:rgba(241,241,234,.85)}
footer .shell{display:flex;flex-wrap:wrap;gap:14px;justify-content:space-between;padding-top:26px;padding-bottom:34px;font-size:12.5px;letter-spacing:.06em}
@media(max-width:640px){.row{grid-template-columns:1fr;gap:6px}}
</style>
</head>
<body>
<div class="band"><div class="shell">
  <div class="hero">
    <div class="headcol">
      <div class="eyebrow">${label}.hoodfi.eth</div>
      <h1>${name}</h1>
      ${data.tagline ? `<p class="tagline">${esc(data.tagline)}</p>` : '<div class="tagline"></div>'}
    </div>
    ${avatar ? `<div class="portrait"><img src="${attr(avatar)}" alt="${attr(name)}"></div>` : ""}
  </div>
</div></div>

<div class="shell">
  ${
    data.bio
      ? `<section>
    <div class="marker">01 — about</div>
    <div class="bio">${paragraphs(data.bio)}</div>
  </section>`
      : ""
  }

  ${
    links.length
      ? `<section id="links">
    <div class="marker">02 — links</div>
    <h2>Things worth opening.</h2>
    <div class="cards">
      ${links
        .map(
          (l) =>
            `<a class="card" href="${attr(l.url)}" target="_blank" rel="noreferrer"><div class="k">Link</div><div class="t">${esc(l.label)}</div><div class="u">${esc(l.url.replace(/^https?:\/\//, ""))}</div></a>`
        )
        .join("\n      ")}
    </div>
  </section>`
      : ""
  }

  ${
    socials.length
      ? `<section>
    <div class="marker">03 — elsewhere</div>
    <div class="rows">
      ${socials
        .map(
          ([k, u]) =>
            `<div class="row"><div class="k">${esc(k)}</div><a class="v" href="${attr(u)}" target="_blank" rel="noreferrer">${esc(u.replace(/^https?:\/\//, ""))}</a></div>`
        )
        .join("\n      ")}
    </div>
  </section>`
      : ""
  }

  ${
    addresses.length
      ? `<section id="addresses">
    <div class="marker">04 — addresses</div>
    <div class="rows">
      ${addresses
        .map(
          ([k, v]) =>
            `<div class="row"><div class="k">${esc(k)}</div><button class="v" data-copy="${attr(v)}" title="${attr(v)}">${esc(shortAddress(v))}</button></div>`
        )
        .join("\n      ")}
    </div>
  </section>`
      : ""
  }
</div>

<footer><div class="shell">
  <span>${label}.hoodfi.eth</span>
  <span>Built with HoodFi Sites</span>
</div></footer>
<script>${COPY_SCRIPT}
${ANCHOR_SCRIPT}</script>
</body>
</html>`;
}

export const editorial: Template = {
  id: "editorial",
  name: "Editorial",
  blurb: "Paper ground, one lime field, display type at full height.",
  audience: "Personal identity",
  render: renderEditorial,
};
