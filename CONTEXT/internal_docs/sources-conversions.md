# Source Conversion Tracking

Per-project tracking for the conversion to the submodule + `museum-ready` workflow described in [sources.md](sources.md). Each section below is **agent-actionable** — an agent should be able to read one project's section and execute the conversion independently.

## Status legend

- `🔴 not-started` — original is still rendering from current `public/originals/<slug>/`; no submodule, no `museum-ready` branch
- `🟡 in-progress` — conversion partially done; details in the project's notes
- `🟢 done` — submodule exists, `museum-ready` branch is the source of truth, `sources` field populated in `projects.tsx`

## Status table

| Slug                  | Source repo                                                                       | Type                     | Status | Notes                                                                                                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------- | ------------------------ | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| milestown             | moefingers/UNLV-MilestO-W-N                                                       | A (static)               |   🔴   | progression chain: original = milestown (UNLV-MilestO-W-N), remastered external = `moefingers.github.io/milestown2/` (multiplayer remake — source repo `moefingers/milestown2`), reimagined external = `own3.vercel.app` |
| gwhac-a-mole          | moefingers/gwhac-a-mole                                                           | B (cra)                  |   🔴   | strong tag → green (Guacamole) subtitle already applied                                                                                                                                                                  |
| web-game              | moefingers/js-2-web-game-part-1and2and3 (+ part-4, part-7)                        | A (static)               |   🔴   | 3 source repos correspond to one museum entry — pick latest (part 7)                                                                                                                                                     |
| rest-rant             | moefingers/rest-rant-monorepo                                                     | B (cra)                  |   🔴   | needs NODE_OPTIONS legacy-openssl; SPA bundle has localhost→/api/rest-rant URL rewrites + nav preventDefault patch — these are bundle-level postPatch                                                                    |
| rest-rant-ssr         | —                                                                                 | (none)                   |  n/a   | Next.js-native in `src/app/(ssr)/`; no source repo conversion needed                                                                                                                                                     |
| commerce-array        | moefingers/mp2-ecommerce                                                          | C (vite) + D (postPatch) |   🔴   | minified bundle has AWS API Gateway URLs that need rewriting to local JSON; existing `scripts/patch-commerce-array.mjs` would be the postPatch                                                                           |
| enterprize            | moefingers/quirkTruck (shared with quirk-truck)                                   | A (static)               |   🔴   | original is quirk-truck's iframe; reimagined external = `enterprize-pi.vercel.app`                                                                                                                                       |
| nextjs-dashboard      | —                                                                                 | (none)                   |  n/a   | original is a placeholder card explaining the deployment is gone; no source iframe                                                                                                                                       |
| art-gallery           | moefingers/UNLV-react-art-gallery                                                 | B (cra)                  |   🔴   |                                                                                                                                                                                                                          |
| quirk-truck           | moefingers/quirkTruck                                                             | B (cra)                  |   🔴   |                                                                                                                                                                                                                          |
| timer-stopwatch       | moefingers/react-timer-stopwatch-v2                                               | C (vite)                 |   🔴   |                                                                                                                                                                                                                          |
| food-truck            | moefingers/foodTruckUNLV                                                          | A (static)               |   🔴   | dead Google Drive URLs for 5 images (3 menu pics + Facebook/Instagram icons), already substituted with local SVGs at `public/originals/food-truck/images/`                                                               |
| admin-portal          | —                                                                                 | (none)                   |  n/a   | backend-only; original is ApiExplorer                                                                                                                                                                                    |
| interactive-map       | moefingers/UNLV-Making-Interactive-Map or moefingers/JS-Making-an-Interactive-Map | A (static)               |   🔴   | geolocation timeout added in `app.js`; check which clone is canonical                                                                                                                                                    |
| stock-charts          | moefingers/JS-Stock-Charts                                                        | A (static)               |   🔴   | verify static — has Chart.js client-side                                                                                                                                                                                 |
| jacks-paint           | moefingers/UNLV-JS-Jacks-Paint                                                    | A (static)               |   🔴   | vanilla JS + canvas                                                                                                                                                                                                      |
| copycat               | moefingers/copycatactivity                                                        | A (static)               |   🔴   | HTML/CSS only                                                                                                                                                                                                            |
| my-values             | moefingers/My-Values                                                              | A (static)               |   🔴   |                                                                                                                                                                                                                          |
| music-tour-api        | —                                                                                 | (none)                   |  n/a   | backend-only                                                                                                                                                                                                             |
| sql-injection-demo    | —                                                                                 | (none)                   |  n/a   | backend-only                                                                                                                                                                                                             |
| jaskis                | —                                                                                 | (none)                   |  n/a   | backend-only                                                                                                                                                                                                             |
| petfax                | moefingers/PY-PetFax                                                              | E (special)              |   🔴   | Flask app — was pre-built to static; decide approach: keep static snapshot or run Flask at edge                                                                                                                          |
| python-fundamentals   | moefingers/python-day-3/4/5/9, python*functions_practice*\*                       | E (special)              |   🔴   | Pyodide loads .py files; multiple source repos for one museum entry                                                                                                                                                      |
| html-css-fundamentals | moefingers/CSS-The-Hacker-Times-Part-1 (and siblings)                             | A (static)               |   🔴   | "Hacker Times" demo is the primary; siblings may need separate entries                                                                                                                                                   |
| js-dom-events ✅      | moefingers/JS-Events-Demonstration                                                | A (static)               |   🔴   |                                                                                                                                                                                                                          |
| react-exercises       | moefingers/RR-Music-Search (and siblings)                                         | B (cra)                  |   🔴   | needs allow-forms iframe sandbox (already on `OriginalFrame`); music-search uses iTunes API                                                                                                                              |
| css-responsive-nav    | moefingers/css-responsive-nav                                                     | A (static)               |   🔴   |                                                                                                                                                                                                                          |
| restaurant-menu       | moefingers/html-1-restaurant-menu-activity                                        | A (static)               |   🔴   |                                                                                                                                                                                                                          |

## Per-project conversion specs

Each section below is structured to be an **agent's single-page reference** for converting one project. Follow the universal recipe in [sources.md](sources.md), filling in the project-specific details below.

---

### food-truck

- **Source repo**: `git@github.com:moefingers/foodTruckUNLV.git`
- **Local clone path**: `.sources/foodTruckUNLV/`
- **Submodule target path**: `.sources/foodTruckUNLV`
- **Recipe type**: A (static-copy)
- **Build entry**: project root (no subfolder)
- **Build command**: none
- **Hosting fixes already applied** (must be brought forward into the source's `museum-ready` branch):
  1. `index.html` — 5 `<img>` tags swapped from `drive.google.com` URLs to `./images/<name>.svg`. The 5 local SVGs exist in the current `public/originals/food-truck/images/`. Copy them into the source's `images/` directory and update the `<img src>` attributes to match.
  2. The `<img>` alt text and class names stay identical.
- **Expected `sync.config.ts` entry**:
  ```ts
  "food-truck": {
    type: "static-copy",
    from: ".sources/foodTruckUNLV",
    to: "public/originals/food-truck",
  }
  ```
- **Verification**: load `http://localhost:3000/food-truck` and visually confirm 3 menu images + Facebook + Instagram icons render.

---

### rest-rant (SPA)

- **Source repo**: `git@github.com:moefingers/rest-rant-monorepo.git`
- **Local clone path**: `.sources/rest-rant-monorepo/`
- **Submodule target path**: `.sources/rest-rant-monorepo`
- **Recipe type**: B (cra-build) + bundle postPatch
- **Build entry**: `frontend/` subdirectory of the source repo
- **Build command**: `pnpm run build` after `pnpm install`
- **Floor adjustments**:
  - `.nvmrc` = `20`
  - `buildEnv`: `PUBLIC_URL=.`, `NODE_OPTIONS=--openssl-legacy-provider`
  - `.npmrc` in source needed: `node-linker=hoisted`, `shamefully-hoist=true` (CRA 4 peer-dep quirks under pnpm)
- **Hosting fixes already applied** (mix of source-level and bundle-level):
  - **Source-level** (apply to `museum-ready` branch):
    - `frontend/public/index.html` already has correct `%PUBLIC_URL%/css/style.css` reference (not `http://localhost:5000`)
    - `frontend/src/Home.js` references `./images/chia-fruit-drink.jpg` (not `http://localhost:5000`)
  - **Bundle-level postPatch** (keep in museum, not source — the bundle is post-build artifact):
    - Replace `http://localhost:5000/places/` → `/api/rest-rant/places/`
    - Replace `http://localhost:5000/places` → `/api/rest-rant/places`
    - Replace `http://localhost:5000/users/` → `/api/rest-rant/users/`
    - Replace `http://localhost:5000/users` → `/api/rest-rant/users`
    - Replace `http://localhost:5000/authentication/` → `/api/rest-rant/authentication/`
    - Replace `http://localhost:5000/images/kittykat.jpeg` → `https://placebear.com/g/400/400`
    - Rewrite `onClick:()=>e.push("...")` to `onClick:_ev=>{_ev.preventDefault();e.push("...")}` (5 nav links; do NOT touch the place-card link which uses `t.push`)
    - These are exactly the rewrites in the current `scripts/patch-rest-rant-spa.mjs` (write this file as part of the conversion if it doesn't exist; reverse-engineer from the museum commit `277cd35`)
- **Expected `sync.config.ts` entry**:
  ```ts
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
  }
  ```
- **Verification**: `http://localhost:3000/rest-rant` loads the SPA; click Places, Add Place, Login, Sign Up nav links — all should navigate (the patched onClick fires preventDefault). Places list should populate from `/api/rest-rant/places`.

---

### commerce-array

- **Source repo**: `git@github.com:moefingers/mp2-ecommerce.git`
- **Local clone path**: `.sources/mp2-ecommerce/`
- **Submodule target path**: `.sources/mp2-ecommerce`
- **Recipe type**: D (patch-only) — current state. Could escalate to C + D if we rebuild from source.
- **Hosting fixes already applied** (all bundle-level, in `public/originals/commerce-array/assets/index-B27ab45m.js`):
  - Replace `https://7rwcnp46mg.execute-api.us-west-2.amazonaws.com/staging/store/` → `./store.json`
  - Replace `https://7rwcnp46mg.execute-api.us-west-2.amazonaws.com/staging/products/all` → `./products-all.json`
  - Replace `https://7rwcnp46mg.execute-api.us-west-2.amazonaws.com/staging/products/data` → `./products-data.json`
  - Replace `https://7rwcnp46mg.execute-api.us-west-2.amazonaws.com/staging/products/update/` → `./mut/update/`
  - Replace `https://7rwcnp46mg.execute-api.us-west-2.amazonaws.com/staging/products/delete/` → `./mut/delete/`
- **Local JSON files alongside the bundle** (`public/originals/commerce-array/{store,products-all,products-data}.json`) are committed in the museum repo.
- **Initial conversion recommendation**: use type D (patch-only). Don't rebuild from source unless we discover a reason — the patched bundle works.
- **Expected `sync.config.ts` entry**:
  ```ts
  "commerce-array": {
    type: "patch-only",
    to: "public/originals/commerce-array",
    patchScript: "scripts/patch-commerce-array.mjs",
  }
  ```
- **`scripts/patch-commerce-array.mjs`**: write this file. Input is the museum-committed `public/originals/commerce-array/assets/index-B27ab45m.js`. Patch script idempotently applies the 5 URL replacements.
- **Verification**: `http://localhost:3000/commerce-array` shows 3 stores; click Best Sellers — 12+ products render with correct store-colored cards.

---

### interactive-map

- **Source repo**: TBD — two candidates in `.sources/`: `UNLV-Making-Interactive-Map` and `JS-Making-an-Interactive-Map`. Pick the one whose `app.js` matches what's served in `public/originals/interactive-map/`. The current `public/originals/interactive-map/app.js` has a custom geolocation timeout (3s) and null-guard, plus the OpenStreetMap tileserver.
- **Recipe type**: A (static-copy)
- **Hosting fixes already applied** (to apply on `museum-ready`):
  - `app.js` — geolocation timeout (3s) + null-guard. Falls back to LV coordinates `[36.1084, -115.1440]` if `navigator.geolocation` is missing or times out.
- **Expected `sync.config.ts` entry**:
  ```ts
  "interactive-map": {
    type: "static-copy",
    from: ".sources/<picked-repo>",
    to: "public/originals/interactive-map",
  }
  ```
- **Verification**: `http://localhost:3000/interactive-map` shows a Leaflet map within ~3s (falls back to LV if browser blocks geolocation in iframe).

---

### art-gallery, quirk-truck, gwhac-a-mole, timer-stopwatch, react-exercises

Type B (CRA) or C (Vite) projects. Each follows the same template as `rest-rant` but without the bundle postPatch (no API base URL rewrites needed). Convert one at a time:

1. Floor test on Node 20. If CRA-era, expect to need `NODE_OPTIONS=--openssl-legacy-provider` and `.npmrc` with hoisted linker.
2. Switch to pnpm.
3. Copy any hosting-compat fixes from the existing `public/originals/<slug>/` back into source.
4. Build and verify output matches.

---

### Type A static projects

`web-game`, `copycat`, `my-values`, `css-responsive-nav`, `restaurant-menu`, `js-dom-events`, `html-css-fundamentals`, `stock-charts`, `jacks-paint`, `milestown`, `enterprize` (shares quirk-truck).

All follow the food-truck template: no build, just `static-copy`. Each agent should:

1. Diff the existing `public/originals/<slug>/` against the source's current state.
2. Apply any drift back to source's `museum-ready` branch.
3. Add the static-copy recipe to `sync.config.ts`.

---

### Type E special: petfax, python-fundamentals

Both involve Python. Don't auto-convert.

- **petfax**: was Flask + Jinja templates, currently served as a baked HTML snapshot in `public/originals/petfax/`. Discuss whether to keep the snapshot (static-copy of the snapshot) or run Flask via Vercel Python functions.
- **python-fundamentals**: multiple source repos (python-day-3/4/5/9, etc.) feed one museum entry. The Pyodide setup loads `.py` files at runtime. Decide: do we treat each `.py` file as a tracked artifact and not need source repos at all? Or do we pick one canonical source per "day"?

These require a user conversation before any conversion.

## Conversion checklist for an agent picking up one project

```
□ Read sources.md fully
□ Read this project's section above
□ Confirm submodule URL and current local clone exists at .sources/<repo>/
□ git fetch --unshallow inside the clone
□ git checkout -b museum-ready from main
□ Add .nvmrc with "20" (or current LTS)
□ Floor test: pnpm install && pnpm run build (skip if Type A)
□ Walk escalation ladder if floor test fails; apply minimum change
□ Switch to pnpm (pnpm import or pnpm install; rm package-lock.json)
□ Apply documented source-level fixes (see project's "Hosting fixes" above)
□ Verify build (or static content) matches current public/originals/<slug>/
□ Commit + push origin museum-ready
□ Back in museum: rm -rf .sources/<repo> (the plain clone)
□ git submodule add -b museum-ready <url> .sources/<repo>
□ Add recipe to sync.config.ts
□ Write postPatch script if needed (see project's "Bundle-level postPatch" above)
□ pnpm sync:source <slug>
□ Visual verify in browser
□ git add .sources/<repo> public/originals/<slug>/ src/lib/sources.generated.json sync.config.ts
□ Commit; pre-push hook will verify submodule was already pushed
□ git push
□ Update this file: change status from 🔴 → 🟢, add any lessons learned
```

## Lessons learned (append as conversions happen)

_None yet — first conversion will populate this section._
