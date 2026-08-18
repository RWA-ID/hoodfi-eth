import { MANROPE_400, MANROPE_700 } from "./fonts.ts";
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
 * Product — light, generous, a generative field behind the headline.
 *
 * The only warm one in the set: white ground, Manrope's soft terminals, pill buttons and
 * rounded corners. It exists because three of the four are hard-edged and the audience
 * that wants a page for a small team or a tool is not served by any of them.
 *
 * The dot field is drawn as an inline SVG pattern rather than an image — it tiles at any
 * size, weighs a few hundred bytes, and stays crisp on a retina screen. Seeded off the
 * name so two sites do not get an identical field, but deterministic, because a pattern
 * that changes on reload reads as a rendering fault.
 */
function dotField(seed: string): string {
  // Cheap deterministic hash — this decides arrangement, not anything that matters.
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

  const cells: string[] = [];
  const cols = 14;
  const rows = 9;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const r = rnd();
      // Density rises to the right, so the field reads as moving rather than as noise.
      if (r > 0.25 + (1 - x / cols) * 0.55) {
        const cx = x * 28 + 14;
        const cy = y * 28 + 14;
        const kind = rnd();
        const fill = kind > 0.82 ? "#c6f702" : kind > 0.4 ? "#2f6bff" : "#9db8ff";
        cells.push(
          kind > 0.6
            ? `<path d="M${cx - 7} ${cy + 7}a14 14 0 0 1 14-14v14z" fill="${fill}"/>`
            : `<circle cx="${cx}" cy="${cy}" r="5" fill="${fill}"/>`
        );
      }
    }
  }
  return `<svg viewBox="0 0 ${cols * 28} ${rows * 28}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${cells.join("")}</svg>`;
}

function renderProduct(data: SiteData): string {
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

  const primary = links[0];

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
:root{--ink:#0d1117;--paper:#fff;--soft:#f6f8fc;--blue:#2f6bff;--lime:#c6f702;--dim:#4a5568;--faint:#8a94a6;--line:#e4e9f2}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{background:var(--paper);color:var(--ink);font-family:'Manrope',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:16px;line-height:1.65;overflow-x:hidden}
a{color:inherit;text-decoration:none}
.shell{max-width:1160px;margin:0 auto;padding:0 clamp(20px,4vw,40px)}
header{border-bottom:1px solid var(--line)}
header .shell{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:68px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:16px}
.brand .dot{width:26px;height:26px;border-radius:8px;background:var(--blue);overflow:hidden;flex:none}
.brand .dot img{width:100%;height:100%;object-fit:cover;display:block}
.pill{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 18px;border-radius:999px;font-weight:700;font-size:14px;background:var(--blue);color:#fff;white-space:nowrap}
.pill.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
.hero{position:relative;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:36px;align-items:center;padding:clamp(44px,6vw,80px) 0}
h1{font-weight:700;font-size:clamp(34px,5vw,58px);line-height:1.08;letter-spacing:-.03em;overflow-wrap:anywhere}
.tagline{margin-top:20px;font-size:clamp(16px,1.8vw,19px);color:var(--dim);max-width:40ch}
.cta{margin-top:30px;display:flex;flex-wrap:wrap;gap:12px}
.field{min-width:0}
.field svg{display:block;width:100%;height:auto;opacity:.9}
.statcard{margin-top:22px;background:var(--soft);border:1px solid var(--line);border-radius:16px;padding:20px 22px}
.statcard .k{font-size:12px;font-weight:700;color:var(--faint);letter-spacing:.04em;text-transform:uppercase}
.statcard .v{margin-top:6px;font-size:15px;word-break:break-all}
section{padding:clamp(40px,5vw,72px) 0;border-top:1px solid var(--line)}
.marker{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}
h2{margin-top:12px;font-weight:700;font-size:clamp(24px,3vw,36px);letter-spacing:-.025em;line-height:1.15}
.bio{margin-top:20px;max-width:62ch;color:var(--dim)}
.bio p+p{margin-top:14px}
.cards{display:flex;flex-wrap:wrap;gap:14px;margin-top:28px}
.card{flex:1 1 250px;min-width:0;border:1px solid var(--line);border-radius:16px;padding:20px 22px;background:var(--paper);transition:border-color .15s ease,transform .15s ease}
.card:hover{border-color:var(--blue);transform:translateY(-2px)}
.card .t{font-weight:700;font-size:17px}
.card .u{margin-top:6px;font-size:14px;color:var(--faint);word-break:break-all}
.rows{margin-top:24px}
.row{display:flex;flex-wrap:wrap;gap:8px 20px;align-items:baseline;justify-content:space-between;padding:15px 0;border-bottom:1px solid var(--line)}
.row .k{font-weight:700;font-size:14px}
.row .v{min-width:0;color:var(--dim);font-size:14.5px;word-break:break-all}
button.v{background:none;border:0;font:inherit;cursor:pointer;color:var(--blue);padding:0}
footer{border-top:1px solid var(--line);background:var(--soft)}
footer .shell{display:flex;flex-wrap:wrap;gap:14px;justify-content:space-between;padding-top:26px;padding-bottom:34px;font-size:14px;color:var(--faint)}
</style>
</head>
<body>
<header><div class="shell">
  <span class="brand">
    <span class="dot">${avatar ? `<img src="${attr(avatar)}" alt="">` : ""}</span>
    ${name}
  </span>
  <span style="display:flex;gap:10px;flex-wrap:wrap">
    ${opensea ? `<a class="pill ghost" href="${attr(opensea)}" target="_blank" rel="noreferrer">OpenSea</a>` : ""}
    ${site ? `<a class="pill" href="${attr(site)}" target="_blank" rel="noreferrer">Visit site</a>` : ""}
  </span>
</div></header>

<div class="shell">
  <div class="hero">
    <div>
      <h1>${name}</h1>
      ${data.tagline ? `<p class="tagline">${esc(data.tagline)}</p>` : ""}
      <div class="cta">
        ${primary ? `<a class="pill" href="${attr(primary.url)}" target="_blank" rel="noreferrer">${esc(primary.label)}</a>` : ""}
        ${links.length ? '<a class="pill ghost" href="#links">All links</a>' : ""}
      </div>
    </div>
    <div class="field">
      ${dotField(data.label || "hoodfi")}
      <div class="statcard">
        <div class="k">HoodFi name</div>
        <div class="v">${label}.hoodfi.eth</div>
      </div>
    </div>
  </div>

  ${
    data.bio
      ? `<section>
    <div class="marker">About</div>
    <h2>What this is.</h2>
    <div class="bio">${paragraphs(data.bio)}</div>
  </section>`
      : ""
  }

  ${
    links.length
      ? `<section id="links">
    <div class="marker">Links</div>
    <h2>Everything in one place.</h2>
    <div class="cards">
      ${links
        .map(
          (l) =>
            `<a class="card" href="${attr(l.url)}" target="_blank" rel="noreferrer"><div class="t">${esc(l.label)}</div><div class="u">${esc(l.url.replace(/^https?:\/\//, ""))}</div></a>`
        )
        .join("\n      ")}
    </div>
  </section>`
      : ""
  }

  ${
    socials.length || addresses.length
      ? `<section id="addresses">
    <div class="marker">Reach and receive</div>
    <div class="rows">
      ${socials
        .map(
          ([k, u]) =>
            `<div class="row"><span class="k">${esc(k)}</span><a class="v" href="${attr(u)}" target="_blank" rel="noreferrer">${esc(u.replace(/^https?:\/\//, ""))}</a></div>`
        )
        .join("\n      ")}
      ${addresses
        .map(
          ([k, v]) =>
            `<div class="row"><span class="k">${esc(k)}</span><button class="v" data-copy="${attr(v)}" title="${attr(v)}">${esc(shortAddress(v))} · copy</button></div>`
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

export const product: Template = {
  id: "product",
  name: "Product",
  blurb: "Light, generous, a generative field behind the headline.",
  audience: "Teams and tools",
  render: renderProduct,
};
