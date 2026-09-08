/**
 * Renders the README banner to docs/banner.png.
 *
 * The banner is documentation art, not site art, which is why it lives in docs/
 * rather than frontend/public/: everything under public/ is pinned to IPFS on every
 * deploy, and a 4:1 header image has no business riding along in the bundle.
 *
 * It is deliberately the same system as the OG cards in frontend/scripts/make-og.mjs —
 * lime ground, ink type, radius 0, oversized tight-set Archivo over tracked IBM Plex
 * Mono, the flat H mark. A README opening in a different visual language than the
 * product it documents is worse than a README opening in none.
 *
 * Rendered at 1280x320 with deviceScaleFactor 2, so the committed file is 2560x640 and
 * stays crisp when GitHub scales it down into the content column on a retina display.
 *
 * Playwright comes from the video project, as it does in make-og.mjs — there is no
 * sharp or ImageMagick on this machine and nothing here justifies a dependency.
 *
 * Run: node docs/make-banner.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(
  "/Users/hector/robot-id-intro-video/node_modules/playwright/"
);
const { chromium } = require("/Users/hector/robot-id-intro-video/node_modules/playwright");

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "banner.png");

// Inlined, not linked: the shot is taken the moment fonts resolve, and a mark still in
// flight at that point is simply absent from the image.
const MARK_URI = `data:image/png;base64,${readFileSync(
  join(HERE, "..", "frontend", "public", "hoodfi-h.png")
).toString("base64")}`;

const INK = "#0B0E08";
const LIME = "#C6F702";

/**
 * The three cells are static facts on purpose. A committed PNG cannot be re-rendered
 * when a number moves, so anything that changes — names minted, years donated, the
 * republish price — would be a lie with a long half-life. Chain id, floor price and
 * "none" renewals are true for as long as the project is.
 */
const CELLS = [
  ["chain", "4663"],
  ["mint from", "$3"],
  ["renewals", "none"],
];

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;800&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1280px; height: 320px; background: ${LIME}; color: ${INK};
    font-family: Archivo, sans-serif; overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }
  .frame {
    height: 100%; padding: 44px 58px;
    display: flex; align-items: stretch; justify-content: space-between; gap: 44px;
  }
  /* Centred as a block rather than pinned top and bottom. At 4:1 there is not enough
     vertical room for space-between to read as composition — it reads as drift. */
  .left { display: flex; flex-direction: column; justify-content: center; }
  .top { display: flex; align-items: center; gap: 13px; }
  /* The mark ships as one green glyph; on lime that green sinks into the ground.
     brightness(0) keeps the alpha and drops the colour, which is what recolouring a
     flat PNG means here. Same treatment as the lime OG cards. */
  .mark { width: 30px; height: 30px; display: block; filter: brightness(0); }
  .wordmark {
    font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 18px;
    letter-spacing: .2em; text-transform: uppercase; color: rgba(11,14,8,.62);
  }
  /* One line. A banner is four times wider than it is tall, and a stacked headline
     spends the height it does not have to leave the width it does have empty. */
  h1 {
    margin-top: 26px; font-weight: 800; font-size: 86px; line-height: .9;
    letter-spacing: -.045em; text-transform: uppercase; white-space: nowrap;
    /* Tracking that tight closes the word gap too, and the two words start reading as
       one. Buy the space back on the gap alone rather than loosening the whole line. */
    word-spacing: .12em;
  }
  .sub {
    margin-top: 22px; font-size: 20px; font-weight: 500;
    line-height: 1.4; color: rgba(11,14,8,.72); max-width: 52ch;
  }
  .mono { font-family: 'IBM Plex Mono', monospace; font-size: .9em; }

  /* A single hairline carries the whole right edge — the cards use one rule and no
     boxes, and a banner is not the place to invent a second device. */
  .right {
    display: flex; flex-direction: column; justify-content: center; gap: 26px;
    border-left: 1px solid rgba(11,14,8,.28); padding-left: 38px; text-align: right;
  }
  .cell { display: flex; flex-direction: column; gap: 7px; }
  .cell-label {
    font-family: 'IBM Plex Mono', monospace; font-size: 13px; letter-spacing: .2em;
    text-transform: uppercase; color: rgba(11,14,8,.58);
  }
  .cell-value { font-size: 30px; font-weight: 800; letter-spacing: -.03em; line-height: 1; }
</style></head>
<body>
  <div class="frame">
    <div class="left">
      <div class="top">
        <img class="mark" src="${MARK_URI}" alt="">
        <span class="wordmark">ens names on robinhood chain</span>
      </div>
      <h1>HoodFi Names</h1>
      <div class="sub">
        Lifetime <span class="mono">*.hoodfi.eth</span> names, minted on Robinhood
        Chain and resolving on Ethereum mainnet.
      </div>
    </div>
    <div class="right">
      ${CELLS.map(
        ([label, value]) => `<div class="cell">
        <span class="cell-label">${label}</span>
        <span class="cell-value">${value}</span>
      </div>`
      ).join("\n      ")}
    </div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 320 },
  deviceScaleFactor: 2,
});

await page.setContent(html, { waitUntil: "networkidle" });
// Webfonts must resolve before the shot or the banner renders in a system face, with
// no second chance to repaint.
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: OUT });
console.log("wrote", OUT);

await browser.close();
