/** Screenshots the built site from the local server for visual verification. */
import { createRequire } from "node:module";
const require = createRequire("/Users/hector/robot-id-intro-video/node_modules/playwright/");
const { chromium } = require("/Users/hector/robot-id-intro-video/node_modules/playwright");

const BASE = process.env.BASE ?? "http://localhost:8765";
const OUT = process.env.SHOT_DIR ?? "/tmp/claude-501/-Users-hector/1488a819-4961-4236-aec2-b1e8e2bdb03a/scratchpad";

const browser = await chromium.launch();
const shots = [
  { path: "/", name: "home-desktop", w: 1440, h: 1200 },
  { path: "/", name: "home-mobile", w: 390, h: 1100 },
  { path: "/mint/", name: "mint-desktop", w: 1440, h: 1100 },
  { path: "/manage/", name: "manage-desktop", w: 1440, h: 900 },
];

for (const s of shots) {
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h } });
  await page.goto(BASE + s.path, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  // Horizontal overflow is the recurring mobile bug on this site — measure it.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  await page.screenshot({ path: `${OUT}/${s.name}.png`, fullPage: false });
  console.log(`${s.name}: overflow=${overflow}px`);
  await page.close();
}
await browser.close();
