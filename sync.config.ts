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

  // CRA SPA built from the rest-rant-monorepo's frontend/ subdirectory.
  // Two layers of fix coexist here:
  //
  //   1. Source-level hosting fixes live on the museum-ready/original
  //      branch — HashRouter alias on the BrowserRouter import,
  //      %PUBLIC_URL% on the stylesheet href, <Link to> in place of
  //      bare <a href> for the Places Page CTA, plus the asset
  //      relocations (frontend/public/css/, frontend/public/images/)
  //      that make CRA bundle them into the iframe-served build.
  //
  //   2. Bundle-level URL rewrites live in the postPatch script
  //      (scripts/patch-rest-rant-spa.mjs) — localhost:5000 → /api/
  //      rest-rant/* substitutions that webpack inlines into the
  //      minified main chunk at build time. Keeping these in postPatch
  //      lets `git diff original..museum-ready/original` on the source
  //      repo show only true source-level work; the address rewrites
  //      that adapt the SPA to the museum's API host live museum-side.
  //
  // openssl-legacy-provider needed because this is CRA 4 / webpack 4,
  // which uses the MD4 hash that modern Node's OpenSSL 3 dropped.
  "rest-rant": {
    type: "cra-build",
    cwd: ".sources/rest-rant-monorepo/frontend",
    node: "20",
    install: "pnpm install --frozen-lockfile",
    build: "pnpm run build",
    buildEnv: { PUBLIC_URL: ".", NODE_OPTIONS: "--openssl-legacy-provider" },
    buildOutput: "build",
    to: "public/originals/rest-rant",
    postPatch: ["scripts/patch-rest-rant-spa.mjs"],
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

  // Declarative Counter — chapter 7.1.3 of the React Router series, the
  // first exercise that introduces React's declarative rendering model.
  // The source repo's name is the lesson title; the actual CRA app lives
  // in the `7.1.3-declarative-counter/` subdir. react-scripts 5.0.1 + React
  // 18 — no `--openssl-legacy-provider` needed. The source repo originally
  // shipped a package-lock.json; museum-ready/original normalizes to pnpm
  // per the policy in sources.md (disk-size — npm's node_modules per CRA
  // is 200–500 MB, pnpm's is kilobytes). PUBLIC_URL=. makes asset paths
  // relative so the iframe-served output works from
  // /originals/react-exercises/declarative-counter/.
  "declarative-counter": {
    type: "cra-build",
    cwd: ".sources/rr-1-react-and-front-end-libraries/7.1.3-declarative-counter",
    node: "20",
    install: "pnpm install --frozen-lockfile",
    build: "pnpm run build",
    buildEnv: { PUBLIC_URL: "." },
    buildOutput: "build",
    to: "public/originals/react-exercises/declarative-counter",
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
  // "commerce-array": {
  //   type: "patch-only",
  //   to: "public/originals/commerce-array",
  //   patchScript: "scripts/patch-commerce-array.mjs",
  // },
};
