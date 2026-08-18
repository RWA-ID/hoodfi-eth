import { DEPARTURE_MONO } from "./fonts.ts";
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
 * Terminal — black ground, acid nav, everything in a bitmap mono.
 *
 * The one template where the typeface *is* the design, so Departure Mono carries the
 * 96px headline and the 13px caption alike and there is no second family. That is also
 * why it is the cheapest of the four to embed: one face, 4,976 bytes.
 *
 * Rules it keeps: rules instead of shadows, square corners everywhere, `01 /` section
 * markers, and no colour beyond ink and acid. Anything softer stops reading as a
 * terminal and starts reading as a template with a mono font.
 */
function renderTerminal(data: SiteData): string {
  const name = esc(data.displayName || data.label);
  const label = esc(data.label);
  const avatar = safeImage(data.avatar);
  const site = safeUrl(data.website);
  const opensea = safeUrl(data.opensea);

  const socials: [string, string][] = [
    data.x ? ["X", `https://x.com/${handle(data.x)}`] : ["", ""],
    data.github ? ["GITHUB", `https://github.com/${handle(data.github)}`] : ["", ""],
    data.telegram ? ["TELEGRAM", `https://t.me/${handle(data.telegram)}`] : ["", ""],
    data.discord ? ["DISCORD", `https://discord.gg/${handle(data.discord)}`] : ["", ""],
    site ? ["WEBSITE", site] : ["", ""],
    opensea ? ["OPENSEA", opensea] : ["", ""],
  ].filter(([l, u]) => l && u) as [string, string][];

  const addresses: [string, string][] = [
    data.ethAddress ? ["ETH", data.ethAddress.trim()] : ["", ""],
    data.btcAddress ? ["BTC", data.btcAddress.trim()] : ["", ""],
    data.solAddress ? ["SOL", data.solAddress.trim()] : ["", ""],
  ].filter(([l, v]) => l && v) as [string, string][];

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
@font-face{font-family:'DepartureMono';src:url(data:font/woff2;base64,${DEPARTURE_MONO}) format('woff2');font-weight:400;font-style:normal;font-display:swap}
:root{--ink:#0b0e08;--acid:#c6f702;--dim:rgba(198,247,2,.62);--faint:rgba(198,247,2,.38);--line:rgba(198,247,2,.24)}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{background:var(--ink);color:var(--acid);font-family:'DepartureMono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:15px;line-height:1.55;overflow-x:hidden}
a{color:inherit;text-decoration:none}
.shell{max-width:1200px;margin:0 auto;padding:0 clamp(16px,4vw,36px)}
.bar{background:var(--acid);color:var(--ink);border-bottom:2px solid var(--ink)}
.bar .shell{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:56px;flex-wrap:wrap}
.brand{font-size:15px;letter-spacing:.14em;text-transform:uppercase}
.bar nav{display:flex;gap:18px;flex-wrap:wrap}
.bar nav a{font-size:12px;letter-spacing:.12em;text-transform:uppercase}
.bar nav a:hover{text-decoration:underline}
.rule{display:flex;align-items:baseline;justify-content:space-between;gap:16px;padding:22px 0 10px;border-bottom:1px solid var(--line);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--faint)}
.hero{display:grid;gap:36px;padding:48px 0 64px;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));align-items:start}
h1{font-size:clamp(38px,7.4vw,86px);line-height:.98;letter-spacing:-.02em;font-weight:400;text-transform:none}
.tagline{margin-top:20px;font-size:clamp(15px,1.7vw,18px);color:var(--dim);max-width:38ch}
.bio{margin-top:26px;max-width:52ch;color:var(--dim)}
.bio p+p{margin-top:14px}
.portrait{border:2px solid var(--acid);background:var(--acid);aspect-ratio:1;overflow:hidden;max-width:340px;width:100%}
.portrait img{display:block;width:100%;height:100%;object-fit:cover;image-rendering:auto}
.grid{display:flex;flex-wrap:wrap;border-left:1px solid var(--line);border-top:1px solid var(--line)}
.cell{flex:1 1 260px;min-width:0;border-right:1px solid var(--line);border-bottom:1px solid var(--line);padding:20px}
.cell .k{font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--faint)}
.cell .v{margin-top:10px;font-size:15px;word-break:break-all}
.cell a.v:hover{text-decoration:underline}
button.v{background:none;border:0;color:inherit;font:inherit;cursor:pointer;text-align:left;padding:0}
section{padding:44px 0}
footer{border-top:1px solid var(--line);padding:26px 0 44px;color:var(--faint);font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between}
@media(max-width:640px){h1{word-break:break-word}}
</style>
</head>
<body>
<div class="bar"><div class="shell">
  <span class="brand">${label}</span>
  <nav>
    ${links.length ? '<a href="#links">Links</a>' : ""}
    ${addresses.length ? '<a href="#addresses">Addresses</a>' : ""}
    ${opensea ? `<a href="${attr(opensea)}" target="_blank" rel="noreferrer">OpenSea</a>` : ""}
  </nav>
</div></div>

<div class="shell">
  <div class="rule"><span>01 / identity</span><span>${label}.hoodfi.eth</span></div>

  <div class="hero">
    <div>
      <h1>${name}</h1>
      ${data.tagline ? `<p class="tagline">${esc(data.tagline)}</p>` : ""}
      ${data.bio ? `<div class="bio">${paragraphs(data.bio)}</div>` : ""}
    </div>
    ${avatar ? `<div class="portrait"><img src="${attr(avatar)}" alt="${attr(name)}"></div>` : ""}
  </div>

  ${
    socials.length
      ? `<section>
    <div class="rule"><span>02 / elsewhere</span><span>${socials.length} ${socials.length === 1 ? "link" : "links"}</span></div>
    <div class="grid" style="margin-top:20px">
      ${socials
        .map(
          ([l, u]) =>
            `<div class="cell"><div class="k">${esc(l)}</div><a class="v" href="${attr(u)}" target="_blank" rel="noreferrer">${esc(u.replace(/^https?:\/\//, ""))}</a></div>`
        )
        .join("\n      ")}
    </div>
  </section>`
      : ""
  }

  ${
    links.length
      ? `<section id="links">
    <div class="rule"><span>03 / links</span><span>${links.length}</span></div>
    <div class="grid" style="margin-top:20px">
      ${links
        .map(
          (l) =>
            `<div class="cell"><div class="k">${esc(l.label)}</div><a class="v" href="${attr(l.url)}" target="_blank" rel="noreferrer">${esc(l.url.replace(/^https?:\/\//, ""))}</a></div>`
        )
        .join("\n      ")}
    </div>
  </section>`
      : ""
  }

  ${
    addresses.length
      ? `<section id="addresses">
    <div class="rule"><span>04 / addresses</span><span>tap to copy</span></div>
    <div class="grid" style="margin-top:20px">
      ${addresses
        .map(
          ([l, v]) =>
            `<div class="cell"><div class="k">${esc(l)}</div><button class="v" data-copy="${attr(v)}" title="${attr(v)}">${esc(shortAddress(v))}</button></div>`
        )
        .join("\n      ")}
    </div>
  </section>`
      : ""
  }

  <footer>
    <span>${label}.hoodfi.eth</span>
    <span>built with hoodfi sites</span>
  </footer>
</div>
<script>${COPY_SCRIPT}
${ANCHOR_SCRIPT}</script>
</body>
</html>`;
}

export const terminal: Template = {
  id: "terminal",
  name: "Terminal",
  blurb: "Black ground, acid nav, everything set in a bitmap mono.",
  audience: "Collectors and PFP holders",
  render: renderTerminal,
};
