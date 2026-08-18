import { MANROPE_400, MANROPE_700 } from "./fonts.ts";
import { ICON_CSS, icon, sprite, type IconId } from "./icons.ts";
import { ANCHOR_SCRIPT, COPY_SCRIPT, attr, esc, handle, paragraphs, safeImage, safeUrl, shortAddress } from "./html.ts";
import type { SiteData, Template } from "./types.ts";

/**
 * Product — the generative field as the hero backdrop, with a glass card floating over it.
 *
 * The only warm one in the set: white ground, Manrope's soft terminals, pill buttons,
 * rounded corners. It exists because the other three are hard-edged, and someone making
 * a page for a small team or a tool is not served by any of them.
 *
 * The field is an inline SVG generated from the name — deterministic, so it never changes
 * on reload, but two sites never get the same arrangement. Drawn rather than shipped as
 * an image: it tiles at any size, weighs a few hundred bytes, and stays crisp on retina.
 */
function dotField(seed: string): string {
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

  // A dense field rather than scattered dots. Density and saturation both climb to the
  // right, which is what makes it read as motion across the hero instead of noise laid
  // over it — sparse pale marks on the left where the headline sits, solid colour on the
  // right where nothing does.
  const cols = 30;
  const rows = 13;
  const step = 34;
  const cells: string[] = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const t = x / (cols - 1);
      const cx = x * step + 18;
      const cy = y * step + 18;
      const r = rnd();
      // Left third is mostly the faint plus, so the headline always has quiet ground.
      if (r > 0.15 + (1 - t) * 0.5) {
        const kind = rnd();
        const warm = rnd();
        const fill = warm > 0.88 ? "#c6f702" : t > 0.55 && warm > 0.45 ? "#2f6bff" : t > 0.3 ? "#7ea4ff" : "#c8d6ff";
        cells.push(
          kind > 0.55
            ? `<path d="M${cx - 9} ${cy + 9}a18 18 0 0 1 18-18v18z" fill="${fill}"/>`
            : `<circle cx="${cx}" cy="${cy}" r="4.6" fill="${fill}"/>`
        );
      } else if (r > 0.06) {
        // The plus marks: registration ticks that keep the empty half from reading blank.
        const o = t > 0.4 ? 0.5 : 0.32;
        cells.push(
          `<path d="M${cx - 4} ${cy}h8M${cx} ${cy - 4}v8" stroke="#9db8ff" stroke-width="1.2" opacity="${o}"/>`
        );
      }
    }
  }
  return `<svg class="field" viewBox="0 0 ${cols * step} ${rows * step}" preserveAspectRatio="xMidYMid slice" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${cells.join("")}</svg>`;
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
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{background:#fff;color:#0d1117;font-family:'Manrope',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:16px;line-height:1.65;overflow-x:hidden}
a{color:inherit;text-decoration:none}
${ICON_CSS}
.shell{max-width:1220px;margin:0 auto;padding:0 clamp(20px,4vw,34px)}
header{border-bottom:1px solid #e4e9f2}
header .shell{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;min-height:70px;padding-top:12px;padding-bottom:12px}
.brand{display:flex;align-items:center;gap:11px;font-weight:700;font-size:16.5px;min-width:0}
.brand .d{width:30px;height:30px;border-radius:9px;overflow:hidden;background:#2f6bff;flex:none}
.brand .d img{width:100%;height:100%;object-fit:cover;display:block}
.pill{display:inline-flex;align-items:center;gap:7px;height:40px;padding:0 19px;border-radius:999px;font-weight:700;font-size:14px;background:#2f6bff;color:#fff;white-space:nowrap}
.pill.g{background:transparent;color:#0d1117;border:1px solid #e4e9f2}
.hero{position:relative;padding:56px 0 76px;overflow:hidden}
.field{position:absolute;right:-30px;top:14px;width:min(620px,60vw);opacity:.95;pointer-events:none}
@media(max-width:820px){.field{opacity:.35;right:-80px}}
.pfp{position:relative;width:clamp(96px,13vw,150px);aspect-ratio:1;border-radius:clamp(24px,3.4vw,34px);overflow:hidden;background:#2f6bff;box-shadow:0 0 0 6px #fff,0 20px 38px -20px rgba(13,17,23,.45);margin-bottom:28px}
.pfp img{width:100%;height:100%;object-fit:cover;display:block}
h1{font-size:clamp(36px,5.4vw,56px);font-weight:700;line-height:1.05;letter-spacing:-.035em;max-width:14ch;position:relative}
.tag{margin-top:20px;font-size:clamp(16.5px,2vw,18.5px);line-height:1.6;color:#4a5568;max-width:38ch;position:relative}
.cta{margin-top:30px;display:flex;flex-wrap:wrap;gap:12px;position:relative}
.card{position:relative;margin-top:40px;width:min(340px,100%);background:rgba(255,255,255,.86);backdrop-filter:blur(9px);border:1px solid #e4e9f2;border-radius:18px;padding:22px;box-shadow:0 22px 44px -26px rgba(13,17,23,.4)}
@media(min-width:900px){.card{position:absolute;right:0;bottom:0;margin-top:0}}
.card .t{font-weight:700;font-size:15.5px}
.card .s{margin-top:7px;font-size:13.5px;color:#4a5568;line-height:1.55}
.chain{margin-top:12px;display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:700;color:#2f6bff;background:#eef3ff;border-radius:999px;padding:6px 11px}
.stats{margin-top:20px;display:flex;flex-wrap:wrap;gap:20px 30px}
.stats .n{font-size:26px;font-weight:700;letter-spacing:-.02em}
.stats .l{font-size:12px;color:#8a94a6}
section{padding-top:clamp(44px,6vw,56px);border-top:1px solid #e4e9f2;margin-top:clamp(32px,5vw,48px)}
.mk{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#8a94a6}
h2{margin-top:11px;font-size:clamp(26px,3.6vw,34px);font-weight:700;letter-spacing:-.03em}
.body{margin-top:20px;max-width:62ch;color:#4a5568}
.body p+p{margin-top:14px}
.cards{margin-top:26px;display:flex;flex-wrap:wrap;gap:15px}
.c{flex:1 1 250px;min-width:0;border:1px solid #e4e9f2;border-radius:16px;padding:21px;min-height:116px;display:flex;flex-direction:column;justify-content:space-between;transition:border-color .15s ease,transform .15s ease}
.c:hover{border-color:#2f6bff;transform:translateY(-2px)}
.c .t{font-weight:700;font-size:17px}
.c .u{font-size:13.5px;color:#8a94a6;word-break:break-all}
.rows{margin-top:26px}
.row{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px 20px;padding:15px 0;border-bottom:1px solid #e4e9f2;font-size:14.5px}
.row .k{font-weight:700}
.row .v{color:#4a5568;min-width:0;word-break:break-all;text-align:right}
button.v{background:none;border:0;font:inherit;cursor:pointer;color:#2f6bff;padding:0}
footer{margin-top:clamp(40px,6vw,56px);background:#f6f8fc;border-top:1px solid #e4e9f2}
footer .shell{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;padding-top:26px;padding-bottom:34px;font-size:14px;color:#8a94a6}
</style>
</head>
<body>
${sprite(usedIcons)}
<header><div class="shell">
  <span class="brand">
    <span class="d">${avatar ? `<img src="${attr(avatar)}" alt="">` : ""}</span>${name}
  </span>
  <span style="display:flex;gap:10px;flex-wrap:wrap">
    ${opensea ? `<a class="pill g" href="${attr(opensea)}" target="_blank" rel="noreferrer">${icon("os", "width:16px;height:16px")}OpenSea</a>` : ""}
    ${site ? `<a class="pill" href="${attr(site)}" target="_blank" rel="noreferrer">Visit site</a>` : ""}
  </span>
</div></header>

<div class="shell">
  <div class="hero">
    ${dotField(data.label || "hoodfi")}
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
      <div class="stats">
        <div><div class="n">∞</div><div class="l">Expiry</div></div>
        <div><div class="n">$0</div><div class="l">Renewals</div></div>
        <div><div class="n">4663</div><div class="l">Chain</div></div>
      </div>
    </div>
  </div>

  ${
    data.bio
      ? `<section>
    <div class="mk">About</div>
    <h2>What this is.</h2>
    <div class="body">${paragraphs(data.bio)}</div>
  </section>`
      : ""
  }

  ${
    links.length
      ? `<section id="links">
    <div class="mk">Links</div>
    <h2>Everything in one place.</h2>
    <div class="cards">
      ${links
        .map(
          (l) =>
            `<a class="c" href="${attr(l.url)}" target="_blank" rel="noreferrer"><div class="t">${esc(l.label)}</div><div class="u">${esc(l.url.replace(/^https?:\/\//, ""))}</div></a>`
        )
        .join("\n      ")}
    </div>
  </section>`
      : ""
  }

  ${
    rows.length
      ? `<section id="addresses">
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

export const product: Template = {
  id: "product",
  name: "Product",
  blurb: "Light and generous, with a generative field behind the headline.",
  audience: "Teams and tools",
  render: renderProduct,
};
