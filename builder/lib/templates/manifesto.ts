import { ARCHIVO_800_WIDE, DEPARTURE_MONO } from "./fonts.ts";
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
 * Manifesto — pure black, enormous wide type, one accent word.
 *
 * The widest thing in the set, and the only one whose hero is type alone. Its display
 * face is Archivo at `wdth=125`, the actual top of the variable axis — a real width, not
 * a transform. `scaleX` on a normal-width face thins the horizontal strokes while
 * leaving the verticals alone, which is exactly the tell that makes stretched type look
 * cheap, and at 120px it is impossible to miss.
 *
 * The accent word is the last word of the name, lifted into lime. If the name is one
 * word, the whole thing goes lime rather than splitting a word in half.
 */
function renderManifesto(data: SiteData): string {
  const raw = (data.displayName || data.label).trim();
  const words = raw.split(/\s+/);
  const head = words.length > 1 ? esc(words.slice(0, -1).join(" ")) : "";
  const accent = esc(words[words.length - 1] ?? "");

  const label = esc(data.label);
  const avatar = safeImage(data.avatar);
  const site = safeUrl(data.website);
  const opensea = safeUrl(data.opensea);

  const meta = (
    [
      data.x ? ["X", `https://x.com/${handle(data.x)}`] : null,
      data.github ? ["GITHUB", `https://github.com/${handle(data.github)}`] : null,
      data.telegram ? ["TELEGRAM", `https://t.me/${handle(data.telegram)}`] : null,
      data.discord ? ["DISCORD", `https://discord.gg/${handle(data.discord)}`] : null,
      site ? ["SITE", site] : null,
      opensea ? ["OPENSEA", opensea] : null,
    ].filter(Boolean) as [string, string][]
  );

  const addresses = (
    [
      data.ethAddress ? ["ETH", data.ethAddress.trim()] : null,
      data.btcAddress ? ["BTC", data.btcAddress.trim()] : null,
      data.solAddress ? ["SOL", data.solAddress.trim()] : null,
    ].filter(Boolean) as [string, string][]
  );

  const links = data.links
    .map((l) => ({ label: l.label.trim(), url: safeUrl(l.url) }))
    .filter((l) => l.label && l.url);

  const year = new Date().getUTCFullYear();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(raw)} · ${label}.hoodfi.eth</title>
<meta name="description" content="${attr(data.tagline || `${raw} on HoodFi`)}">
<meta property="og:title" content="${attr(raw)}">
<meta property="og:description" content="${attr(data.tagline)}">
<meta property="og:type" content="profile">
${avatar ? `<meta property="og:image" content="${attr(avatar)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<style>
@font-face{font-family:'ArchivoWide';src:url(data:font/woff2;base64,${ARCHIVO_800_WIDE}) format('woff2');font-weight:800;font-style:normal;font-display:swap}
@font-face{font-family:'DepartureMono';src:url(data:font/woff2;base64,${DEPARTURE_MONO}) format('woff2');font-weight:400;font-style:normal;font-display:swap}
:root{--ink:#000;--paper:#fff;--lime:#c6f702;--dim:rgba(255,255,255,.62);--faint:rgba(255,255,255,.38);--line:rgba(255,255,255,.16)}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{background:var(--ink);color:var(--paper);font-family:'DepartureMono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;line-height:1.6;overflow-x:hidden}
a{color:inherit;text-decoration:none}
.shell{max-width:1320px;margin:0 auto;padding:0 clamp(20px,4vw,48px)}
.top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:26px 0;flex-wrap:wrap;font-size:11.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--faint)}
.top .id{color:var(--paper)}
.hero{padding:clamp(48px,9vw,120px) 0 clamp(40px,6vw,80px);container-type:inline-size}
.slash{color:var(--lime);font-size:11.5px;letter-spacing:.22em;text-transform:uppercase}
h1{font-family:'ArchivoWide',system-ui,sans-serif;font-weight:800;font-size:clamp(40px,12.5cqi,150px);line-height:.92;letter-spacing:-.02em;text-transform:uppercase;margin-top:clamp(20px,3vw,40px);overflow-wrap:anywhere}
h1 .accent{color:var(--lime);display:block}
.tagline{margin-top:clamp(24px,3vw,44px);max-width:60ch;font-size:clamp(13px,1.4vw,15px);letter-spacing:.04em;text-transform:uppercase;line-height:1.7;color:var(--dim)}
.portrait{width:clamp(88px,10vw,132px);aspect-ratio:1;border:1px solid var(--line);overflow:hidden;margin-top:clamp(32px,4vw,48px)}
.portrait img{display:block;width:100%;height:100%;object-fit:cover}
section{border-top:1px solid var(--line);padding:clamp(36px,5vw,64px) 0}
.marker{color:var(--lime);font-size:11px;letter-spacing:.22em;text-transform:uppercase}
.bio{margin-top:26px;max-width:72ch;color:var(--dim);font-size:14.5px;line-height:1.8}
.bio p+p{margin-top:18px}
.list{margin-top:26px;display:flex;flex-wrap:wrap}
.item{flex:1 1 300px;min-width:0;padding:18px 20px 18px 0;border-bottom:1px solid var(--line)}
.item .k{font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--faint)}
.item .v{margin-top:8px;font-size:14px;word-break:break-all}
.item a.v:hover,.item button.v:hover{color:var(--lime)}
button.v{background:none;border:0;color:inherit;font:inherit;cursor:pointer;text-align:left;padding:0}
footer{border-top:1px solid var(--line);padding:26px 0 48px;display:flex;flex-wrap:wrap;gap:14px;justify-content:space-between;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--faint)}
</style>
</head>
<body>
<div class="shell">
  <div class="top">
    <span class="id">${label}.hoodfi.eth</span>
    <span>${esc(String(year))} · HoodFi Sites</span>
  </div>

  <div class="hero">
    <div class="slash">// ${label}.hoodfi.eth</div>
    <h1>${head ? `${head}<br>` : ""}<span class="accent">${accent}.</span></h1>
    ${data.tagline ? `<p class="tagline">${esc(data.tagline)}</p>` : ""}
    ${avatar ? `<div class="portrait"><img src="${attr(avatar)}" alt="${attr(raw)}"></div>` : ""}
  </div>

  ${
    data.bio
      ? `<section>
    <div class="marker">01 / statement</div>
    <div class="bio">${paragraphs(data.bio)}</div>
  </section>`
      : ""
  }

  ${
    links.length
      ? `<section id="links">
    <div class="marker">02 / links</div>
    <div class="list">
      ${links
        .map(
          (l) =>
            `<div class="item"><div class="k">${esc(l.label)}</div><a class="v" href="${attr(l.url)}" target="_blank" rel="noreferrer">${esc(l.url.replace(/^https?:\/\//, ""))} →</a></div>`
        )
        .join("\n      ")}
    </div>
  </section>`
      : ""
  }

  ${
    meta.length
      ? `<section>
    <div class="marker">03 / channels</div>
    <div class="list">
      ${meta
        .map(
          ([k, u]) =>
            `<div class="item"><div class="k">${esc(k)}</div><a class="v" href="${attr(u)}" target="_blank" rel="noreferrer">${esc(u.replace(/^https?:\/\//, ""))} →</a></div>`
        )
        .join("\n      ")}
    </div>
  </section>`
      : ""
  }

  ${
    addresses.length
      ? `<section id="addresses">
    <div class="marker">04 / addresses</div>
    <div class="list">
      ${addresses
        .map(
          ([k, v]) =>
            `<div class="item"><div class="k">${esc(k)}</div><button class="v" data-copy="${attr(v)}" title="${attr(v)}">${esc(shortAddress(v))}</button></div>`
        )
        .join("\n      ")}
    </div>
  </section>`
      : ""
  }

  <footer>
    <span>${label}.hoodfi.eth</span>
    <span>Built with HoodFi Sites</span>
  </footer>
</div>
<script>${COPY_SCRIPT}
${ANCHOR_SCRIPT}</script>
</body>
</html>`;
}

export const manifesto: Template = {
  id: "manifesto",
  name: "Manifesto",
  blurb: "Pure black, enormous wide type, a single accent word.",
  audience: "Projects and founders",
  render: renderManifesto,
};
