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

export type Recipe =
  | StaticCopyRecipe
  | CraBuildRecipe
  | ViteBuildRecipe
  | PatchOnlyRecipe;

/**
 * Map of museum slug → recipe. Add entries as conversions land.
 */
export const recipes: Record<string, Recipe> = {
  "js-dom-events": {
    type: "static-copy",
    from: ".sources/JS-Events-Demonstration",
    to: "public/originals/js-dom-events/events-demo",
  },

  "admin-portal": {
    type: "static-copy",
    from: ".sources/JS-Building-an-Admin-Portal/public",
    to: "public/originals/admin-portal",
  },

  "shared-counter": {
    type: "static-copy",
    from: ".sources/JS-Building-a-Shared-Counter-Part-1/public",
    to: "public/originals/shared-counter",
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
