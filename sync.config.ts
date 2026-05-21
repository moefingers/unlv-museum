/**
 * Recipes for building each original from its source submodule and copying
 * the output into public/originals/<slug>/. Consumed by scripts/sync-source.ts.
 *
 * See CONTEXT/internal_docs/sources.md for the full policy + workflow,
 * and CONTEXT/internal_docs/sources-conversions.md for per-project specs.
 *
 * Entries are added incrementally as each project's source repo is converted
 * to a `museum-ready` submodule. Until then, public/originals/<slug>/ holds
 * the current artifact (unmanaged) and the project has no entry here.
 */

/** No build step — copy files from the source submodule verbatim. */
export interface StaticCopyRecipe {
  type: "static-copy";
  /** Path to the source root within the submodule. */
  from: string;
  /** Destination in public/originals/. */
  to: string;
  /**
   * Optional allowlist of files (relative to `from`) to copy. When set,
   * only these exact paths are copied — everything else (server code,
   * package.json, README, etc.) is skipped. Use for source repos that
   * don't already split frontend assets into their own subdir.
   *
   * Glob patterns aren't supported; list exact files. For a directory,
   * list the dir name itself (e.g. "assets" copies the whole subtree).
   */
  include?: string[];
  /** Optional postPatch scripts to run after copy. */
  postPatch?: string[];
}

/** react-scripts (Create React App) build. */
export interface CraBuildRecipe {
  type: "cra-build";
  /** Working directory containing package.json. */
  cwd: string;
  /** Node major version (for reference; .nvmrc in source is authoritative). */
  node: string;
  /** Install command (typically `pnpm install --frozen-lockfile`). */
  install: string;
  /** Build command (typically `pnpm run build`). */
  build: string;
  /** Env vars for the build (e.g. PUBLIC_URL, NODE_OPTIONS). */
  buildEnv?: Record<string, string>;
  /** Build output directory relative to cwd (e.g. "build"). */
  buildOutput: string;
  /** Destination in public/originals/. */
  to: string;
  /** Optional postPatch scripts to run after copy. */
  postPatch?: string[];
}

/** Vite (or vite-shaped) build. */
export interface ViteBuildRecipe {
  type: "vite-build";
  cwd: string;
  node: string;
  install: string;
  build: string;
  buildEnv?: Record<string, string>;
  /** Build output directory relative to cwd (typically "dist"). */
  buildOutput: string;
  to: string;
  postPatch?: string[];
}

/** Post-build patches only; no source rebuild. */
export interface PatchOnlyRecipe {
  type: "patch-only";
  /** Destination in public/originals/ that the patch script operates on. */
  to: string;
  /** Path to the patch script (run as `node <script>`). */
  patchScript: string;
}

/**
 * Backend-only sources: a submodule that ships no public frontend artifact.
 * The museum's Next.js port (route handlers + Drizzle schema) lives in
 * src/app/(museum)/; the submodule still gets a museum-ready/original
 * branch on GitHub so the source repo carries the unlv-museum banner,
 * description, topics, and a stable diff against the legacy default.
 *
 * No copy, no build. `pnpm sync:source <slug>` just records the
 * submodule's branch / commit and hashes the submodule root so drift
 * is detectable.
 *
 * Applies to: JASKIS (MongoDB shell, surfaced via /mongo-client),
 * Music Tour API (Express, surfaced via /api-client?api=music-tour),
 * SQL Injection Demo (Express + SQLite, /api-client?api=sql-demo).
 */
export interface BackendOnlyRecipe {
  type: "backend-only";
  /**
   * Path to the submodule root (e.g. ".sources/API-JASKIS"). The hash for
   * drift detection is computed over this directory; sync:source-meta
   * derives the GitHub owner/repo from the submodule's remote URL.
   */
  from: string;
}

export type Recipe =
  | StaticCopyRecipe
  | CraBuildRecipe
  | ViteBuildRecipe
  | PatchOnlyRecipe
  | BackendOnlyRecipe;

/**
 * Map of museum slug → recipe. Add entries as conversions land.
 */
export const recipes: Record<string, Recipe> = {
  "js-dom-events": {
    type: "static-copy",
    from: ".sources/JS-Events-Demonstration",
    to: "public/originals/js-exercises/js-dom-events/events-demo",
  },

  "admin-portal": {
    type: "static-copy",
    from: ".sources/JS-Building-an-Admin-Portal/public",
    to: "public/originals/js-exercises/admin-portal",
  },

  "interactive-map": {
    type: "static-copy",
    from: ".sources/JS-Making-an-Interactive-Map",
    to: "public/originals/js-exercises/interactive-map",
  },

  "shared-counter": {
    type: "static-copy",
    from: ".sources/JS-Building-a-Shared-Counter-Part-1/public",
    to: "public/originals/js-exercises/shared-counter",
  },

  jaskis: {
    type: "backend-only",
    from: ".sources/API-JASKIS",
  },

  "music-tour-api": {
    type: "backend-only",
    from: ".sources/SQL-Music-Tour-API",
  },

  // TEMPORARY backend-only — rest-rant's CRA frontend has a roughed-out
  // cra-build recipe in sources-conversions.md (🔴 unfinished) but the
  // museum-side `/api/rest-rant/*` routes are working today, and we want
  // the GitHub-side meta (banner, description, branches) to land now.
  // When the CRA frontend build lands, swap this entry to a cra-build
  // recipe (frontend) — the meta will continue working as long as the
  // submodule still points at `.sources/rest-rant-monorepo`.
  "rest-rant": {
    type: "backend-only",
    from: ".sources/rest-rant-monorepo",
  },

  "sql-injection-demo": {
    type: "static-copy",
    from: ".sources/iam-2-sql-injection-demo",
    to: "public/originals/sql-demo",
    // Original repo has app.js / package.json at the root next to the
    // frontend assets — explicit allowlist so only the static files
    // visitors actually see in the iframe get copied. The form action
    // in index.html was rewritten on museum-ready/original to point at
    // /api/sql-demo/login-html so the form-submit flow reaches the
    // museum's route handler instead of the dead /login of the original
    // Express server.
    include: ["index.html", "style.css"],
  },

  // SSR original: the museum doesn't run the Express/MongoDB server; the
  // SSR character (server-rendered JSX views, form-driven mutations) is
  // reimplemented in src/app/(museum)/originals/rest-rant-ssr/ using Next.js
  // Server Components + Drizzle. The submodule is here purely so the source
  // repo carries the unlv-museum banner / topics / branch promotion.
  "rest-rant-ssr": {
    type: "backend-only",
    from: ".sources/UNLV-rest-rant",
  },

  // Conversions land here. See sources-conversions.md for the per-project
  // specifications. Example shape (commented out until conversion runs):
  //
  // "food-truck": {
  //   type: "static-copy",
  //   from: ".sources/foodTruckUNLV",
  //   to: "public/originals/food-truck",
  // },
  //
  // "rest-rant": {
  //   type: "cra-build",
  //   cwd: ".sources/rest-rant-monorepo/frontend",
  //   node: "20",
  //   install: "pnpm install --frozen-lockfile",
  //   build: "pnpm run build",
  //   buildEnv: { PUBLIC_URL: ".", NODE_OPTIONS: "--openssl-legacy-provider" },
  //   buildOutput: "build",
  //   to: "public/originals/rest-rant",
  //   postPatch: ["scripts/patch-rest-rant-spa.mjs"],
  // },
  //
  // "commerce-array": {
  //   type: "patch-only",
  //   to: "public/originals/commerce-array",
  //   patchScript: "scripts/patch-commerce-array.mjs",
  // },
};
