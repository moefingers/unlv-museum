# Source Repos & Hosting Framework

This document is the contract for how source repos backing museum originals are managed. Read this before touching any project's `original` tier or modifying `public/originals/<slug>/`.

## The problem this solves

Each original on display is iframe-served from `public/originals/<slug>/` — usually built artifacts from a separate GitHub repo (the actual coursework). Over time the museum drifts from those repos: we patch dead URLs, swap broken assets, fix sandboxed iframe constraints. Without a system, those patches become invisible "what did we change?" knowledge that lives only in commit messages.

The framework gives each original a structured connection back to its source repo while keeping the deploy story simple (Vercel still just serves committed `public/originals/<slug>/`).

## Tier ownership model

The rule that decides where a tier's code lives: **a tier lives where its dependencies live.** This is not a stylistic preference; it's a structural test. Ask of any tier's source: which set of imports does this code actually have? The answer points at the canonical home.

- **Original** depends on the source repo's build artifacts — the HTML/JS/CSS that was turned in for class. Its canonical home is the source repo, exposed to the museum as a submodule pinned to the `museum-ready/original` branch. The original would still be the original if the museum vanished.
- **Enhanced** depends on museum primitives — zcanon design tokens, the SiblingRail / ProjectChrome composition, React 19 + Next.js, the museum's typed Project schema. Pulled out of the museum, an enhanced component is inert: it imports modules that don't exist at any other path. Its canonical home is therefore the museum itself.
- **Reimagined** depends on whatever stack the rebuild chose, runs on its own Vercel deploy, has its own development cadence. Its canonical home is its own repo + its own deploy, linked from the museum via `reimaginedExternal`.

| Tier           | We wrote it? | What it imports                          | Canonical home                                                             | How it's hosted                                             |
| -------------- | :----------: | ---------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Original**   |      No      | Self-contained build artifacts           | Submodule at `.sources/<repo>/` pinned to `museum-ready/original` branch   | Built artifact in `public/originals/<slug>/`, iframe-served |
| **Enhanced**   |     Yes      | Museum primitives (zcanon, schema, etc.) | Native in museum (`src/components/enhanced/` or `src/app/(museum\|ssr)/…`) | Rendered directly as React/Server Component                 |
| **Reimagined** |     Yes      | Its own stack choices                    | Separate repo + separate Vercel deployment                                 | External link (`reimaginedExternal` field)                  |

### Why no `museum-ready/enhanced` submodule branch

The symmetric-looking move — give enhanced its own branch on the source repo, mirroring how `museum-ready/original` works — fails the dependency-graph test. The enhanced component for `js-dom-events`, for example, imports zcanon design tokens via CSS modules and lives inside the museum's React 19 / Next.js / SiblingRail composition. A copy of that file on a `museum-ready/enhanced` branch of `JS-Events-Demonstration` wouldn't compile in that repo's checkout — the imports would all be broken paths. The branch would carry inert code that claims a level of independence the code doesn't have.

That's not a small cost. A submodule-of-inert-code is a structure that lies about its own coupling. The lie compounds over iteration: every museum-side change to a primitive (the SiblingRail's API, a token rename, an upgrade to React 20) silently breaks the submodule's copy of the code, and the divergence isn't discovered until someone tries to compile the submodule in isolation — which by then might be years later.

The discoverability instinct that makes the submodule appealing — "the source repo should tell the whole story of what was done across tiers" — is real but solvable without code duplication. The banner README on `museum-ready/original` already links to the museum entry; if the enhanced surface is rich enough to warrant calling out, add a prose section in that README pointing at the live URL and the museum-repo source path. Documentation duplication is cheap and decays gracefully; code duplication is expensive and decays silently.

### Exceptions

- **Enhanced via submodule is only acceptable when the enhanced's dependencies are also self-contained** — e.g. an enhanced that uses a stack the museum can't host natively (Python+Pyodide bundle, a Rust WASM module, a non-Next.js framework). In that case the enhanced isn't really "native in museum" in the first place; it's a separate buildable artifact that the museum embeds. Treat it like an original: submodule + sync recipe + `public/enhanceds/<slug>/`.
- **Reimagined inside the museum** is occasionally fine for tiny components that don't justify a separate deploy. The dedicated-dev-session model usually pushes reimagined to its own repo, but a single-file reimagined of a tiny utility doesn't need its own Vercel project.

## Originals — the submodule pattern

### File layout

```
unlv-museum/                                     ← this repo
├── .gitmodules                                  ← tracked: lists each .sources submodule
├── .sources/<repo>/                             ← submodule, pinned at museum-ready SHA
├── public/originals/<slug>/                     ← built output, tracked, deployed
├── src/lib/projects.tsx                         ← project entries; sources field references submodule
├── src/lib/sources.generated.json               ← per-slug commit SHA + lockHash, auto-written by sync script
├── sync.config.ts                               ← per-slug build recipes
└── scripts/
    ├── sync-source.ts                           ← runs a recipe, copies output, updates lockHash
    └── verify-locks.ts                          ← pre-commit hash check
```

### Canonical GitHub-side conventions per source repo

Each converted source repo has two branches and one canonical metadata shape, applied by `pnpm sync:source-meta <slug>` (idempotent — safe to re-run anytime).

| Element                        | Value                                                                                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch `original`              | The unmodified academic record. Renamed from the legacy default (`main`/`master`/`shepherd`). GitHub's rename API preserves history, PR refs, and creates redirects.              |
| Branch `museum-ready/original` | The hosted version with the Node-LTS floor + pnpm + hosting-compat fixes applied. **Set as the GitHub default branch** — visitors who open `github.com/<owner>/<repo>` land here. |
| Website (homepage)             | `https://unlv-museum.infinite-syndicate.com/<slug>` — points back at the museum entry that displays this repo.                                                                    |
| Description prefix             | `🏛️ unlv-museum:` — makes the museum membership visible in any GitHub repo listing.                                                                                               |

Mental model:

- `original` is the past — what was turned in for class. You can `git checkout original` on any source repo to see exactly what was written, byte for byte.
- `museum-ready/original` is the present — what builds and runs against today's web. The diff `git diff original..museum-ready/original` documents exactly what changed for hosting.
- The museum entry is the visible artifact — built from `museum-ready/original`, served from `public/originals/<slug>/`.

### What `museum-ready/original` is allowed to do

- **Required floor**: build cleanly on a currently-supported Node LTS. The branch must build on the version pinned in its `.nvmrc`.
- **Allowed**: bump Node, switch npm → pnpm, modernize build tooling (CRA 4 → 5 if needed, webpack 4 → 5 if needed), bump dev dependencies, add `.npmrc` for hoisted node-linker.
- **Allowed** (hosting-compat): rewrite dead asset URLs, fix sandboxed iframe constraints (preventDefault, asset paths), add `PUBLIC_URL=.`, `HashRouter` if needed.
- **Forbidden**: changing the user-facing application's structure, components, runtime behavior, or visible UI. Source code edits are scoped to hosting compatibility. If you find yourself rewriting the actual app, you're past museum-ready and into enhanced.
- **Forbidden**: cosmetic-only changes. No Prettier, no EditorConfig sweeps, no whitespace cleanups, no comment additions, no rebrandings. The `git diff original..museum-ready/original` should only contain diffs that have a hosting reason. If a reviewer asks "why this change?" the answer must be "because X breaks on Y constraint" — not "because it looks cleaner."

`original` of each source repo stays untouched as the academic record. The byte-for-byte equivalence between `original` and `museum-ready/original` (modulo justified hosting fixes) is the load-bearing invariant of the preservation contract.

### Common hosting fixes — generic catalog

The fixes that recur across multiple projects. Per-project specifics live in [sources-conversions.md](sources-conversions.md)'s per-project specs; this is the menu the per-project work draws from.

| Fix                                        | Reason                                                                                                                                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `import assert` → `import with`            | Browser spec changed from `assert` to `with` for JSON imports                                                                                                                                               |
| `BrowserRouter` → `HashRouter`             | BrowserRouter can't match routes inside an iframe at `/originals/*/index.html`                                                                                                                              |
| `PUBLIC_URL=.` rebuild                     | CRA apps had hardcoded absolute paths from their `homepage` field                                                                                                                                           |
| Geolocation fallback + timeout             | `navigator.geolocation` blocked by iframe sandbox — fall back to LV coordinates after a short timeout instead of hanging                                                                                    |
| API key redaction                          | Keys committed to client JS (per the original assignment) get sentinelled on `museum-ready/original`; the calling code early-returns when the sentinel is present so the affected feature no-ops gracefully |
| Expired image URLs                         | GitHub raw URLs with tokens, dead Google Drive links, etc. replaced with local copies committed alongside the museum copy                                                                                   |
| `localhost:<port>/...` → `/api/<slug>/...` | Hardcoded localhost backend URLs rewritten to the museum's Next.js API ports (rest-rant, admin-portal, sql-injection-demo)                                                                                  |

### Decision tree per source repo

```
Q1: Does the original tier render a source iframe?
    NO  → no submodule, no sources field. Backend-only/Next.js-native projects skip this whole thing.
    YES → proceed.

Q2: Recipe type?
    TYPE A — static-copy:  HTML/CSS/jQuery/vanilla JS, no build step.
    TYPE B — cra-build:    react-scripts produces a static build.
    TYPE C — vite-build:   vite produces a static build.
    TYPE D — patch-only:   shipped bundle already built; we apply a rewrite script.
    TYPE E — special:      Python, Pyodide, multi-app monorepo, etc. Discuss per-project.

Q3: Floor test — does pnpm install && pnpm run build succeed on current Node LTS?
    Walk the escalation ladder; stop at the first level that works:
    a. Nothing needed (static, or build works clean).
    b. Add NODE_OPTIONS=--openssl-legacy-provider to buildEnv.
    c. Add .npmrc with node-linker=hoisted, shamefully-hoist=true.
    d. Bump ONLY the specific blocking dep (e.g. node-sass → dart-sass).
    e. Escalate — discuss with user before structural changes.
```

### Per-project conversion recipe (universal, repeatable)

```
1. Prepare the source repo
   1.1  cd .sources/<repo>
   1.2  git fetch --unshallow             # current clones are shallow
   1.3  git checkout main
   1.4  git checkout -b museum-ready/original

2. Apply the floor
   2.1  Decide Node version (current LTS, e.g. 20). Write to .nvmrc.
   2.2  Floor test: pnpm install && pnpm run build on that Node.
        Walk the escalation ladder. Apply the smallest change that works.
   2.3  Verify build produces correct visible output.

3. Migrate to pnpm
   3.1  pnpm import (if package-lock.json exists) OR pnpm install.
   3.2  rm package-lock.json.
   3.3  Add .npmrc with hoisted linker if CRA-era needs it.
   3.4  Verify build still works.

4. Bring forward existing hosting fixes
   4.1  Diff current source vs public/originals/<slug>/.
        For SOURCE-CODE fixes (URL substitutions, asset path corrections,
        preventDefault patches in source files) — apply them to the source.
        For BUNDLE-LEVEL fixes (post-build minified JS rewrites) — leave them
        for a postPatch script in the museum, do not commit patched bundles
        to the source.

5. Commit and push museum-ready
   5.1  git add -A && git commit -m "museum-ready: Node N, pnpm, hosting fixes"
   5.2  git push origin museum-ready/original

6. Convert .sources/<repo> from plain clone to submodule
   6.1  cd back to museum root
   6.2  Remove the plain clone (rm -rf .sources/<repo>)
   6.3  git submodule add -b museum-ready/original <repo-url> .sources/<repo>
   6.4  git submodule update --init --remote

7. Add the slug to sync.config.ts
   7.1  Choose recipe type and fill in cwd, install, build, buildEnv, buildOutput, to.
   7.2  Add postPatch script reference if bundle-level fixes are needed.

8. Run sync to populate public/originals/<slug>/
   8.1  pnpm sync:source <slug>
   8.2  Visually verify in browser.

9. Commit museum
   9.1  Stage .sources/<repo>, public/originals/<slug>/, src/lib/sources.generated.json,
        sync.config.ts.
   9.2  Commit. Pre-push hook verifies submodule was already pushed in step 5.2.
   9.3  git push.

10. Apply canonical GitHub conventions
   10.1 pnpm sync:source-meta <slug>
        - Renames legacy default branch → `original`
        - Sets `museum-ready/original` as the GitHub default branch
        - Sets the Website (homepage) field to the museum entry URL
        - Prefixes the repo description with 🏛️ unlv-museum:
   10.2 Idempotent: safe to re-run on already-converted repos.
```

### Recipe shapes

`sync.config.ts` exports a record keyed by slug. Each recipe is one of:

```ts
// Type A — static-copy
{
  type: "static-copy",
  from: ".sources/foodTruckUNLV",      // source root inside submodule
  to: "public/originals/food-truck",   // destination in museum
  // optional: postPatch?: string[]
}

// Type B — cra-build
{
  type: "cra-build",
  cwd: ".sources/rest-rant-monorepo/frontend",
  node: "20",                          // documented; .nvmrc in source repo authoritative
  install: "pnpm install --frozen-lockfile",
  build: "pnpm run build",
  buildEnv: { PUBLIC_URL: ".", NODE_OPTIONS: "--openssl-legacy-provider" },
  buildOutput: "build",                // path relative to cwd
  to: "public/originals/rest-rant",
  postPatch: ["scripts/patch-rest-rant-spa.mjs"],
}

// Type C — vite-build
{
  type: "vite-build",
  cwd: ".sources/mp2-ecommerce",
  node: "20",
  install: "pnpm install --frozen-lockfile",
  build: "pnpm run build",
  buildOutput: "dist",
  to: "public/originals/commerce-array",
  postPatch: ["scripts/patch-commerce-array.mjs"],
}

// Type D — patch-only (no source build; we patch already-shipped artifacts)
{
  type: "patch-only",
  to: "public/originals/commerce-array",
  patchScript: "scripts/patch-commerce-array.mjs",
}

// Type E — special: define per-project
```

### Guarantees and how each is enforced

| Guarantee                                                | Mechanism                                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `public/originals/<slug>/` matches recorded lockHash     | `scripts/verify-locks.ts` runs in pre-commit when `public/originals/**` or `src/lib/sources.generated.json` changes |
| Submodule commits are pushed before museum push          | `.husky/pre-push` walks submodules, fails if any has unpushed commits                                               |
| Cloning museum hydrates submodules                       | `package.json` postinstall: `git submodule update --init --recursive` + `git config push.recurseSubmodules check`   |
| Linked commit exists on `museum-ready/original` upstream | Optional CI job (`pnpm verify:sources --remote`)                                                                    |

### Vercel deployment

Vercel does NOT recurse into submodules by default, and we don't want it to. `public/originals/<slug>/` is the committed artifact; Vercel serves it as-is. Submodules are developer-only infrastructure for re-deriving that output.

## Enhanced — native in the museum

A enhanced lives where the rest of museum code lives: `src/components/enhanced/<Slug>.tsx`, or a Next.js route in `src/app/(museum)/...` or `src/app/(ssr)/...` for SSR-style enhanced.

Until a enhanced has been built deliberately for a project, its tier is `<Placeholder label="Coming soon" />`. Each enhanced requires a dedicated decision-and-build session with the user — bulk generation is forbidden.

The escape hatch for enhanced work that can't live natively (different stack, pre-existing standalone deployment) is `enhancedExternal: "https://..."` on the project entry, which renders an external-link card.

## Reimagined — separate repo + external

Reimagined is a total rebuild with bells and whistles, by definition a dedicated project. Pattern:

1. Create a new repo with whatever stack the rebuild needs
2. Deploy to its own Vercel project
3. Set `reimaginedExternal: "https://my-reimagined.vercel.app"` on the museum project entry

Existing examples:

- `own3.vercel.app` — reimagined of milestown
- `enterprize-pi.vercel.app` — reimagined of quirk-truck

Until a reimagined exists, the tier is `<Placeholder label="Coming soon" />`.

## Where to look when things go wrong

| Symptom                                              | Likely cause                                                           | Fix                                                                                |
| ---------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Pre-commit fails with "lockHash mismatch"            | You edited `public/originals/<slug>/` directly without running sync    | Run `pnpm sync:source <slug>`, or if intentional, run `pnpm verify:locks --update` |
| Pre-push fails with "submodule has unpushed commits" | Forgot to `git push origin museum-ready/original` inside the submodule | `cd .sources/<repo> && git push origin museum-ready/original` then retry           |
| Fresh clone has empty `.sources/<repo>` directories  | `pnpm install` postinstall didn't run, or you cloned without recursing | `git submodule update --init --recursive`                                          |
| Visitor sees old content after sync                  | Browser cached the iframe; hard reload                                 | Cmd-Shift-R / Ctrl-Shift-R                                                         |
| Build fails on Node 20 with OpenSSL error            | Old CRA/webpack toolchain                                              | Add `NODE_OPTIONS=--openssl-legacy-provider` to recipe's `buildEnv`                |

## Status of conversions

See [sources-conversions.md](sources-conversions.md) for the per-project tracking table and agent-ready conversion specifications.
