/**
 * scripts/sync-source-meta.ts — applies the canonical GitHub-side conventions
 * to source repos backing museum originals.
 *
 * For each converted slug in src/lib/sources.generated.json (or one passed
 * on the command line), this script ensures:
 *
 *   1. Legacy default branch (main/master/shepherd) renamed to `original`.
 *      GitHub's rename API preserves history, PRs, and creates redirects.
 *
 *   2. `museum-ready` is set as the GitHub default branch.
 *
 *   3. Repo Website (homepage) field points to the museum entry URL.
 *
 *   4. Repo description is prefixed with "🏛️ unlv-museum:".
 *
 *   5. Repo topics include `unlv-museum` and `museum-ready`.
 *
 *   6. README on museum-ready has the unlv-museum banner (idempotent via
 *      marker comments). If the banner needs to be added/updated, the
 *      script commits and pushes to museum-ready, bumps the submodule
 *      pointer, and re-runs `pnpm sync:source <slug>` to refresh the
 *      lockHash so the museum stays consistent.
 *
 * Idempotent — re-running on a fully-converted repo is a no-op.
 *
 * Usage:
 *   pnpm sync:source-meta              # all converted slugs
 *   pnpm sync:source-meta <slug>       # one slug
 *   pnpm sync:source-meta --force-bust # rewrite the bustHash on every README
 *                                      # even when source content hasn't moved
 *                                      # (use after banner renderer changes)
 *
 * Requires: gh CLI authenticated as the owner of each source repo.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PROJECTS,
  formatProjectDate,
  getSourceRef,
  projectPath,
} from "../src/lib/projects";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const MUSEUM_BASE_URL = "https://unlv-museum.infinite-syndicate.com";
const LEGACY_DEFAULTS = new Set(["main", "master", "shepherd"]);
const TARGET_ORIGINAL = "original";
const TARGET_DEFAULT = "museum-ready/original";
/** Legacy museum-ready branch name to migrate to TARGET_DEFAULT. */
const LEGACY_MUSEUM_READY = "museum-ready";
const REPO_TOPICS = ["unlv-museum", "museum-ready"];
/** GitHub's hard limit on repo description length. */
const GITHUB_DESCRIPTION_LIMIT = 350;

const BANNER_START = "<!-- unlv-museum-banner-start -->";
const BANNER_END = "<!-- unlv-museum-banner-end -->";

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

const args = process.argv.slice(2);
const forceBust = args.includes("--force-bust");
const slugArg = args.find((a) => !a.startsWith("--"));
const slugs = slugArg ? [slugArg] : Object.keys(sources);
// When --force-bust is set, mix a per-run nonce into every bustHash so the
// resulting README URLs differ from whatever camo has cached. The same nonce
// is reused for the whole run so all updated slugs share a coherent run id.
const forceBustNonce = forceBust ? new Date().toISOString() : null;

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
  // Resolve museum URL via projectPath() so containerized leaves get
  // their full path (e.g. /js-exercises/admin-portal) rather than the
  // bare `/admin-portal` form. Flat (uncontained) slugs still produce
  // `/<slug>`. Falls back to the bare slug if the project isn't found
  // in PROJECTS — shouldn't happen at runtime but the fallback keeps
  // the script working against stale data.
  const project = PROJECTS.find((p) => p.slug === slug);
  const path = project ? projectPath(project) : slug;
  const homepage = `${MUSEUM_BASE_URL}/${path}`;
  console.log(`[meta] ${slug} (${repo})`);

  applyBranchRename(slug, repo);
  applyMuseumReadyMigration(slug, repo);
  applyDefaultBranch(slug, repo);
  applyHomepageAndDescription(slug, repo, homepage);
  applyTopics(slug, repo);
  applyReadmeBanner(slug, repo, homepage);
}

/**
 * One-time migration: move `museum-ready` → `museum-ready/original`.
 *
 * GitHub's git ref namespace prevents `museum-ready` and `museum-ready/X`
 * from coexisting — a path can be a leaf ref OR a directory of refs, not
 * both. And the branch rename API rejects `/` in new_name. So we shuffle
 * through a temp branch:
 *
 *   1. Create _unlv-museum-migrating at museum-ready's SHA
 *   2. Set it as default (so we're allowed to delete museum-ready)
 *   3. Delete museum-ready
 *   4. Create museum-ready/original at the same SHA
 *   5. Set museum-ready/original as default
 *   6. Delete _unlv-museum-migrating
 *
 * Ugly but isolated. Subsequent runs see `museum-ready/original` exists
 * and skip entirely.
 */
function applyMuseumReadyMigration(_slug: string, repo: string) {
  const branches = JSON.parse(
    gh(["api", `repos/${repo}/branches`, "--jq", "[.[].name]"]),
  ) as string[];

  if (branches.includes(TARGET_DEFAULT)) {
    console.log(`[meta]   ${TARGET_DEFAULT} branch already exists`);
    return;
  }
  if (!branches.includes(LEGACY_MUSEUM_READY)) {
    // Neither old nor new branch exists — initial conversion hasn't run yet.
    return;
  }

  console.log(
    `[meta]   migrating ${LEGACY_MUSEUM_READY} → ${TARGET_DEFAULT} (via temp branch)`,
  );

  const TEMP = "_unlv-museum-migrating";
  const legacySha = gh([
    "api",
    `repos/${repo}/branches/${LEGACY_MUSEUM_READY}`,
    "--jq",
    ".commit.sha",
  ]);

  // 1. Create temp branch at legacy SHA
  gh([
    "api",
    `repos/${repo}/git/refs`,
    "-X",
    "POST",
    "-f",
    `ref=refs/heads/${TEMP}`,
    "-f",
    `sha=${legacySha}`,
  ]);

  // 2. Set temp as default
  gh([
    "api",
    `repos/${repo}`,
    "-X",
    "PATCH",
    "-f",
    `default_branch=${TEMP}`,
  ]);

  // 3. Delete museum-ready
  gh([
    "api",
    `repos/${repo}/git/refs/heads/${LEGACY_MUSEUM_READY}`,
    "-X",
    "DELETE",
  ]);

  // 4. Create museum-ready/original at the same SHA
  gh([
    "api",
    `repos/${repo}/git/refs`,
    "-X",
    "POST",
    "-f",
    `ref=refs/heads/${TARGET_DEFAULT}`,
    "-f",
    `sha=${legacySha}`,
  ]);

  // 5. Set museum-ready/original as default
  gh([
    "api",
    `repos/${repo}`,
    "-X",
    "PATCH",
    "-f",
    `default_branch=${TARGET_DEFAULT}`,
  ]);

  // 6. Delete temp branch
  gh([
    "api",
    `repos/${repo}/git/refs/heads/${TEMP}`,
    "-X",
    "DELETE",
  ]);
}

function applyBranchRename(_slug: string, repo: string) {
  const branches = JSON.parse(
    gh(["api", `repos/${repo}/branches`, "--jq", "[.[].name]"]),
  ) as string[];

  if (branches.includes(TARGET_ORIGINAL)) {
    console.log(`[meta]   ${TARGET_ORIGINAL} branch already exists`);
    return;
  }
  const legacy = branches.find((b) => LEGACY_DEFAULTS.has(b));
  if (!legacy) {
    console.log(
      `[meta]   no legacy default branch to rename; expected one of ${[
        ...LEGACY_DEFAULTS,
      ].join(", ")}`,
    );
    return;
  }
  console.log(`[meta]   renaming branch ${legacy} → ${TARGET_ORIGINAL}`);
  gh([
    "api",
    `repos/${repo}/branches/${legacy}/rename`,
    "-X",
    "POST",
    "-f",
    `new_name=${TARGET_ORIGINAL}`,
  ]);
}

function applyDefaultBranch(_slug: string, repo: string) {
  const meta = JSON.parse(
    gh(["api", `repos/${repo}`, "--jq", "{default_branch}"]),
  ) as { default_branch: string };
  const branches = JSON.parse(
    gh(["api", `repos/${repo}/branches`, "--jq", "[.[].name]"]),
  ) as string[];
  if (!branches.includes(TARGET_DEFAULT)) {
    console.log(
      `[meta]   ${TARGET_DEFAULT} branch missing on remote — sync incomplete?`,
    );
    return;
  }
  if (meta.default_branch === TARGET_DEFAULT) {
    console.log(`[meta]   default branch already ${TARGET_DEFAULT}`);
    return;
  }
  console.log(
    `[meta]   setting default branch: ${meta.default_branch} → ${TARGET_DEFAULT}`,
  );
  gh([
    "api",
    `repos/${repo}`,
    "-X",
    "PATCH",
    "-f",
    `default_branch=${TARGET_DEFAULT}`,
  ]);
}

function applyHomepageAndDescription(
  slug: string,
  repo: string,
  homepage: string,
) {
  const meta = JSON.parse(
    gh(["api", `repos/${repo}`, "--jq", "{homepage, description}"]),
  ) as { homepage: string | null; description: string | null };

  const patches: string[] = [];
  if (meta.homepage !== homepage) {
    patches.push("-f", `homepage=${homepage}`);
    console.log(`[meta]   setting homepage: ${homepage}`);
  } else {
    console.log(`[meta]   homepage already correct`);
  }

  const desired = buildDescription(slug);
  if (desired === null) {
    console.log(
      `[meta]   no synopsis defined for ${slug} in projects.tsx — leaving description unchanged`,
    );
  } else if (desired.length > GITHUB_DESCRIPTION_LIMIT) {
    throw new Error(
      `description for ${slug} is ${desired.length} chars, exceeds GitHub's ${GITHUB_DESCRIPTION_LIMIT}-char limit — shorten the synopsis in projects.tsx`,
    );
  } else if (meta.description !== desired) {
    patches.push("-f", `description=${desired}`);
    console.log(`[meta]   setting description: ${desired}`);
  } else {
    console.log(`[meta]   description already current`);
  }

  if (patches.length > 0) {
    gh(["api", `repos/${repo}`, "-X", "PATCH", ...patches]);
  }
}

/**
 * Compose the GitHub repo description from project metadata.
 * Shape: "Now hosted in my UNLV Museum - ${synopsis} (UNLV Assignment, ${date})"
 * Date cascade: owner commit range on `original` → fork creation date →
 * manual Project.year override. Returns null when synopsis is missing.
 */
function buildDescription(slug: string): string | null {
  const project = PROJECTS.find((p) => p.slug === slug);
  if (!project?.synopsis) return null;
  const ref = getSourceRef(slug);
  const date = (ref && formatProjectDate(ref)) ?? project.year;
  return `Now hosted in my UNLV Museum - ${project.synopsis} (UNLV Assignment, ${date})`;
}

function applyTopics(_slug: string, repo: string) {
  const current = JSON.parse(
    gh(["api", `repos/${repo}/topics`, "--jq", ".names"]),
  ) as string[];

  const missing = REPO_TOPICS.filter((t) => !current.includes(t));
  if (missing.length === 0) {
    console.log(`[meta]   topics already include ${REPO_TOPICS.join(", ")}`);
    return;
  }

  const next = [...new Set([...current, ...REPO_TOPICS])];
  console.log(`[meta]   adding topics: ${missing.join(", ")}`);
  // PUT /repos/{repo}/topics with {"names": [...]} replaces the whole list.
  // The mediatype header isn't required on modern gh, but pass it to be safe.
  const namesJson = JSON.stringify({ names: next });
  execSync(
    `gh api repos/${repo}/topics -X PUT --input -`,
    { input: namesJson, stdio: ["pipe", "ignore", "inherit"] },
  );
}

function applyReadmeBanner(slug: string, repo: string, homepage: string) {
  // Submodule path follows convention: .sources/<lastPathSegment>
  const submoduleDir = repo.split("/")[1];
  if (!submoduleDir) {
    console.log(`[meta]   skip banner: could not derive submodule dir`);
    return;
  }
  const submoduleRoot = resolve(projectRoot, ".sources", submoduleDir);
  if (!existsSync(submoduleRoot)) {
    console.log(
      `[meta]   skip banner: ${submoduleRoot} not present locally (submodule not initialized?)`,
    );
    return;
  }

  // Ensure submodule is on TARGET_DEFAULT (museum-ready/original).
  // git fetch --prune removes locally-tracking refs for branches that were
  // renamed upstream, so the rename-museum-ready-to-museum-ready/original
  // migration becomes visible without manual cleanup.
  try {
    execSync(`git fetch --prune origin "${TARGET_DEFAULT}"`, {
      cwd: submoduleRoot,
      stdio: ["ignore", "ignore", "inherit"],
    });
    execSync(`git checkout "${TARGET_DEFAULT}"`, {
      cwd: submoduleRoot,
      stdio: ["ignore", "ignore", "inherit"],
    });
    execSync(`git pull origin "${TARGET_DEFAULT}"`, {
      cwd: submoduleRoot,
      stdio: ["ignore", "ignore", "inherit"],
    });
  } catch (err) {
    console.log(
      `[meta]   could not sync submodule to ${TARGET_DEFAULT}: ${err instanceof Error ? err.message : err}`,
    );
    return;
  }

  // Build desired banner: animated SVG banner served from the museum's
  // /github-banners/<slug> endpoint, wrapped in an anchor that opens the
  // museum entry, followed by a compact audit-context subtext.
  //
  // The banner image URL is the museum-hosted SVG endpoint (not a static
  // file). camo on GitHub will cache the rendered output; we can bust the
  // cache via lockHash if needed by adding ?v=<hash>.
  const ownerRepo = repo;
  const branchPath = TARGET_DEFAULT; // "museum-ready/original"
  // GitHub branch URLs accept `/` directly in tree/ paths but not in compare/
  // refs — the compare path is parsed by segment, so we encode the slash there.
  const compareEncoded = `${TARGET_ORIGINAL}...${encodeURIComponent(TARGET_DEFAULT)}`;
  const project = PROJECTS.find((p) => p.slug === slug);
  const altText = (project?.synopsis ?? project?.title ?? slug).replace(
    /"/g,
    "&quot;",
  );
  // Two theme-pinned SVG URLs because camo doesn't propagate the host page's
  // color scheme to <img>-loaded SVGs reliably. <picture>'s source media
  // selectors DO respect the github.com page's prefers-color-scheme, so the
  // browser picks the right variant before fetching.
  //
  // Cache-bust suffix `?v=<hash>` busts camo whenever the banner-relevant
  // project metadata (what the SVG endpoint actually renders) changes.
  //
  // IMPORTANT: do NOT mix `lockHash` into this hash. The lockHash represents
  // the source-content hash and changes on every `pnpm sync:source` run,
  // even when the SVG output would be byte-identical. Including it created
  // a feedback loop where each sync triggered a meta-sync banner update,
  // each banner update bumped the submodule pointer, each bump triggered
  // another sync — leaving museum-ready/original cluttered with duplicate
  // "unlv-museum-banner-start" commits per repo (see commit history of
  // JS-Events-Demonstration / JS-Building-a-Shared-Counter-Part-1 before
  // their post-cleanup squash).
  //
  // Live runtime data the banner shows (fork status, language stats,
  // commit counts) is fetched at SVG-render time by /github-banners/<slug>
  // from the GitHub API — it doesn't need cache-busting via this hash.
  const bustHash = createHash("sha256")
    .update(
      JSON.stringify({
        title: project?.title ?? "",
        synopsis: project?.synopsis ?? "",
        year: project?.year ?? "",
        plannedTiers: project?.plannedTiers ?? null,
        techOriginal: project?.techOriginal ?? null,
        forceBust: forceBustNonce,
      }),
    )
    .digest("hex")
    .slice(0, 10);
  const bannerBase = `${MUSEUM_BASE_URL}/github-banners/${slug}`;

  // Which non-original tiers are live for this project? Mirrors the
  // recognition rule in src/app/github-banners/[slug]/route.ts:tiersFor —
  // keep these in sync. The banner README ought to advertise cross-nav to
  // the museum whenever the project has more to offer than the original.
  const isComingSoon = (node: unknown): boolean => {
    if (!node || typeof node !== "object") return false;
    const el = node as { props?: { label?: unknown } };
    return el.props?.label === "Coming soon";
  };
  const liveEnhanced = project
    ? project.enhanced != null
      ? !isComingSoon(project.enhanced)
      : project.enhancedExternal != null
    : false;
  const liveReimagined = project
    ? project.reimagined != null
      ? !isComingSoon(project.reimagined)
      : project.reimaginedExternal != null
    : false;
  const liveExtras: string[] = [];
  if (liveEnhanced) liveExtras.push("**enhanced**");
  if (liveReimagined) liveExtras.push("**reimagined**");
  const extrasPhrase =
    liveExtras.length === 0
      ? null
      : liveExtras.length === 1
        ? liveExtras[0]
        : `${liveExtras[0]} and ${liveExtras[1]}`;
  // Rewrites the trailing call-to-action to celebrate the non-original
  // tiers when they're live. GitHub renders bold inside link text, so
  // the tier names land emphasized in the README. When only the original
  // exists, falls back to the bare "Open in museum →" link.
  const museumCta = extrasPhrase
    ? `[This project has been ${extrasPhrase}! →](${homepage})`
    : `[Open in museum →](${homepage})`;

  const banner = `${BANNER_START}
<a href="${homepage}" target="_blank" rel="noopener">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="${bannerBase}?theme=dark&v=${bustHash}">
    <img src="${bannerBase}?theme=light&v=${bustHash}" alt="${altText}" width="100%">
  </picture>
</a>

> This \`${branchPath}\` branch is the host-compatible build of the [\`original\` branch](https://github.com/${ownerRepo}/tree/original) — [audit the diff](https://github.com/${ownerRepo}/compare/${compareEncoded}): hosting fixes only (dead URLs, Node LTS floor, pnpm), behavior byte-for-byte. ${museumCta}
${BANNER_END}`;

  const readmePath = resolve(submoduleRoot, "README.md");
  const currentReadme = existsSync(readmePath)
    ? readFileSync(readmePath, "utf8")
    : "";

  let newReadme: string;
  if (currentReadme.includes(BANNER_START) && currentReadme.includes(BANNER_END)) {
    // Replace existing banner block
    const start = currentReadme.indexOf(BANNER_START);
    const end = currentReadme.indexOf(BANNER_END) + BANNER_END.length;
    const before = currentReadme.slice(0, start);
    const after = currentReadme.slice(end);
    newReadme = before + banner + after;
  } else {
    // Prepend banner + blank line + existing content (or create README)
    newReadme = currentReadme
      ? `${banner}\n\n${currentReadme.trimStart()}`
      : `${banner}\n\n# ${slug}\n`;
  }

  if (newReadme === currentReadme) {
    console.log(`[meta]   README banner already current`);
    return;
  }

  writeFileSync(readmePath, newReadme);
  console.log(`[meta]   README banner updated; committing to museum-ready`);

  execSync("git add README.md", {
    cwd: submoduleRoot,
    stdio: ["ignore", "inherit", "inherit"],
  });
  execSync(
    `git commit -m "${BANNER_START.replace(/<!--|-->/g, "").trim()}: unlv-museum banner"`,
    { cwd: submoduleRoot, stdio: ["ignore", "inherit", "inherit"] },
  );
  execSync(`git push origin "${TARGET_DEFAULT}"`, {
    cwd: submoduleRoot,
    stdio: ["ignore", "inherit", "inherit"],
  });

  // The submodule pointer in the museum is now stale — bump it.
  execSync(`git add .sources/${submoduleDir}`, {
    cwd: projectRoot,
    stdio: ["ignore", "inherit", "inherit"],
  });

  // Re-sync to refresh lockHash for the new commit.
  console.log(`[meta]   running pnpm sync:source ${slug} to refresh lockHash`);
  execSync(`pnpm sync:source ${slug}`, {
    cwd: projectRoot,
    stdio: ["ignore", "inherit", "inherit"],
  });
}

function gh(args: string[]): string {
  return execSync(`gh ${args.map((a) => JSON.stringify(a)).join(" ")}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}
