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

/** GitHub username used to attribute commits as "ours" for date derivation. */
const OWNER_USERNAME = "moefingers";
/** Branch to mine for owner-authored commit dates. */
const ORIGINAL_BRANCH = "original";

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

// Where the recipe's content lives in public/originals/ — undefined for
// backend-only recipes that ship no public artifact.
const dest = "to" in recipe ? resolve(projectRoot, recipe.to) : undefined;

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
  case "backend-only":
    // Nothing to copy — the museum's Next.js port lives in src/app/(museum)/;
    // the submodule only contributes its branch/commit + lockHash for drift
    // detection and the meta script downstream.
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

// Compute lockHash. For artifact-producing recipes that's the destination
// directory; for backend-only it's the submodule root so drift in the
// source repo itself is detectable.
const submoduleRoot =
  recipe.type === "patch-only" ? null : findSubmoduleRootForRecipe(recipe);
const lockHashTarget =
  dest ?? (submoduleRoot ? submoduleRoot : null);
const lockHash = lockHashTarget ? hashDir(lockHashTarget) : "";
const commit = readSubmoduleCommit(recipe);
const branch =
  recipe.type === "patch-only" ? null : readSubmoduleBranch(recipe);
const repo = recipe.type === "patch-only" ? null : readSubmoduleRepo(recipe);
const ownerCommitRange = submoduleRoot
  ? readOwnerCommitRange(submoduleRoot)
  : null;
const forkedAt = repo ? readRepoCreatedAt(repo) : null;

const sourcesPath = resolve(projectRoot, "src/lib/sources.generated.json");
const sources = JSON.parse(readFileSync(sourcesPath, "utf8")) as Record<
  string,
  SourceRecord
>;

if (commit && repo && branch) {
  sources[slug] = {
    repo,
    branch,
    commit,
    lockHash,
    ownerFirstCommit: ownerCommitRange?.first ?? null,
    ownerLastCommit: ownerCommitRange?.last ?? null,
    forkedAt,
  };
} else {
  // patch-only: still record the lockHash for drift detection, with synthetic placeholders.
  sources[slug] = {
    repo: "(museum-side patch-only)",
    branch: "(museum-side patch-only)",
    commit: "(museum-side patch-only)",
    lockHash,
    ownerFirstCommit: null,
    ownerLastCommit: null,
    forkedAt: null,
  };
}

writeFileSync(sourcesPath, JSON.stringify(sources, null, 2) + "\n");
console.log(`[sync] ${slug}: lockHash=${lockHash.slice(0, 24)}…`);
if (commit) console.log(`[sync] ${slug}: commit=${commit}`);
console.log(`[sync] ${slug}: done.`);

// ─── helpers ──────────────────────────────────────────────────────────────

interface SourceRecord {
  repo: string;
  branch: string;
  commit: string;
  lockHash: string;
  /** ISO date (YYYY-MM-DD) of owner's first commit on `original`, or null. */
  ownerFirstCommit: string | null;
  /** ISO date (YYYY-MM-DD) of owner's last commit on `original`, or null. */
  ownerLastCommit: string | null;
  /** ISO date the GitHub repo was created (fork date for forks), or null. */
  forkedAt: string | null;
}

type StaticCopy = Extract<Recipe, { type: "static-copy" }>;
type BuildRecipe = Extract<Recipe, { type: "cra-build" | "vite-build" }>;

/**
 * Path inside (or pointing at) the submodule from which to derive its
 * root, branch, commit, and remote. Each recipe type carries this in a
 * different field — centralized here so submodule-reading helpers don't
 * each duplicate the per-recipe selection.
 *
 * Returns null for recipe types without a submodule (patch-only).
 */
function submoduleStartPath(recipe: Recipe): string | null {
  switch (recipe.type) {
    case "static-copy":
    case "backend-only":
      return resolve(projectRoot, recipe.from);
    case "cra-build":
    case "vite-build":
      return resolve(projectRoot, recipe.cwd);
    case "patch-only":
      return null;
  }
}

function findSubmoduleRootForRecipe(recipe: Recipe): string | null {
  const start = submoduleStartPath(recipe);
  return start ? findSubmoduleRoot(start) : null;
}

/**
 * First and last commit dates (YYYY-MM-DD) authored by OWNER_USERNAME on
 * the local `original` branch. Returns null when the owner has no commits
 * on `original` — typical for forks of starter-code where the owner did
 * the actual coursework off-git or only touched museum-ready/original.
 */
function readOwnerCommitRange(
  submoduleRoot: string,
): { first: string; last: string } | null {
  try {
    // Try local `original`, fall back to `origin/original` for fresh clones.
    const refCandidates = [ORIGINAL_BRANCH, `origin/${ORIGINAL_BRANCH}`];
    let dates: string[] = [];
    for (const ref of refCandidates) {
      try {
        const out = execSync(
          `git log --author=${OWNER_USERNAME} --pretty=%ad --date=short ${ref}`,
          { cwd: submoduleRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
        ).trim();
        if (out) {
          dates = out.split("\n").filter(Boolean);
          break;
        }
      } catch {
        // ref doesn't exist locally; try next
      }
    }
    if (dates.length === 0) return null;
    // git log emits newest-first; last entry is the first commit chronologically.
    const last = dates[0]!;
    const first = dates[dates.length - 1]!;
    return { first, last };
  } catch {
    return null;
  }
}

/**
 * Repo `created_at` from GitHub — the fork date for forks. Falls back to
 * null if `gh` isn't available or the API call fails. ISO YYYY-MM-DD.
 */
function readRepoCreatedAt(repo: string): string | null {
  try {
    const out = execSync(`gh api repos/${repo} --jq .created_at`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (!out) return null;
    return out.slice(0, 10); // YYYY-MM-DD
  } catch {
    return null;
  }
}

function syncStaticCopy(recipe: StaticCopy) {
  const from = resolve(projectRoot, recipe.from);
  if (!existsSync(from)) {
    console.error(`[sync] source path missing: ${from}`);
    console.error(
      "Did you forget `git submodule update --init --recursive`?",
    );
    process.exit(1);
  }
  if (!dest) {
    // Type-narrow: static-copy always has `to`. Unreachable.
    throw new Error("static-copy recipe missing `to`");
  }
  // Clear destination, then mirror.
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });

  if (recipe.include && recipe.include.length > 0) {
    // Explicit allowlist — copy only the named files / directories. Use
    // when the source repo doesn't isolate frontend assets in their own
    // subdir (e.g. sql-injection-demo has app.js/package.json at root
    // alongside index.html/style.css).
    for (const rel of recipe.include) {
      const src = resolve(from, rel);
      const target = resolve(dest, rel);
      if (!existsSync(src)) {
        console.error(`[sync] include entry missing in source: ${rel}`);
        process.exit(1);
      }
      mkdirSync(dirname(target), { recursive: true });
      cpSync(src, target, { recursive: true });
    }
    return;
  }

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
  const submoduleRoot = findSubmoduleRootForRecipe(recipe);
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
  const submoduleRoot = findSubmoduleRootForRecipe(recipe);
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
  const submoduleRoot = findSubmoduleRootForRecipe(recipe);
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
