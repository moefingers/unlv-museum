/**
 * scripts/patch-commerce-array.mjs
 *
 * postPatch script for the commerce-array Vite build. Runs after
 * `pnpm sync:source commerce-array` copies the built dist/ into
 * `public/originals/commerce-array/`. Two jobs:
 *
 *   1. Rewrite the five AWS API Gateway URLs in the built bundle. The
 *      storefront fetched its stores and products from
 *      `7rwcnp46mg.execute-api.us-west-2.amazonaws.com/staging/...`, which
 *      no longer resolves. The reads go to the local JSON stubs below; the
 *      admin Update / Delete calls go to `./mut/...`, a path nothing
 *      serves, so they get a 404 (which the museum's toast layer reports
 *      as "Endpoint not found") instead of waiting on a dead host.
 *
 *   2. Copy the three museum-authored JSON stubs (store.json,
 *      products-all.json, products-data.json: the repo's seeders as data,
 *      3 stores and 15 products) from scripts/data/commerce-array/ into the
 *      destination. syncBuild empties the destination before it copies
 *      dist/, so the stubs can't live there between syncs.
 *
 * Why the rewrites live here and not on museum-ready/original: the URLs
 * are the submitted source's own addresses, and a source edit would also
 * change Vite's content hash, so the bundle would no longer be the one
 * the museum serves. The same split as rest-rant's postPatch: source-level
 * hosting fixes (the HashRouter alias) on the branch, museum-host address
 * adaptations museum-side.
 *
 * The bundle is rewritten in place. Its name (index-<hash>.js) is the hash
 * Vite assigned before patching, and index.html already points at it, so
 * it must not be renamed. The name is found by pattern, since it only
 * stays stable while the source and lockfile do.
 *
 * Idempotent: re-running on an already-patched bundle is a no-op. Throws
 * if a URL appears other than exactly once, or if any API Gateway URL is
 * left afterwards.
 */

import {
  copyFileSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const destDir = resolve(projectRoot, "public/originals/commerce-array");
const assetsDir = resolve(destDir, "assets");
const stubDir = resolve(projectRoot, "scripts/data/commerce-array");

const API = "https://7rwcnp46mg.execute-api.us-west-2.amazonaws.com/staging/";
const replacements = [
  [`${API}store/`, "./store.json"],
  [`${API}products/all`, "./products-all.json"],
  [`${API}products/data`, "./products-data.json"],
  [`${API}products/update/`, "./mut/update/"],
  [`${API}products/delete/`, "./mut/delete/"],
];
const stubs = ["store.json", "products-all.json", "products-data.json"];

const bundles = readdirSync(assetsDir).filter((f) =>
  /^index-[\w-]+\.js$/.test(f),
);
if (bundles.length !== 1) {
  console.error(
    `[patch-commerce-array] expected one index-*.js in ${assetsDir}, found ${bundles.length}: ${bundles.join(", ")}`,
  );
  process.exit(1);
}
const bundle = bundles[0];
const bundlePath = resolve(assetsDir, bundle);
let content = readFileSync(bundlePath, "utf8");
const before = content;

let applied = 0;
for (const [from, to] of replacements) {
  const count = content.split(from).length - 1;
  if (count === 0 && content.includes(to)) continue; // already patched
  if (count !== 1) {
    console.error(
      `[patch-commerce-array] ${bundle}: expected 1 occurrence of ${from}, found ${count}`,
    );
    process.exit(1);
  }
  content = content.replace(from, to);
  applied++;
}
if (content.includes("https://7rwcnp46mg.execute-api")) {
  console.error(
    `[patch-commerce-array] ${bundle}: an API Gateway URL is still present after the rewrites`,
  );
  process.exit(1);
}

if (content === before) {
  console.log(
    `[patch-commerce-array] ${bundle}: no API Gateway URLs found — already patched`,
  );
} else {
  writeFileSync(bundlePath, content);
  console.log(
    `[patch-commerce-array] ${bundle}: ${applied} substitution(s) applied`,
  );
}

for (const stub of stubs) {
  copyFileSync(resolve(stubDir, stub), resolve(destDir, stub));
}
console.log(
  `[patch-commerce-array] copied ${stubs.length} JSON stubs from scripts/data/commerce-array/`,
);
