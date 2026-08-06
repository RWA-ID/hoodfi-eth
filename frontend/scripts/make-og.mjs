/**
 * Renders the per-route OG cards to public/og/*.png at 1200x630.
 *
 * There is no sharp or ImageMagick on this machine, so the cards are laid out in
 * HTML and screenshotted with the Playwright install from the video project.
 *
 * Run: node scripts/make-og.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(
  "/Users/hector/robot-id-intro-video/node_modules/playwright/"
);
const { chromium } = require("/Users/hector/robot-id-intro-video/node_modules/playwright");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "og");

const INK = "#0a0f0c";
const PAPER = "#e9f2ea";
const GREEN = "#00c805";

const CARDS = [
  {
    file: "default.png",
    eyebrow: "ens names · robinhood chain",
    title: "Mint your name.",
    accent: "Own it forever.",
    sub: "Lifetime *.hoodfi.eth names. One transaction from $3 — no renewals, no expiry.",
  },
  {
    file: "mint.png",
    eyebrow: "mint · from $3",
    title: "Your name,",
    accent: "for life.",
    sub: "Search and mint a lifetime name on Robinhood Chain. Pay in ETH or USDG.",
  },
  {
    file: "manage.png",
    eyebrow: "manage your names",
    title: "Set up your",
    accent: "identity.",
    sub: "Point your name anywhere. Add an avatar, your X and a bio — all onchain, all yours.",
  },
  {
    file: "faq.png",
    eyebrow: "questions, answered plainly",
    title: "How HoodFi",
    accent: "works.",
    sub: "Minting, pricing, short-name credits, records and resolution.",
  },
  {
    file: "legal.png",
    eyebrow: "the fine print",
    title: "Terms, privacy",
    accent: "& disclaimer.",
    sub: "Unaudited contracts. Independent project, not affiliated with Robinhood Markets.",
  },
];

/** Fonts are loaded from Google so the card matches the site's type, not a system face. */
function html(card) {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Serif:ital@1&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; background: ${INK}; color: ${PAPER};
    font-family: 'Space Grotesk', sans-serif; overflow: hidden; position: relative;
  }
  .glow {
    position: absolute; top: -220px; left: -120px; width: 1100px; height: 620px;
    background: radial-gradient(ellipse at center, rgba(0,200,5,0.20), transparent 65%);
    filter: blur(20px);
  }
  .frame { position: relative; padding: 74px 80px; height: 100%; display: flex; flex-direction: column; }
  .eyebrow {
    font-family: 'IBM Plex Mono', monospace; font-size: 20px; letter-spacing: 0.14em;
    text-transform: uppercase; color: ${GREEN};
  }
  h1 { font-size: 92px; line-height: 1.02; font-weight: 700; letter-spacing: -0.02em; margin-top: 34px; }
  .chrome {
    background: linear-gradient(180deg, #ffffff 0%, #cfe0d3 52%, #8fa595 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .accent { font-family: 'IBM Plex Serif', serif; font-style: italic; font-weight: 400; color: ${GREEN}; }
  .sub {
    font-family: 'IBM Plex Mono', monospace; font-size: 25px; line-height: 1.5;
    color: rgba(233,242,234,0.62); margin-top: 32px; max-width: 46ch;
  }
  .foot {
    margin-top: auto; display: flex; align-items: center; justify-content: space-between;
    font-family: 'IBM Plex Mono', monospace; font-size: 23px;
    border-top: 1px solid rgba(148,210,165,0.16); padding-top: 26px;
  }
  .brand { font-weight: 500; }
  .brand span { color: ${GREEN}; }
  .host { color: rgba(233,242,234,0.36); }
</style></head>
<body>
  <div class="glow"></div>
  <div class="frame">
    <div class="eyebrow">${card.eyebrow}</div>
    <h1><span class="chrome">${card.title}</span><br><span class="accent">${card.accent}</span></h1>
    <div class="sub">${card.sub}</div>
    <div class="foot">
      <div class="brand">HoodFi<span>.eth</span></div>
      <div class="host">hoodfi.eth.limo</div>
    </div>
  </div>
</body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});

mkdirSync(OUT_DIR, { recursive: true });

for (const card of CARDS) {
  await page.setContent(html(card), { waitUntil: "networkidle" });
  // Webfonts must be resolved before the shot or the card renders in a system face
  // with no second chance to repaint.
  await page.evaluate(() => document.fonts.ready);
  const target = join(OUT_DIR, card.file);
  await page.screenshot({ path: target });
  console.log("wrote", target);
}

await browser.close();
