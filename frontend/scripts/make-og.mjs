/**
 * Renders the per-route OG cards to public/og/*.png at 1200x630.
 *
 * There is no sharp or ImageMagick on this machine, so the cards are laid out in
 * HTML and screenshotted with the Playwright install from the video project.
 *
 * The cards are the site's own system at poster scale: paper, ink and lime grounds,
 * radius 0, hairline rules, oversized tight-set Archivo over IBM Plex Mono data. Each
 * route gets the ground that matches the page behind it — the offer pages carry the
 * lime hero, /mint carries the ink of the mint card, and the reading pages sit on
 * paper — so an unfurled link looks like the thing it opens.
 *
 * Run: node scripts/make-og.mjs
 */
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(
  "/Users/hector/robot-id-intro-video/node_modules/playwright/"
);
const { chromium } = require("/Users/hector/robot-id-intro-video/node_modules/playwright");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "og");

// Inlined rather than linked: the screenshot is taken as soon as the fonts resolve, and
// a mark still in flight at that moment is simply absent from the card.
const MARK_URI = `data:image/png;base64,${readFileSync(
  join(ROOT, "public", "hoodfi-h.png")
).toString("base64")}`;

const PAPER = "#F1F1EA";
const INK = "#0B0E08";
const LIME = "#C6F702";

/**
 * Per-ground token sets — the same idea as `.on-ink` / `.on-lime` in globals.css, since
 * this file can't share the stylesheet.
 */
const GROUNDS = {
  lime: {
    bg: LIME,
    fg: INK,
    dim: "rgba(11,14,8,.72)",
    label: "rgba(11,14,8,.6)",
    line: "rgba(11,14,8,.28)",
    accent: INK,
    // The mark ships as one green glyph. On paper that green is the site's own header
    // treatment; on lime it disappears into the ground and on ink it goes muddy, so
    // those two flatten it to the ground's own foreground. `brightness(0)` keeps the
    // alpha and drops the colour, which is what recolouring a flat PNG means here.
    markFilter: "brightness(0)",
  },
  paper: {
    bg: PAPER,
    fg: INK,
    dim: "rgba(11,14,8,.66)",
    label: "rgba(11,14,8,.55)",
    line: "rgba(11,14,8,.2)",
    accent: "#4A5A18",
    markFilter: "none",
  },
  ink: {
    bg: INK,
    fg: PAPER,
    dim: "rgba(241,241,234,.68)",
    label: "rgba(241,241,234,.5)",
    line: "rgba(241,241,234,.2)",
    accent: LIME,
    markFilter: "brightness(0) invert(1)",
  },
};

/**
 * `title` is set in two explicit lines — no natural wrapping. A card is 1200px wide and
 * the type is 96px, so where the break lands is a design decision, not something to
 * discover at render time.
 */
const CARDS = [
  {
    file: "default.png",
    ground: "lime",
    eyebrow: "ens names · robinhood chain · id 4663",
    lines: ["Your name", "forever"],
    caps: true,
    sub: 'Mint a lifetime <span class="mono">*.hoodfi.eth</span> name in one transaction from $3 — no renewals, no expiry, no landlord.',
    stat: ["mint from", "$3"],
  },
  {
    file: "mint.png",
    ground: "ink",
    eyebrow: "01 / pick a name",
    lines: ["Choose your", "name."],
    sub: "Price is set by length and paid once. Nothing renews, nothing expires, and no one can take it back.",
    stat: ["4+ characters", "$3"],
  },
  {
    file: "manage.png",
    ground: "paper",
    eyebrow: "02 / what you get",
    lines: ["An identity, not", "a subscription."],
    sub: "Point your name anywhere. Address, avatar, X handle, website and bio — saved in a single signature.",
    stat: ["renewal fee", "$0"],
  },
  {
    file: "how-it-works.png",
    ground: "paper",
    eyebrow: "03 / the mechanism",
    lines: ["One transaction,", "then it's yours."],
    sub: "Search a name, mint it on Robinhood Chain, and point it wherever you like. Resolution reaches your wallet from there.",
    stat: ["transactions", "1"],
  },
  {
    file: "short-names.png",
    ground: "lime",
    eyebrow: "04 / premium inventory",
    lines: ["One, two or", "three characters."],
    sub: "The shortest names are held back. Donate a year to <span class=\"mono\">hoodfi.eth</span>'s ENS expiry, earn a credit, and mint one.",
    stat: ["with a credit", "free"],
  },
  {
    file: "mcp.png",
    ground: "ink",
    eyebrow: "07 / for agents",
    lines: ["An agent can", "mint its own."],
    sub: 'A remote MCP server that quotes a name and returns unsigned calldata. It holds no keys — the agent signs, the agent owns.',
    stat: ["keys held", "0"],
  },
  {
    file: "faq.png",
    ground: "paper",
    eyebrow: "06 / questions",
    lines: ["Answered", "plainly."],
    sub: "Minting, pricing, short-name credits, records, and how resolution actually reaches your wallet.",
    stat: ["renewals", "none"],
  },
  {
    file: "partner.png",
    ground: "lime",
    eyebrow: "08 / partners",
    lines: ["A name,", "not an address."],
    sub: "For wallets, exchanges, apps and agents on Robinhood Chain. Names your users can read back over the phone.",
    stat: ["reply from", "a person"],
  },
  {
    file: "legal.png",
    ground: "ink",
    eyebrow: "05 / transparency",
    lines: ["Verify", "everything."],
    sub: "Every contract is public and every mint is your own signature. Unaudited; independent of Robinhood Markets.",
    stat: ["chain id", "4663"],
  },
];

/** Fonts come from Google so the card matches the site's type, not a system face. */
function html(card) {
  const g = GROUNDS[card.ground];
  return `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;800&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; background: ${g.bg}; color: ${g.fg};
    font-family: Archivo, sans-serif; overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }
  .frame { height: 100%; padding: 56px 64px 48px; display: flex; flex-direction: column; }
  .top { display: flex; align-items: center; gap: 12px; }
  .mark { width: 30px; height: 30px; display: block; filter: ${g.markFilter}; }
  .wordmark {
    font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 19px;
    letter-spacing: .18em;
  }
  .eyebrow {
    font-family: 'IBM Plex Mono', monospace; font-size: 17px; letter-spacing: .2em;
    text-transform: uppercase; color: ${g.label}; margin-top: 54px;
  }
  h1 {
    margin-top: 22px; font-weight: 800; font-size: 96px; line-height: .92;
    letter-spacing: -.04em; ${card.caps ? "text-transform: uppercase; font-weight: 600;" : ""}
  }
  .sub { margin-top: 28px; max-width: 44ch; font-size: 25px; font-weight: 500; line-height: 1.45; color: ${g.dim}; }
  .foot {
    margin-top: auto; padding-top: 26px; border-top: 1px solid ${g.line};
    display: flex; align-items: flex-end; justify-content: space-between;
  }
  .cell { display: flex; flex-direction: column; gap: 9px; }
  .cell-label {
    font-family: 'IBM Plex Mono', monospace; font-size: 15px; letter-spacing: .18em;
    text-transform: uppercase; color: ${g.label};
  }
  .cell-value { font-size: 34px; font-weight: 800; letter-spacing: -.03em; line-height: 1; }
  .host {
    font-family: 'IBM Plex Mono', monospace; font-size: 19px; letter-spacing: .1em;
    color: ${g.label}; display: flex; align-items: center; gap: 10px;
  }
  .chip { width: 10px; height: 10px; background: ${g.accent}; display: block; }
  .mono { font-family: 'IBM Plex Mono', monospace; font-size: .88em; }
</style></head>
<body>
  <div class="frame">
    <div class="top">
      <img class="mark" src="${MARK_URI}" alt="">
      <span class="wordmark">HOODFI.NAME</span>
    </div>
    <div class="eyebrow">${card.eyebrow}</div>
    <h1>${card.lines[0]}<br>${card.lines[1]}</h1>
    <div class="sub">${card.sub}</div>
    <div class="foot">
      <div class="cell">
        <span class="cell-label">${card.stat[0]}</span>
        <span class="cell-value">${card.stat[1]}</span>
      </div>
      <div class="host"><span class="chip"></span>hoodfi.name</div>
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
