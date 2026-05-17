/**
 * scripts/sync-source-meta.ts — applies the canonical GitHub-side conventions
 * to source repos backing museum originals.
 *
 * For each converted slug in src/lib/sources.generated.json (or one passed
 * on the command line), this script ensures:
 *
 *   1. The legacy default branch (main/master/shepherd) is renamed to
 *      `original`. GitHub's rename API preserves history, PRs, and
 *      redirects. Already-renamed branches are skipped.
 *
 *   2. `museum-ready` is set as the GitHub default branch — visitors who
 *      open the repo land on the hosted version.
 *
 *   3. The repo's Website (homepage) field is set to the museum entry URL.
 *
 *   4. The repo's description is prefixed with "🏛️ unlv-museum:" so the
 *      museum membership is visible from any repo listing.
 *
 * The script is idempotent — re-running on a fully-converted repo is a no-op.
 *
 * Usage:
 *   pnpm sync:source-meta              # all converted slugs
 *   pnpm sync:source-meta <slug>       # one slug
 *
 * Requires: gh CLI authenticated as the org/user that owns each source repo.
 */

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const MUSEUM_BASE_URL = "https://unlv-museum.infinite-syndicate.com";
const LEGACY_DEFAULTS = new Set(["main", "master", "shepherd"]);
const TARGET_ORIGINAL = "original";
const TARGET_DEFAULT = "museum-ready";

interface SourceRef {
  repo: string;
  branch: string;
  commit: string;
  lockHash: string;
}

const sourcesPath = resolve(projectRoot, "src/lib/sources.generated.json");
const sources = JSON.parse(readFileSync(sourcesPath, "utf8")) as Record<
  string,
  SourceRef
>;

const slugArg = process.argv[2];
const slugs = slugArg ? [slugArg] : Object.keys(sources);

if (slugs.length === 0) {
  console.log(
    "[meta] no converted slugs found in sources.generated.json — nothing to do",
  );
  process.exit(0);
}

let exitCode = 0;
for (const slug of slugs) {
  const info = sources[slug];
  if (!info) {
    console.error(`[meta] ${slug}: no entry in sources.generated.json`);
    exitCode = 1;
    continue;
  }
  if (info.repo === "(museum-side patch-only)") {
    console.log(`[meta] ${slug}: patch-only (museum-side), skipping`);
    continue;
  }
  try {
    applyMeta(slug, info);
  } catch (err) {
    console.error(
      `[meta] ${slug}: failed — ${err instanceof Error ? err.message : err}`,
    );
    exitCode = 1;
  }
}

process.exit(exitCode);

// ─── implementation ──────────────────────────────────────────────────────

function applyMeta(slug: string, info: SourceRef) {
  const { repo } = info;
  const homepage = `${MUSEUM_BASE_URL}/${slug}`;
  console.log(`[meta] ${slug} (${repo})`);

  // 1. Inspect current state
  const meta = JSON.parse(
    gh([
      "api",
      `repos/${repo}`,
      "--jq",
      "{default_branch, homepage, description}",
    ]),
  ) as { default_branch: string; homepage: string | null; description: string | null };

  const branches = JSON.parse(
    gh(["api", `repos/${repo}/branches`, "--jq", "[.[].name]"]),
  ) as string[];

  // 2. Rename legacy default → "original" if applicable
  if (!branches.includes(TARGET_ORIGINAL)) {
    const legacy = branches.find((b) => LEGACY_DEFAULTS.has(b));
    if (legacy) {
      console.log(`[meta]   renaming branch ${legacy} → ${TARGET_ORIGINAL}`);
      gh([
        "api",
        `repos/${repo}/branches/${legacy}/rename`,
        "-X",
        "POST",
        "-f",
        `new_name=${TARGET_ORIGINAL}`,
      ]);
    } else {
      console.log(
        `[meta]   no legacy default branch found to rename; expected one of ${[...LEGACY_DEFAULTS].join(", ")}`,
      );
    }
  } else {
    console.log(`[meta]   ${TARGET_ORIGINAL} branch already exists`);
  }

  // 3. Set museum-ready as default branch. Re-query state in case the rename
  // above auto-updated the default (GitHub does that when you rename the
  // current default branch).
  const postRenameState = JSON.parse(
    gh([
      "api",
      `repos/${repo}`,
      "--jq",
      "{default_branch}",
    ]),
  ) as { default_branch: string };

  const branchesAfter = JSON.parse(
    gh(["api", `repos/${repo}/branches`, "--jq", "[.[].name]"]),
  ) as string[];

  if (!branchesAfter.includes(TARGET_DEFAULT)) {
    console.log(
      `[meta]   ${TARGET_DEFAULT} branch missing on remote — was the sync incomplete?`,
    );
  } else if (postRenameState.default_branch !== TARGET_DEFAULT) {
    console.log(
      `[meta]   setting default branch: ${postRenameState.default_branch} → ${TARGET_DEFAULT}`,
    );
    gh([
      "api",
      `repos/${repo}`,
      "-X",
      "PATCH",
      "-f",
      `default_branch=${TARGET_DEFAULT}`,
    ]);
  } else {
    console.log(`[meta]   default branch already ${TARGET_DEFAULT}`);
  }

  // 4. Set homepage + description prefix (idempotent)
  const patches: string[] = [];
  if (meta.homepage !== homepage) {
    patches.push("-f", `homepage=${homepage}`);
    console.log(`[meta]   setting homepage: ${homepage}`);
  } else {
    console.log(`[meta]   homepage already correct`);
  }

  const desiredPrefix = "🏛️ unlv-museum:";
  const currentDesc = meta.description ?? "";
  if (!currentDesc.startsWith(desiredPrefix)) {
    const newDesc = currentDesc
      ? `${desiredPrefix} ${currentDesc}`
      : `${desiredPrefix} ${slug}`;
    patches.push("-f", `description=${newDesc.slice(0, 350)}`);
    console.log(`[meta]   prefixing description: ${desiredPrefix}`);
  }

  if (patches.length > 0) {
    gh(["api", `repos/${repo}`, "-X", "PATCH", ...patches]);
  }
}

function gh(args: string[]): string {
  return execSync(`gh ${args.map((a) => JSON.stringify(a)).join(" ")}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}
