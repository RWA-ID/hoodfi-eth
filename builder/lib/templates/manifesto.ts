import { ARCHIVO_600_WIDE, ARCHIVO_600_WIDE_ADV, DEPARTURE_MONO } from "./fonts.ts";
import { ICON_CSS, keyed, sprite, type IconId } from "./icons.ts";
import { ANCHOR_SCRIPT, COPY_SCRIPT, attr, esc, fitSize, handle, paragraphs, OG_AVATAR, PAGE_AVATAR, safeImage, safeUrl, shortAddress } from "./html.ts";
import { BUILDER_URL } from "./html.ts";
import type { SiteData, Template } from "./types.ts";

/**
 * Manifesto — one full-height black statement, everything else pushed to the edges.
 *
 * A hairline grid and four registration marks do the work that decoration would
 * otherwise have to: they make the emptiness look measured rather than unfinished. The
 * accent word is the last word of the name, lifted into lime; a single-word name goes
 * lime whole rather than being split.
 *
 * Display face is Archivo at wdth=125, a real axis rather than scaleX — a transform
 * thins horizontal strokes and leaves verticals alone, which is the tell that makes
 * stretched type look cheap, and it is unmissable at this size.
 */
function renderManifesto(data: SiteData): string {
  const raw = (data.displayName || data.label).trim();
  const words = raw.split(/\s+/);
  const head = words.length > 1 ? esc(words.slice(0, -1).join(" ")) : "";
  const accent = esc(words[words.length - 1] ?? "");

  const label = esc(data.label);
  const avatar = safeImage(data.avatar, PAGE_AVATAR);
  // Its own copy, larger: the page slots are 30-140px squares, the card is neither.
  const avatarOg = safeImage(data.avatar, OG_AVATAR);
  const site = safeUrl(data.website);
  const opensea = safeUrl(data.opensea);

  const cols: { id?: IconId; k: string; v: string; url?: string; copy?: string }[] = [];
  if (data.x) cols.push({ id: "x", k: "X", v: `@${handle(data.x)}`, url: `https://x.com/${handle(data.x)}` });
  if (data.github) cols.push({ id: "gh", k: "GITHUB", v: `/${handle(data.github)}`, url: `https://github.com/${handle(data.github)}` });
  if (opensea) cols.push({ id: "os", k: "OPENSEA", v: "open", url: opensea });
  if (site) cols.push({ k: "SITE", v: site.replace(/^https?:\/\//, ""), url: site });
  if (data.ethAddress) cols.push({ id: "eth", k: "ETH", v: shortAddress(data.ethAddress.trim()), copy: data.ethAddress.trim() });
  if (data.btcAddress) cols.push({ id: "btc", k: "BTC", v: shortAddress(data.btcAddress.trim()), copy: data.btcAddress.trim() });
  if (data.solAddress) cols.push({ id: "sol", k: "SOL", v: shortAddress(data.solAddress.trim()), copy: data.solAddress.trim() });

  const usedIcons = [...(cols.map((c) => c.id).filter(Boolean) as IconId[]), "rh" as IconId];

  /*
   * Headline size: the largest that fits the longest line on one row.
   *
   * 854px is what the middle column actually has at the 1180 max-width — 1180 less 80 of
   * padding, less the 246 reserved for the portrait. The lines are the leading words on
   * one row and the accent word plus its period on the next, and the text is uppercased
   * by CSS, so that is the form to measure. 132 is the handoff's size and stays the
   * ceiling; 46 is the floor, below which this stops being a poster.
   */
  const headLines = [words.slice(0, -1).join(" "), `${words[words.length - 1] ?? ""}.`]
    .filter(Boolean)
    .map((line) => line.toUpperCase());
  const headSize = Math.min(
    ...headLines.map((line) => fitSize(line, ARCHIVO_600_WIDE_ADV, 854, 132, 46, -0.035))
  );
  const year = new Date().getUTCFullYear();
  const links = data.links.map((l) => ({ label: l.label.trim(), url: safeUrl(l.url) })).filter((l) => l.label && l.url);

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
${avatarOg ? `<meta property="og:image" content="${attr(avatarOg)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<style>
@font-face{font-family:'ArchivoWide';src:url(data:font/woff2;base64,${ARCHIVO_600_WIDE}) format('woff2');font-weight:600;font-style:normal;font-display:swap}
@font-face{font-family:'DepartureMono';src:url(data:font/woff2;base64,${DEPARTURE_MONO}) format('woff2');font-weight:400;font-style:normal;font-display:swap}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{background:#000;color:#fff;font-family:'DepartureMono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.6;overflow-x:hidden;position:relative;min-height:720px}
a{color:inherit;text-decoration:none}
${ICON_CSS}
.grid{position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:100% 84px,84px 100%}
.reg{position:fixed;width:11px;height:11px;border:1px solid rgba(255,255,255,.3);pointer-events:none}
.shell{position:relative;max-width:1180px;margin:0 auto;padding:30px 40px 40px;display:flex;flex-direction:column;min-height:720px}
.top{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.42)}
.top .id{color:#fff}
.mid{flex:1;display:flex;flex-direction:column;justify-content:center;padding:48px 0;position:relative}
.slash{font-size:11px;letter-spacing:.26em;color:#c6f702;text-transform:uppercase}
/* Size is computed per headline — see the note in the render function. The handoff's 132
   is the ceiling, not a constant: a single long word at 132 broke mid-word, and no amount
   of wrapping helps a word that does not fit. Weight is 600 rather than the handoff's 800
   because at this size the 800 was the only thing on the page. */
h1{margin-top:30px;font-family:'ArchivoWide',system-ui,sans-serif;font-weight:600;line-height:.9;letter-spacing:-.035em;text-transform:uppercase;overflow-wrap:anywhere}
h1 .a{color:#c6f702;display:block}
.tag{margin-top:40px;max-width:56ch;font-size:12.5px;line-height:1.9;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.55)}
.tag p+p{margin-top:16px}
.face{width:190px;height:190px;border:1px solid rgba(255,255,255,.16);overflow:hidden;margin-top:26px}
/* The portrait is taken out of flow here, so nothing below it knows it exists: a long
   word in the headline ran straight underneath the picture. Reserving the column as
   padding on .mid fixes it for the headline, the tagline and the links at once —
   and it does NOT move the portrait, because right:0 resolves against the PADDING
   box, not the content box. */
@media(min-width:761px){
  .face{position:absolute;right:0;top:50%;transform:translateY(-50%);margin-top:0}
  .mid{padding-right:246px}
}
.face img{width:100%;height:100%;object-fit:cover;display:block}
.links{margin-top:44px;display:flex;flex-wrap:wrap;gap:0 40px}
.links a{padding:14px 0;border-bottom:1px solid rgba(255,255,255,.14);flex:1 1 240px;min-width:0;font-size:13px}
.links a:hover{color:#c6f702}
.links .k{font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:rgba(255,255,255,.34)}
.links .v{margin-top:7px;word-break:break-all}
.bot{display:flex;flex-wrap:wrap;gap:24px;justify-content:space-between;align-items:flex-end;border-top:1px solid rgba(255,255,255,.14);padding-top:22px}
.cols{display:flex;gap:24px 52px;flex-wrap:wrap;min-width:0}
.col{min-width:0}
.col .k{font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:rgba(255,255,255,.34)}
.col .v{margin-top:8px;font-size:13px;word-break:break-all}
.col a:hover,.col button:hover{color:#c6f702}
button.v{background:none;border:0;color:inherit;font:inherit;cursor:pointer;text-align:left;padding:0}
.pg:hover{color:#c6f702}
.pg{font-size:11px;letter-spacing:.2em;color:rgba(255,255,255,.34);white-space:nowrap}
/* One breakpoint, 760px, exactly as the handoff specifies. */
@media(max-width:760px){
  body{min-height:0}
  .shell{min-height:0;padding:22px 18px 26px}
  .grid{background-size:100% 48px,48px 100%}
  .top{flex-direction:column;gap:7px;font-size:9.5px;letter-spacing:.16em}
  .mid{padding:30px 0}
  h1{font-size:52px!important;margin-top:20px}
  .tag{margin-top:24px;font-size:11px;line-height:1.85;max-width:none}
  .face{width:112px;height:112px;margin-top:26px}
  .bot{flex-direction:column;align-items:flex-start;gap:18px;padding-top:18px}
  .cols{gap:20px 26px}
  .reg{display:none}
  .links{margin-top:32px}
}
</style>
</head>
<body>
${sprite(usedIcons)}
<div class="grid"></div>
<span class="reg" style="left:16px;top:16px"></span><span class="reg" style="right:16px;top:16px"></span>
<span class="reg" style="left:16px;bottom:16px"></span><span class="reg" style="right:16px;bottom:16px"></span>

<div class="shell">
  <div class="top"><span class="id">${label}.HOODFI.ETH</span>${keyed("rh", "LIFETIME NAME · ROBINHOOD CHAIN")}</div>

  <div class="mid">
    <div class="slash">// ${data.tagline ? esc(data.tagline) : `${label}.hoodfi.eth`}</div>
    <h1 style="font-size:${headSize}px">${head ? `${head}<br>` : ""}<span class="a">${accent}.</span></h1>
    ${data.bio ? `<div class="tag">${paragraphs(data.bio)}</div>` : ""}
    ${avatar ? `<div class="face"><img src="${attr(avatar)}" alt="${attr(raw)}"></div>` : ""}
    ${
      links.length
        ? `<div class="links">${links
            .map(
              (l) =>
                `<a href="${attr(l.url)}" target="_blank" rel="noreferrer"><div class="k">${esc(l.label)}</div><div class="v">${esc(l.url.replace(/^https?:\/\//, ""))} →</div></a>`
            )
            .join("")}</div>`
        : ""
    }
  </div>

  <div class="bot">
    <div class="cols">
      ${cols
        .map((c) => {
          const key = c.id ? keyed(c.id, esc(c.k)) : esc(c.k);
          const value = c.url
            ? `<a class="v" href="${attr(c.url)}" target="_blank" rel="noreferrer">${esc(c.v)}</a>`
            : `<button class="v" data-copy="${attr(c.copy ?? "")}" title="${attr(c.copy ?? "")}">${esc(c.v)}</button>`;
          return `<div class="col"><div class="k">${key}</div>${value}</div>`;
        })
        .join("\n      ")}
    </div>
    <a class="pg" href="${BUILDER_URL}" target="_blank" rel="noreferrer">${year} · BUILT WITH HOODFI SITES</a>
  </div>
</div>
<script>${COPY_SCRIPT}
${ANCHOR_SCRIPT}</script>
</body>
</html>`;
}

export const manifesto: Template = {
  id: "manifesto",
  name: "Manifesto",
  blurb: "Pure black, one enormous statement, everything else at the edges.",
  audience: "Projects and founders",
  render: renderManifesto,
};
