/** Screenshots the built site from the local server for visual verification. */
import { createRequire } from "node:module";
const require = createRequire("/Users/hector/robot-id-intro-video/node_modules/playwright/");
const { chromium } = require("/Users/hector/robot-id-intro-video/node_modules/playwright");

const BASE = process.env.BASE ?? "http://localhost:8765";
const OUT = process.env.SHOT_DIR ?? "/tmp";

const ROUTES = [
  "/",
  "/mint/",
  "/search/",
  "/manage/",
  "/short-names/",
  "/how-it-works/",
  "/faq/",
  "/terms/",
  "/claim/",
];

const browser = await chromium.launch();

for (const route of ROUTES) {
  const name = route === "/" ? "home" : route.replaceAll("/", "");
  for (const [suffix, width, height, full] of [
    ["desktop", 1440, 1000, true],
    ["mobile", 390, 844, false],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    // Horizontal overflow is the recurring mobile bug on this site — measure it.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    await page.screenshot({ path: `${OUT}/${name}-${suffix}.png`, fullPage: full });
    console.log(
      `${name}-${suffix}: overflow=${overflow}px${errors.length ? ` errors=${errors.join(" | ")}` : ""}`
    );
    await page.close();
  }
}
await browser.close();
