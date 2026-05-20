/**
 * scripts/verify-locks.ts — pre-commit drift check.
 *
 * For every slug recorded in src/lib/sources.generated.json, re-hash
 * public/originals/<slug>/ and compare to the stored lockHash. If they differ,
 * the developer hand-edited public/originals/<slug>/ without running
 * `pnpm sync:source <slug>` — almost always a mistake.
 *
 * Slugs that aren't yet converted (not present in sources.generated.json) are
 * skipped. This keeps the pre-commit hook fast and offline.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashDir } from "./lib/hash-dir.mts";
import { recipes } from "../sync.config.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const sourcesPath = resolve(projectRoot, "src/lib/sources.generated.json");
const sources = JSON.parse(readFileSync(sourcesPath, "utf8")) as Record<
  string,
  { repo: string; branch: string; commit: string; lockHash: string }
>;

const failures: string[] = [];

for (const [slug, info] of Object.entries(sources)) {
  const recipe = recipes[slug];
  if (!recipe) {
    failures.push(
      `${slug}: lockHash recorded in sources.generated.json but no recipe in sync.config.ts`,
    );
    continue;
  }

  // Pick the directory whose hash backs this slug's lockHash. Artifact-
  // producing recipes (static-copy / cra-build / vite-build / patch-only)
  // hash public/originals/<slug>/. Backend-only recipes have no public
  // artifact — sync-source.ts hashes the submodule root instead, so
  // verify-locks must mirror that to compare apples to apples.
  const target =
    recipe.type === "backend-only"
      ? resolve(projectRoot, recipe.from)
      : resolve(projectRoot, recipe.to);
  if (!existsSync(target)) {
    failures.push(
      `${slug}: ${target} is missing — did the submodule init? (\`git submodule update --init --recursive\`)`,
    );
    continue;
  }
  const actual = hashDir(target);
  if (actual !== info.lockHash) {
    failures.push(
      `${slug}: lockHash mismatch.\n  expected: ${info.lockHash}\n  actual:   ${actual}\n  Run: pnpm sync:source ${slug}`,
    );
  }
}

if (failures.length > 0) {
  console.error("[verify-locks] drift detected:");
  for (const msg of failures) console.error("  - " + msg);
  console.error(
    "\nIf you intentionally hand-edited public/originals/<slug>/, run:\n" +
      "  pnpm sync:source <slug>\n" +
      "to rebuild from source and refresh the lockHash. See CONTEXT/internal_docs/sources.md.",
  );
  process.exit(1);
}

console.log(
  `[verify-locks] ok — ${Object.keys(sources).length} slug(s) verified`,
);
