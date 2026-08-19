/**
 * Open Graph cards, shot from the real pages.
 *
 * Screenshots rather than a drawn card: the pages already are the design, and a
 * hand-composed card is a second thing to keep in sync that will drift the first time
 * the hero changes. Same approach the main site settled on.
 *
 * Shot at 1440x756 and downscaled to 1200x630. Capturing at 1200 wide rewraps the hero
 * into a different layout, and zooming to compensate does the same thing — so the
 * capture happens at a real desktop width and the resize happens afterwards.
 *
 * Run against a locally served `out/`:
 *   npx serve out -p 8899   (or python3 -m http.server 8899 --directory out)
 *   node scripts/make-og.mjs http://localhost:8899
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "/Users/hector/robot-id-intro-video/node_modules/playwright-core/index.mjs";

const base = process.argv[2] || "http://localhost:8899";
const out = new URL("../public/og/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const PAGES = [
  { path: "/", file: "default.png" },
  { path: "/build/", file: "build.png" },
  { path: "/partner/", file: "partner.png" },
];

const browser = await chromium.launch();
for (const page of PAGES) {
  const p = await browser.newPage({ viewport: { width: 1440, height: 756 }, deviceScaleFactor: 2 });
  await p.goto(base + page.path, { waitUntil: "networkidle" });
  // Let fonts settle: a card shot mid-swap ships a system face forever.
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(1200);
  const tmp = `${out}${page.file}.tmp.png`;
  await p.screenshot({ path: tmp, clip: { x: 0, y: 0, width: 1440, height: 756 } });
  // sips, because there is no sharp or ImageMagick on this machine.
  execFileSync("sips", ["-z", "630", "1200", tmp, "--out", `${out}${page.file}`], { stdio: "ignore" });
  execFileSync("rm", ["-f", tmp]);
  console.log(`${page.file}  <-  ${page.path}`);
  await p.close();
}
await browser.close();
