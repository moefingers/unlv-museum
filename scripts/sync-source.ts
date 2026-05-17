/**
 * scripts/sync-source.ts — runs the recipe for a project slug and writes the
 * result into public/originals/<slug>/, then updates sources.generated.json
 * with the new submodule SHA and content lockHash.
 *
 * Usage:
 *   pnpm sync:source <slug>
 *
 * Behavior:
 *   1. Reads the recipe for <slug> from sync.config.ts.
 *   2. Executes the recipe (install + build, or static copy, or patch).
 *   3. Runs any postPatch scripts on the destination directory.
 *   4. Computes the new lockHash of public/originals/<slug>/.
 *   5. Reads the submodule's HEAD SHA (for cra/vite/static recipes).
 *   6. Updates src/lib/sources.generated.json.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashDir } from "./lib/hash-dir.mts";
import { recipes, type Recipe } from "../sync.config.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const slug = process.argv[2];
if (!slug) {
  console.error("usage: pnpm sync:source <slug>");
  process.exit(1);
}

const recipe = recipes[slug];
if (!recipe) {
  console.error(
    `No recipe for "${slug}" in sync.config.ts. See CONTEXT/internal_docs/sources-conversions.md.`,
  );
  process.exit(1);
}

console.log(`[sync] ${slug} (type=${recipe.type})`);
const dest = resolve(projectRoot, recipe.to);

switch (recipe.type) {
  case "static-copy":
    syncStaticCopy(recipe);
    break;
  case "cra-build":
  case "vite-build":
    syncBuild(recipe);
    break;
  case "patch-only":
    // Nothing to copy — the patch script operates in-place on existing files.
    break;
}

// Run postPatch scripts (declared on every recipe type via the union).
const postPatch =
  "postPatch" in recipe
    ? recipe.postPatch
    : recipe.type === "patch-only"
      ? [recipe.patchScript]
      : undefined;
for (const script of postPatch ?? []) {
  console.log(`[sync] postPatch: ${script}`);
  execSync(`node ${JSON.stringify(resolve(projectRoot, script))}`, {
    stdio: "inherit",
    cwd: projectRoot,
  });
}

// Compute lockHash + read submodule commit, write to sources.generated.json.
const lockHash = hashDir(dest);
const commit = readSubmoduleCommit(recipe);
const branch =
  recipe.type === "patch-only" ? null : readSubmoduleBranch(recipe);
const repo = recipe.type === "patch-only" ? null : readSubmoduleRepo(recipe);

const sourcesPath = resolve(projectRoot, "src/lib/sources.generated.json");
const sources = JSON.parse(readFileSync(sourcesPath, "utf8")) as Record<
  string,
  { repo: string; branch: string; commit: string; lockHash: string }
>;

if (commit && repo && branch) {
  sources[slug] = { repo, branch, commit, lockHash };
} else {
  // patch-only: still record the lockHash for drift detection, with synthetic placeholders.
  sources[slug] = {
    repo: "(museum-side patch-only)",
    branch: "(museum-side patch-only)",
    commit: "(museum-side patch-only)",
    lockHash,
  };
}

writeFileSync(sourcesPath, JSON.stringify(sources, null, 2) + "\n");
console.log(`[sync] ${slug}: lockHash=${lockHash.slice(0, 24)}…`);
if (commit) console.log(`[sync] ${slug}: commit=${commit}`);
console.log(`[sync] ${slug}: done.`);

// ─── helpers ──────────────────────────────────────────────────────────────

type StaticCopy = Extract<Recipe, { type: "static-copy" }>;
type BuildRecipe = Extract<Recipe, { type: "cra-build" | "vite-build" }>;

function syncStaticCopy(recipe: StaticCopy) {
  const from = resolve(projectRoot, recipe.from);
  if (!existsSync(from)) {
    console.error(`[sync] source path missing: ${from}`);
    console.error(
      "Did you forget `git submodule update --init --recursive`?",
    );
    process.exit(1);
  }
  // Clear destination, then mirror.
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(from, dest, {
    recursive: true,
    filter: (src) => !src.includes(".git") && !src.includes("node_modules"),
  });
}

function syncBuild(recipe: BuildRecipe) {
  const cwd = resolve(projectRoot, recipe.cwd);
  if (!existsSync(cwd)) {
    console.error(`[sync] build cwd missing: ${cwd}`);
    process.exit(1);
  }
  const env = { ...process.env, ...recipe.buildEnv };
  console.log(`[sync] install in ${recipe.cwd}: ${recipe.install}`);
  execSync(recipe.install, { stdio: "inherit", cwd, env });
  console.log(`[sync] build in ${recipe.cwd}: ${recipe.build}`);
  execSync(recipe.build, { stdio: "inherit", cwd, env });

  const buildOut = resolve(cwd, recipe.buildOutput);
  if (!existsSync(buildOut)) {
    console.error(`[sync] build output missing: ${buildOut}`);
    process.exit(1);
  }
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(buildOut, dest, { recursive: true });
}

function readSubmoduleCommit(recipe: Recipe): string | null {
  if (recipe.type === "patch-only") return null;
  // Walk up from cwd (or from, for static-copy) until we find a directory
  // whose parent is `.sources/`. That's the submodule root.
  const start =
    recipe.type === "static-copy"
      ? resolve(projectRoot, recipe.from)
      : resolve(projectRoot, recipe.cwd);
  const submoduleRoot = findSubmoduleRoot(start);
  if (!submoduleRoot) return null;
  try {
    return execSync("git rev-parse HEAD", {
      cwd: submoduleRoot,
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

function readSubmoduleBranch(recipe: Recipe): string | null {
  if (recipe.type === "patch-only") return null;
  const start =
    recipe.type === "static-copy"
      ? resolve(projectRoot, recipe.from)
      : resolve(projectRoot, recipe.cwd);
  const submoduleRoot = findSubmoduleRoot(start);
  if (!submoduleRoot) return null;
  try {
    const headRef = execSync("git symbolic-ref --short HEAD", {
      cwd: submoduleRoot,
      encoding: "utf8",
    }).trim();
    return headRef || null;
  } catch {
    return null;
  }
}

function readSubmoduleRepo(recipe: Recipe): string | null {
  if (recipe.type === "patch-only") return null;
  const start =
    recipe.type === "static-copy"
      ? resolve(projectRoot, recipe.from)
      : resolve(projectRoot, recipe.cwd);
  const submoduleRoot = findSubmoduleRoot(start);
  if (!submoduleRoot) return null;
  try {
    const url = execSync("git remote get-url origin", {
      cwd: submoduleRoot,
      encoding: "utf8",
    }).trim();
    // Normalize git@github.com:owner/repo.git → owner/repo
    const m = url.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    return m?.[1] ?? url;
  } catch {
    return null;
  }
}

function findSubmoduleRoot(start: string): string | null {
  let current = start;
  while (current.length > projectRoot.length) {
    const parent = dirname(current);
    if (parent === join(projectRoot, ".sources")) {
      return current;
    }
    if (parent === current) break;
    current = parent;
  }
  return null;
}
