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

  // Monty's Mineral SPA — chapter 7.x React Router exercise. The source
  // repo carries two CRA apps side-by-side: `react-router/` is the broken
  // assignment starter (literally has `<a href={<Home />}>...`), and
  // `moe-not-broken-react-router/` is the student-completed working
  // version. Museum builds the completed one — that's the artifact.
  //
  // BrowserRouter → HashRouter alias on museum-ready/original so client-
  // side routing works under iframe hosting without server rewrites.
  // PUBLIC_URL=. makes asset paths relative; react-scripts 5.0.1 + React
  // 18 means no `--openssl-legacy-provider` needed.
  "montys-mineral-spa": {
    type: "cra-build",
    cwd: ".sources/RR-React-Router-Montys-Mineral-Spa/moe-not-broken-react-router",
    node: "20",
    install: "pnpm install --frozen-lockfile",
    build: "pnpm run build",
    buildEnv: { PUBLIC_URL: "." },
    buildOutput: "build",
    to: "public/originals/react-exercises/montys-mineral-spa",
  },

  // Music Search: React Router series, an iTunes search SPA (the iframe
  // already allows allow-forms). The source repo is a fork of the HackerUSA-CE
  // lesson repo, and main carries the app as forked. react-scripts 5.0.1 +
  // React 18, so no `--openssl-legacy-provider`. museum-ready/original
  // normalizes npm to pnpm. pnpm-workspace.yaml keeps the npm lock's package
  // set (autoInstallPeers: false), declines core-js banner scripts and sets
  // nodeLinker: hoisted, so the rebuild matches the served bundle byte for
  // byte. Verified on Node 24.14.1 / pnpm 12.10.1. PUBLIC_URL=. makes asset
  // paths relative under /originals/react-exercises/music-search/.
  "music-search": {
    type: "cra-build",
    cwd: ".sources/RR-Music-Search",
    node: "24",
    install: "pnpm install --frozen-lockfile",
    build: "pnpm run build",
    buildEnv: { PUBLIC_URL: "." },
    buildOutput: "build",
    to: "public/originals/react-exercises/music-search",
  },

  // Getting Started With Bootstrap: React Router series. A react-bootstrap
  // playground (Nav, Button, Form) on top of the HackerUSA-CE starter.
  // react-scripts 5.0.1 + React 18, so no `--openssl-legacy-provider`.
  // museum-ready/original normalizes npm to pnpm. pnpm-workspace.yaml
  // declines core-js banner scripts and sets nodeLinker: hoisted, so the
  // JS/CSS/HTML match the served bundle byte for byte. Verified on Node
  // 24.14.1 / pnpm 12.10.1. PUBLIC_URL=. makes asset paths relative under
  // /originals/react-exercises/bootstrap/.
  bootstrap: {
    type: "cra-build",
    cwd: ".sources/RR-Getting-Started-With-Bootstrap",
    node: "24",
    install: "pnpm install --frozen-lockfile",
    build: "pnpm run build",
    buildEnv: { PUBLIC_URL: "." },
    buildOutput: "build",
    to: "public/originals/react-exercises/bootstrap",
  },

  // My Values — static HTML/CSS artifact (no build step). Source-level
  // hosting fix on museum-ready/original: two responsive breakpoints
  // (900px wrap, 600px stack) so the four-column desktop layout doesn't
  // clip cards inside the iframe at narrow viewports. The original
  // breaks at <900px by design — the assignment was a CSS sampler that
  // only targeted desktop. The fix preserves the desktop look at
  // >=900px and adds graceful fallbacks below.
  "my-values": {
    type: "static-copy",
    from: ".sources/My-Values",
    to: "public/originals/my-values",
    include: ["index.html", "assets"],
  },

  // Restaurant Menu: chapter 2.3.2 HTML lab (fork of the
  // sjxliu/lab-2.3.2-restaurant-menu starter). Static HTML/CSS, no build.
  // museum-ready/original is the legacy `master` tip unchanged; the served
  // copy needed no hosting fixes. The allowlist skips README / LICENSE /
  // .DS_Store, and names assets/ subdirs so assets/.DS_Store (gitignored
  // museum-side) never lands in public/originals and skews the lockHash.
  "restaurant-menu": {
    type: "static-copy",
    from: ".sources/html-1-restaurant-menu-activity",
    to: "public/originals/html-fundamentals/restaurant-menu",
    include: [
      "index.html",
      "about.html",
      "menu.html",
      "contact.html",
      "assets/css",
      "assets/images",
    ],
  },

  // Bird Songs: chapter 2.4.1 HTML lab (fork of sjxliu/lab-2.4.1-bird-songs).
  // Static HTML + local images/sounds + YouTube embeds, no build.
  // museum-ready/original is the legacy `master` tip unchanged; no hosting
  // fixes needed. Allowlist skips LICENSE / .gitignore and names assets/
  // subdirs so assets/.DS_Store (gitignored museum-side) isn't copied.
  "bird-songs": {
    type: "static-copy",
    from: ".sources/HTML-Bird-Songs",
    to: "public/originals/html-fundamentals/bird-songs",
    include: [
      "index.html",
      "canary.html",
      "duck.html",
      "meadowlark.html",
      "rooster.html",
      "assets/css",
      "assets/images",
      "assets/sounds",
    ],
  },

  // Improved Sign-up Form: chapter 2.5.2 HTML lab (fork of
  // NikoPoliarco/lab-2.5.2-improved-sign-up-form). GET form -> results.html,
  // which reads URLSearchParams client-side. No build. museum-ready/original
  // is the legacy `main` tip unchanged; no hosting fixes needed. Allowlist
  // skips README / LICENSE / .gitignore / .DS_Store (incl. assets/.DS_Store).
  "improved-form": {
    type: "static-copy",
    from: ".sources/HTML-Improved-Form",
    to: "public/originals/html-fundamentals/improved-form",
    include: ["index.html", "results.html", "assets/css", "assets/images"],
  },

  // HTML Layouts: chapter 2.x layouts activity (own repo). Static HTML/CSS
  // with placebear.com images + Font Awesome CDN, no build.
  // museum-ready/original is the legacy `main` tip unchanged; no hosting
  // fixes needed. Allowlist keeps the banner README (added by
  // sync:source-meta) out of the served copy.
  layouts: {
    type: "static-copy",
    from: ".sources/UNLV-html-layouts-activity",
    to: "public/originals/html-fundamentals/layouts",
    include: ["index.html", "assets"],
  },

  // CSS Demo: own early CSS sketch (empty <body>, zero-byte style1.css);
  // the blank iframe is the artifact. museum-ready/original is the legacy
  // `shepherd` tip unchanged. Note: this restores the submitted empty
  // `<script src="">` tag that the pre-conversion served copy had dropped
  // (no hosting reason: an empty src fetches nothing). Allowlist keeps the
  // banner README out of the served copy.
  "css-demo": {
    type: "static-copy",
    from: ".sources/css-demo",
    to: "public/originals/css-fundamentals/css-demo",
    include: ["index.html", "assets"],
  },

  // Hacker Times: chapter 3.2.4 CSS lab (fork of
  // CodeKing710/activity-3.2.4-hacker-times). Static HTML/CSS + Google
  // Fonts, no build. museum-ready/original is the legacy `main` tip (Part 1)
  // unchanged; no hosting fixes needed. The repo's `part2` branch is not
  // served. Allowlist skips LICENSE and the banner README.
  "hacker-times": {
    type: "static-copy",
    from: ".sources/CSS-The-Hacker-Times-Part-1",
    to: "public/originals/css-fundamentals/hacker-times",
    include: ["index.html", "assets"],
  },

  // CSS Transforms, Transitions & Animations: chapter 3.3.2 lab (fork of
  // MarsVolta4366/activity-3.3.2-animations). Three static activities, each
  // its own index.html; the museum iframes animation-activity/ by default.
  // museum-ready/original is the legacy `main` tip unchanged; no hosting
  // fixes needed. Allowlist skips LICENSE / .gitignore / the README-only
  // button-transition.gif at the repo root.
  animations: {
    type: "static-copy",
    from: ".sources/CSS-Transform-Transition-and-Animations-Oh-My",
    to: "public/originals/css-fundamentals/animations",
    include: [
      "animation-activity",
      "transform-activity",
      "transition-activity",
    ],
  },

  // Responsive Boxes: chapter 3.4.3 lab (fork of
  // snyderae13/lab-3.4.3-responsive-boxes). Three media-query exercises,
  // each its own index.html; the museum iframes medial-queries1/ by default.
  // museum-ready/original is the legacy `main` tip unchanged; no hosting
  // fixes needed. Allowlist skips README / LICENSE and the README-only
  // imgs/ screenshots.
  "responsive-boxes": {
    type: "static-copy",
    from: ".sources/CSS-Responsive-Boxes",
    to: "public/originals/css-fundamentals/responsive-boxes",
    include: ["medial-queries1", "medial-queries2", "medial-queries3"],
  },

  // Responsive Navigation: own June 2024 CSS exercise. Static HTML/CSS + a
  // small JS file that duplicates the nav buttons / main sections, no build.
  // museum-ready/original is the legacy `shepherd` tip unchanged; no hosting
  // fixes needed. Allowlist skips README / LICENSE / .gitignore.
  "css-responsive-nav": {
    type: "static-copy",
    from: ".sources/css-responsive-nav",
    to: "public/originals/css-responsive-nav",
    include: [
      "index.html",
      "style.css",
      "duplicateNavButtonsAndMainSections.js",
    ],
  },

  // MilestO-W-N (Jan 2024): vanilla JS 1-4 player territory game, no build.
  // Hosting fix on museum-ready/original: the three JSON module imports use
  // import attributes (`with { type: 'json' }`) instead of the import-
  // assertions keyword (`assert`) that Chrome 126+ rejects, which left the
  // game blank. The allowlist keeps README / LICENSE / the social-card
  // images out of the iframe copy. (milestown2 is the separate Enhanced repo.)
  milestown: {
    type: "static-copy",
    from: ".sources/UNLV-MilestO-W-N",
    to: "public/originals/milestown",
    include: ["index.html", "favicon.ico", "assets", "publicationfiles"],
  },

  // Stock Charts: Chart.js + Bootstrap from CDNs over bundled mock data, no
  // build. The served app is the repo's public/ dir (what `pnpm start` /
  // live-server serves). museum-ready/original only pnpm-normalizes.
  "stock-charts": {
    type: "static-copy",
    from: ".sources/JS-Stock-Charts/public",
    to: "public/originals/stock-charts",
  },

  // Copycat Activity: HTML/CSS recreation, no build, no hosting fixes
  // (museum-ready/original == shepherd). The allowlist keeps the banner
  // README out of the iframe copy.
  copycat: {
    type: "static-copy",
    from: ".sources/copycatactivity",
    to: "public/originals/copycat",
    include: ["index.html", "assets"],
  },

  // Jack's Paint: vanilla JS paint-chip picker (selection is on mouseover
  // of the swatches), no build, no hosting fixes (museum-ready/original ==
  // main). The allowlist leaves out LICENSE, .vscode/ and the banner README.
  "jacks-paint": {
    type: "static-copy",
    from: ".sources/UNLV-JS-Jacks-Paint",
    to: "public/originals/js-exercises/jacks-paint",
    include: ["index.html", "assets"],
  },

  // Web Game Series: the museum frames part 7, the latest of the three repos
  // for this exercise (5.4.2), no build, no hosting fixes. The recipe owns
  // only web-game/part-7/; the parts-1-3/ and part-4/ siblings stay
  // unmanaged for now. The assets are listed one by one so the macOS
  // assets/.DS_Store the repo commits stays out (gitignored museum-side,
  // but hashDir would still count it in lockHash).
  "web-game": {
    type: "static-copy",
    from: ".sources/JS-Web-Game-Part-7",
    to: "public/originals/js-exercises/web-game/part-7",
    include: [
      "index.html",
      "index.js",
      "move.js",
      "newImage.js",
      "newInventory.js",
      "newItem.js",
      "newNonPlayableCharacter.js",
      "newPlayableCharacter.js",
      "assets/boulder.png",
      "assets/crate.png",
      "assets/grass.png",
      "assets/green-character",
      "assets/log.png",
      "assets/pillar.png",
      "assets/pine-tree.png",
      "assets/red-character",
      "assets/rock.png",
      "assets/shield.png",
      "assets/sky.png",
      "assets/staff.png",
      "assets/sword.png",
      "assets/tree.png",
      "assets/well.png",
    ],
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
