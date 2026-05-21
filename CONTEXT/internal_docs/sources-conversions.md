# Source Conversion Tracking

Per-project tracking for the conversion to the submodule + `museum-ready/original` workflow described in [sources.md](sources.md). Each section below is **agent-actionable** — an agent should be able to read one project's section and execute the conversion independently.

## Status legend

Each row has five status columns; a project is "fully audited" when every applicable column is ✅ (or ➖ when not applicable).

### State values

Most columns use the same five states. Read them as a progression:

- `🔴 not-started` — nothing exists for this dimension
- `🟠 stubbed` — placeholder exists so visitors see _something_ (e.g. the museum entry renders `<Placeholder label="Coming soon" />`, or schema fields exist with default values but aren't filled in for this project). Honest acknowledgement without committed work.
- `🟡 in-progress` — partially done; see project notes
- `🟢 done` / `✅ done`
- `➖ n/a` — dimension doesn't apply (backend-only with no submodule, no source repo to meta-sync, etc.)

Per-column meaning:

| Column     | What it tracks                                                                                                                                                                                                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Conv**   | Submodule exists, `museum-ready/original` is the source of truth, `sources.generated.json` populated, sync.config recipe in place.                                                                                                                                                                                             |
| **GH**     | `pnpm sync:source-meta <slug>` has been run: legacy default branch renamed to `original`, `museum-ready/original` is the GitHub default, repo description prefixed and rewritten from `Project.synopsis`, homepage set, topics added, banner committed to museum-ready README.                                                 |
| **Fix**    | Hosting fixes on `museum-ready/original` so the museum copy renders correctly: dead URL substitutions, geolocation timeouts, API key redactions, asset path rewrites, etc. `➖ none-needed` is common — originals that ran cleanly as-is.                                                                                      |
| **Schema** | `projects.tsx` entry carries the right shape: `repo`/`synopsis`/`notes`/`techOriginal`, `pages` if multi-page, `siblingApiClient`/`siblingFrontend` if half of an api+client pair, `plannedTiers` if narrower than all three. `🟠 stubbed` means the entry exists with minimal fields but the project hasn't been fleshed out. |
| **✓**      | A human (or agent) loaded the museum URL and confirmed visitors see what they should: page rail navigates if multi-page, iframe loads cleanly, sibling cross-link works.                                                                                                                                                       |

A project is "fully audited" when every applicable column is `🟢`/`✅` (or `➖`).

## Status table

Reset to 🔴 across the board for re-audit. As each project gets walked through, flip the relevant cells. Don't trust a row's status until it's been freshly verified — prior 🟢s rotted in the lockHash-churn era and the meta-sync changed shape since.

| #   | Slug                  | Source repo                                                  | Type                         | Conv | GH  | Fix | Schema |  ✓  | Notes                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | --------------------- | ------------------------------------------------------------ | ---------------------------- | :--: | :-: | :-: | :----: | :-: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | js-dom-events         | moefingers/JS-Events-Demonstration                           | A (static)                   |  🟢  | 🟢  | ➖  |   ✅   | ✅  | Five-page tour (target, bubbling, capturing, preventDefault, stopPropagation) — `pages` array declared. Smoke-tested 2026-05-20.                                                                                                                                                                                                                                                                               |
| 2   | admin-portal          | moefingers/JS-Building-an-Admin-Portal                       | A (static)                   |  🟢  | 🟢  | 🟢  |   🟢   | 🟢  | Three-page (Admin, Books, API Docs); paired with `admin-portal-api` via `siblingApiClient`. Hosting fixes already on `museum-ready/original`: db.json cleanup + localhost:3001→/api/admin-portal URL rewrites. Edit→Delete verified working post the iframe `allow-modals` fix (2026-05-20).                                                                                                                   |
| 3   | shared-counter        | moefingers/JS-Building-a-Shared-Counter-Part-1               | A (static)                   |  🔴  | 🔴  | 🔴  |   🔴   | 🔴  |                                                                                                                                                                                                                                                                                                                                                                                                                |
| 4   | interactive-map       | moefingers/JS-Making-an-Interactive-Map                      | A (static)                   |  🟢  | 🟢  | 🟢  |   🟡   | 🔴  | Submodule + recipe + meta done in a parallel session. Hosting fixes: 3s geolocation timeout + LV fallback, Foursquare key redacted (button no-ops gracefully). Schema entry exists but full UX hasn't been re-verified post-meta-sync.                                                                                                                                                                         |
| 5   | jaskis                | moefingers/API-JASKIS                                        | E (backend-only)             |  🟢  | 🟢  | ➖  |   🟢   | 🟢  | Backend-only — surfaced via `/mongo-client` (Mongo-shell port; not /api-client). Museum-side: `src/lib/mongo-shell/{parser,execute}.ts` + `src/app/(museum)/api/mongo-client/exec/route.ts`. Verified end-to-end via Chrome MCP (commit 6f7776e).                                                                                                                                                              |
| 6   | music-tour-api        | moefingers/SQL-Music-Tour-API                                | E (backend-only)             |  🟢  | 🟢  | ➖  |   🟢   | 🟢  | Source-faithful rewrite landed 2026-05-20: 6 tables (bands, events, stages, meet_greets, set_times, stage_events), 15 endpoints across `bands/`, `events/`, `stages/` resource routers — lookups by NAME, mutations by ID. Seed mirrors source seeders verbatim (2 bands, 6 events, 2 stages, junctions). Verified every endpoint via curl.                                                                    |
| 7   | sql-injection-demo    | moefingers/iam-2-sql-injection-demo                          | A (static-copy w/ allowlist) |  🟢  | 🟢  | 🟢  |   🟢   | 🟢  | Full UX port: `museum-ready/original` rewrites form action `/login` → `/api/sql-demo/login-html`. Static-copy with `include: ["index.html", "style.css"]` allowlist. Critical security lockdown: dedicated `sql_demo_runner` Postgres role + `SQL_DEMO_DATABASE_URL` env + `src/lib/db-sql-demo.ts` scoped client. Production-verified all cross-schema exfil paths return permission-denied (commit 1f2cbbf). |
| 8   | rest-rant             | moefingers/rest-rant-monorepo                                | E (backend-only, temp)       |  🟡  | 🟢  | 🟡  |   🟢   | 🟡  | Currently sync.config'd as `backend-only` (museum surfaces the API via `/api-client?api=rest-rant`). CRA frontend recipe deferred — when it lands, swap to `cra-build` recipe per the per-project spec below. Schema needs `pages`/`siblingApiClient` once frontend lands. `/api/rest-rant/` HTML route added for api-client parity with admin-portal.                                                         |
| 9   | rest-rant-ssr         | moefingers/UNLV-rest-rant                                    | E (backend-only)             |  🟢  | 🟢  | ➖  |   🟢   | 🟡  | SSR rewrite lives in `src/app/(ssr)/`; original branch retains the legacy Express+Mongo source as historical record. UX not re-verified this session.                                                                                                                                                                                                                                                          |
| 10  | admin-portal-api      | (paired with admin-portal)                                   | (api-client entry)           |  ➖  | ➖  | ➖  |   🟢   | 🟢  | Backend half of admin-portal pair — source-side metadata flows through admin-portal's row (#2), so Conv/GH/Fix are n/a here. Surface verified via Chrome MCP + curl (every endpoint returns expected JSON or HTML).                                                                                                                                                                                            |
| 11  | milestown             | moefingers/UNLV-MilestO-W-N                                  | A (static)                   |  🔴  | 🔴  | 🔴  |   🔴   | 🔴  | Progression chain: original = milestown, enhanced external = `moefingers.github.io/milestown2/` (source `moefingers/milestown2`), reimagined external = `own3.vercel.app`.                                                                                                                                                                                                                                     |
| 12  | gwhac-a-mole          | moefingers/gwhac-a-mole                                      | B (cra)                      |  🔴  | 🔴  | 🔴  |   🔴   | 🔴  | Strong tag → green (Guacamole) subtitle already applied.                                                                                                                                                                                                                                                                                                                                                       |
| 13  | web-game              | moefingers/js-2-web-game-part-1and2and3 (+ part-4, part-7)   | A (static)                   |  🔴  | 🔴  | 🔴  |   🔴   | 🔴  | 3 source repos correspond to one museum entry — pick latest (part 7).                                                                                                                                                                                                                                                                                                                                          |
| 14  | commerce-array        | moefingers/mp2-ecommerce                                     | C (vite) + D (postPatch)     |  🔴  | 🔴  | 🔴  |   🔴   | 🔴  | Minified bundle has AWS API Gateway URLs that need rewriting to local JSON; existing `scripts/patch-commerce-array.mjs` would be the postPatch.                                                                                                                                                                                                                                                                |
| 15  | enterprize            | moefingers/quirkTruck (shared with quirk-truck)              | A (static)                   |  🔴  | 🔴  | 🔴  |   🔴   | 🔴  | Original is quirk-truck's iframe; reimagined external = `enterprize-pi.vercel.app`.                                                                                                                                                                                                                                                                                                                            |
| 16  | nextjs-dashboard      | —                                                            | (none)                       |  🔴  | 🔴  | 🔴  |   🔴   | 🔴  | Placeholder card explaining the deployment is gone; no source iframe.                                                                                                                                                                                                                                                                                                                                          |
| 17  | art-gallery           | moefingers/UNLV-react-art-gallery                            | B (cra)                      |  🔴  | 🔴  | 🔴  |   🔴   | 🔴  |                                                                                                                                                                                                                                                                                                                                                                                                                |
| 18  | quirk-truck           | moefingers/quirkTruck                                        | B (cra)                      |  🔴  | 🔴  | 🔴  |   🔴   | 🔴  |                                                                                                                                                                                                                                                                                                                                                                                                                |
| 19  | timer-stopwatch       | moefingers/react-timer-stopwatch-v2                          | C (vite)                     |  🔴  | 🔴  | 🔴  |   🔴   | 🔴  |                                                                                                                                                                                                                                                                                                                                                                                                                |
| 20  | food-truck            | moefingers/foodTruckUNLV                                     | A (static)                   |  🔴  | 🔴  | 🔴  |   🔴   | 🔴  | Dead Google Drive URLs for 5 images (3 menu pics + Facebook/Instagram icons), already substituted with local SVGs at `public/originals/food-truck/images/` — these need to land on `museum-ready/original`.                                                                                                                                                                                                    |
| 21  | stock-charts          | moefingers/JS-Stock-Charts                                   | A (static)                   |  🔴  | 🔴  | 🔴  |   🔴   | 🔴  | Verify static — has Chart.js client-side.                                                                                                                                                                                                                                                                                                                                                                      |
| 22  | jacks-paint           | moefingers/UNLV-JS-Jacks-Paint                               | A (static)                   |  🔴  | 🔴  | 🔴  |   🔴   | 🔴  | Vanilla JS + canvas.                                                                                                                                                                                                                                                                                                                                                                                           |
| 23  | copycat               | moefingers/copycatactivity                                   | A (static)                   |  🔴  | 🔴  | 🔴  |   🔴   | 🔴  | HTML/CSS only.                                                                                                                                                                                                                                                                                                                                                                                                 |
| 24  | my-values             | moefingers/My-Values                                         | A (static)                   |  🔴  | 🔴  | 🔴  |   🔴   | 🔴  |                                                                                                                                                                                                                                                                                                                                                                                                                |
| 25  | petfax                | moefingers/PY-PetFax                                         | E (special)                  |  🔴  | 🔴  | 🔴  |   🔴   | 🔴  | Flask app — was pre-built to static; decide approach: keep static snapshot or run Flask at edge.                                                                                                                                                                                                                                                                                                               |
| 26  | python-fundamentals   | moefingers/python-day-3/4/5/9, python_functions_practice\_\* | E (special)                  |  🔴  | 🔴  | 🔴  |   🔴   | 🔴  | Pyodide loads .py files; multiple source repos for one museum entry.                                                                                                                                                                                                                                                                                                                                           |
| 27  | html-css-fundamentals | moefingers/CSS-The-Hacker-Times-Part-1 (and siblings)        | A (static)                   |  🔴  | 🔴  | 🔴  |   🔴   | 🔴  | "Hacker Times" demo is the primary; siblings may need separate entries.                                                                                                                                                                                                                                                                                                                                        |
| 28  | react-exercises       | moefingers/RR-Music-Search (and siblings)                    | B (cra)                      |  🔴  | 🔴  | 🔴  |   🔴   | 🔴  | Needs allow-forms iframe sandbox (already on `OriginalFrame`); music-search uses iTunes API.                                                                                                                                                                                                                                                                                                                   |
| 29  | css-responsive-nav    | moefingers/css-responsive-nav                                | A (static)                   |  🔴  | 🔴  | 🔴  |   🔴   | 🔴  |                                                                                                                                                                                                                                                                                                                                                                                                                |
| 30  | restaurant-menu       | moefingers/html-1-restaurant-menu-activity                   | A (static)                   |  🔴  | 🔴  | 🔴  |   🔴   | 🔴  |                                                                                                                                                                                                                                                                                                                                                                                                                |

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
- **Hosting fixes already applied** (must be brought forward into the source's `museum-ready/original` branch):
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

### music-tour-api

- **Source repo**: `git@github.com:moefingers/SQL-Music-Tour-API.git`
- **Local clone path**: `.sources/SQL-Music-Tour-API/`
- **Submodule target path**: `.sources/SQL-Music-Tour-API`
- **Recipe type**: E (backend-only) — the museum reimplements the Express + Sequelize server as Next.js route handlers; the submodule only contributes its branch/commit + the museum-ready banner.
- **Hosting fixes**: none. The source ran cleanly on Node 16+ for its UNLV submission, but the museum doesn't host the Express server. `museum-ready/original` differs from `original` only by the banner commit.
- **Museum-side surface**: the source's three Express controllers (`bands_controller.js`, `events_controller.js`, `stages_controller.js`) become three Next.js resource routers under `src/app/(museum)/api/music-tour/`:
  - `bands/route.ts` + `bands/[idOrName]/route.ts`
  - `events/route.ts` + `events/[idOrName]/route.ts`
  - `stages/route.ts` + `stages/[idOrName]/route.ts`
  - 15 endpoints total (5 per resource).
- **Source-faithfulness invariants** (preserve when extending):
  - **Lookups by NAME** — `GET /bands/Coldplay` finds by `bands.name`, not `band_id`. Same for events (`events.name`) and stages (`stages.stage_name`).
  - **Mutations by ID** — `PUT /bands/3` and `DELETE /bands/3` take an integer `band_id`. The `[idOrName]` route handles both — `parseInt` distinguishes intent.
  - **LIKE filtering on list endpoints** — `GET /bands?name=jin` uses `ilike(name, '%jin%')`. Empty filter returns everything. Source did the same with Sequelize `Op.like`.
  - **Deep-join GET responses** — `GET /bands/:name` returns `{ ...band, meet_greets: [{ events: ... }], set_times: [{ events: ... }] }`. `GET /events/:name` adds bands + stages to those joins, plus a top-level `stages` array (M:M via `stage_events`).
  - **Response shapes** — POST returns `{ message: "Successfully inserted...", data: <row> }`. PUT/DELETE return `{ message: "Successfully ${verb} ${n} ${noun}(s)" }`. Errors return a plain string with status 500 (source idiom).
- **Schema** (faithful to source's six Sequelize models, SMALLINT primary keys, `timestamps: false`):
  ```
  bands(band_id, name, genre, available_start_time, end_time)
  events(event_id, name, date, start_time, end_time)
  stages(stage_id, stage_name)
  meet_greets(meet_greet_id, event_id FK, band_id FK, meet_start_time, meet_end_time)
  set_times(set_time_id, event_id FK, stage_id FK, band_id FK, start_time, end_time)
  stage_events(stage_events_id, stage_id FK, event_id FK)
  ```
- **Expected `sync.config.ts` entry**:
  ```ts
  "music-tour-api": {
    type: "backend-only",
    from: ".sources/SQL-Music-Tour-API",
  }
  ```
- **Seed**: `pnpm seed:music-tour` mirrors the source's `seeders/` verbatim — 2 bands (ids 69, 420), 6 events (ids 1, 2, 3, 7, 8, 9), 2 stages (ids 80, 90), plus 6 meet_greets / 6 set_times / 4 stage_events cross-references. Bumps each smallserial sequence past the seeded ids so subsequent POSTs don't collide.
- **Verification**: at minimum, `curl /api/music-tour/bands` returns both seeded bands; `curl '/api/music-tour/bands/Jingle%20Jongle'` returns the band with non-empty `meet_greets` and `set_times` arrays.

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
  - **Source-level** (apply to `museum-ready/original` branch):
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
- **Hosting fixes already applied** (to apply on `museum-ready/original`):
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
2. Apply any drift back to source's `museum-ready/original` branch.
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
□ git checkout -b museum-ready/original from main
□ Add .nvmrc with "20" (or current LTS)
□ Floor test: pnpm install && pnpm run build (skip if Type A)
□ Walk escalation ladder if floor test fails; apply minimum change
□ Switch to pnpm (pnpm import or pnpm install; rm package-lock.json)
□ Apply documented source-level fixes (see project's "Hosting fixes" above)
□ Verify build (or static content) matches current public/originals/<slug>/
□ Commit + push origin museum-ready
□ Back in museum: rm -rf .sources/<repo> (the plain clone)
□ git submodule add -b museum-ready/original <url> .sources/<repo>
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
