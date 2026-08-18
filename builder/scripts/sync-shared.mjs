/**
 * Copies the shared modules into this app before a build.
 *
 * Only used if the `shared/` symlink turns out not to survive Turbopack — see the note
 * in next.config.ts. The repo's existing answer to this problem is "the copy goes inside
 * the fussiest consumer, and dependency-free", which is why frontend/shared/ exists at
 * all rather than a top-level shared/. This script keeps that arrangement honest for a
 * second Next app: one authored file, mechanically copied, never hand-edited here.
 *
 * Runs as `prebuild`, so `npm run build` picks it up on Vercel with no extra config.
 * The Vercel project must have "Include source files outside of the Root Directory"
 * enabled, or ../frontend does not exist in the build container.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const source = resolve(root, "../frontend/shared");
const dest = join(root, "shared");

const FILES = ["contenthash.ts"];

const BANNER = `// GENERATED FILE — do not edit.
// Copied from frontend/shared/ by builder/scripts/sync-shared.mjs at build time.
// Edit the original; a change made here is silently overwritten on the next build.
`;

if (!existsSync(source)) {
  console.error(
    `sync-shared: ${source} not found.\n` +
      `On Vercel this means "Include source files outside of the Root Directory in the ` +
      `Build Step" is off — the container only has builder/, so the codec cannot be copied.`
  );
  process.exit(1);
}

mkdirSync(dest, { recursive: true });

for (const file of FILES) {
  const body = readFileSync(join(source, file), "utf8");
  writeFileSync(join(dest, file), BANNER + body);
  console.log(`sync-shared: ${file} (${body.length} bytes)`);
}
