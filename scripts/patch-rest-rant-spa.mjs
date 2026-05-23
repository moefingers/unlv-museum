/**
 * scripts/patch-rest-rant-spa.mjs
 *
 * postPatch script for the rest-rant CRA build. Runs after
 * `pnpm sync:source rest-rant` copies the built artifact into
 * `public/originals/rest-rant/`. Rewrites localhost:5000 references
 * in the minified main bundle so the SPA talks to the museum's
 * Next.js `/api/rest-rant/*` route handlers instead of the dead
 * Express dev server it was originally pointed at.
 *
 * Source-level fixes (HashRouter, %PUBLIC_URL%, <Link to=>) live on
 * `museum-ready/original` and apply at the JSX layer. These bundle-
 * level rewrites can't live in source because the addresses get
 * inlined into the minified webpack chunk at build time — patching
 * them post-build keeps the source repo's URL strings honest
 * (visitors auditing the diff see them as `localhost:5000` exactly
 * as the original developer wrote them) while still letting the
 * museum's hosted copy function.
 *
 * IMPORTANT: do NOT touch the place-card link, which uses `t.push`
 * inside a forEach callback's scope. The minifier reuses `t` for
 * different bindings across the bundle, and the only `t.push("/places")`
 * usage is the place card's onClick — replacing it would break
 * navigation FROM the places list TO a specific place.
 *
 * Idempotent: re-running on an already-patched bundle is a no-op.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const artifactDir = resolve(
  projectRoot,
  "public/originals/rest-rant/static/js",
);

// CRA emits the app's code into `main.<hash>.chunk.js`. Hash changes
// with content, so don't pin a literal — find the current chunk by
// pattern. The bundle is the one we care about; vendor chunks (e.g.
// `2.<hash>.chunk.js`) carry React + its dependencies and never
// reference localhost:5000.
const mainChunk = readdirSync(artifactDir).find(
  (f) => f.startsWith("main.") && f.endsWith(".chunk.js"),
);
if (!mainChunk) {
  console.error(
    `[patch-rest-rant-spa] no main.*.chunk.js in ${artifactDir}`,
  );
  process.exit(1);
}
const mainPath = resolve(artifactDir, mainChunk);
let content = readFileSync(mainPath, "utf8");
const before = content;

// Order matters: process the longest suffix first so the path-prefix
// replacement doesn't consume the trailing-slash variant. e.g.
// `localhost:5000/places/` must replace before `localhost:5000/places`
// or the second pattern would eat the first as a substring.
const replacements = [
  ["http://localhost:5000/places/", "/api/rest-rant/places/"],
  ["http://localhost:5000/places", "/api/rest-rant/places"],
  ["http://localhost:5000/users/", "/api/rest-rant/users/"],
  ["http://localhost:5000/users", "/api/rest-rant/users"],
  [
    "http://localhost:5000/authentication/",
    "/api/rest-rant/authentication/",
  ],
  // The original committed a kittykat.jpeg placeholder under
  // backend/public/images/. That file isn't relocated to
  // frontend/public/images/ (museum-ready policy: relocate only the
  // real-content images), so its reference is rewritten to a
  // placebear placeholder. See the asset-relocation commit's
  // explanation on the source branch.
  [
    "http://localhost:5000/images/kittykat.jpeg",
    "https://placebear.com/g/400/400",
  ],
];

let totalReplaced = 0;
for (const [from, to] of replacements) {
  while (content.includes(from)) {
    content = content.replace(from, to);
    totalReplaced++;
  }
}

if (content === before) {
  console.log(
    `[patch-rest-rant-spa] ${mainChunk}: no localhost:5000 references found — already patched`,
  );
} else {
  writeFileSync(mainPath, content);
  console.log(
    `[patch-rest-rant-spa] ${mainChunk}: ${totalReplaced} substitution(s) applied`,
  );
}
