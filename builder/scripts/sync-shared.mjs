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

// The copies are committed, so a build that cannot see ../frontend has everything it
// needs already. That matters because a Vercel project with a Root Directory may or may
// not be given the rest of the repo depending on a setting that has moved around the
// dashboard and is absent from some accounts — and "the deploy works only if a checkbox
// I cannot see is ticked" is not a property worth having.
//
// Regeneration is therefore a local convenience, not a build step that can fail. What
// keeps the copy honest is that it is TRACKED: edit frontend/shared and the next build
// here rewrites the copy, git reports a diff, and the change has to be committed
// deliberately. Drift becomes visible rather than possible.
if (!existsSync(source)) {
  const haveCopies = FILES.every((f) => existsSync(join(dest, f)));
  console.log(
    haveCopies
      ? `sync-shared: ${source} not reachable — using the committed copies.`
      : `sync-shared: ${source} not reachable and no committed copy exists.`
  );
  process.exit(haveCopies ? 0 : 1);
}

mkdirSync(dest, { recursive: true });

for (const file of FILES) {
  const body = readFileSync(join(source, file), "utf8");
  const next = BANNER + body;
  const path = join(dest, file);
  const changed = !existsSync(path) || readFileSync(path, "utf8") !== next;
  if (changed) writeFileSync(path, next);
  console.log(
    `sync-shared: ${file} (${body.length} bytes)${changed ? " — updated, commit it" : ""}`
  );
}
