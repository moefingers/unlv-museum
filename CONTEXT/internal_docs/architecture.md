# Architecture

## Overview

UNLV Museum is a portfolio showcase of academic projects from UNLV's software development course, rebuilt across three tiers: original, enhanced, and reimagined.

Deployed to `unlv-museum.infinite-syndicate.com` as a separate Vercel project with an explicit DNS CNAME overriding infinite-syndicate's wildcard.

## Three-Tier System

The tiers differ in what they preserve, who wrote them, and where they live. The rule that decides "where they live" is **a tier lives where its dependencies live** — see [sources.md § Tier ownership model](sources.md#tier-ownership-model) for the dependency-graph test that makes this rule falsifiable rather than stylistic.

### Original — preservation

Goal: render the coursework as visitors should see it. Source code edits are scoped to **hosting compatibility only**: dead URL substitution, iframe sandbox fixes, asset path corrections, `PUBLIC_URL`/HashRouter swaps for static hosting, Next.js SSR ports for projects that were originally server-rendered.

The build pipeline (Node, package manager, framework version, dev tooling) MAY be modernized on each source repo's `museum-ready/original` branch as long as the rebuilt output is functionally and visually equivalent. See [sources.md](sources.md) for the full preservation policy. The contract: `museum-ready/original` must build cleanly on a currently-supported Node LTS.

**Where it lives:** submodule at `.sources/<repo>/` pinned to `museum-ready/original` branch SHA. Built artifact is committed to `public/originals/<slug>/` and iframe-served.

### Enhanced — enhanced but faithful

Stays true to the original's spirit, beautified and enhanced in every regard. Scope is small and additive — e.g. adding a leaderboard to gwhac-a-mole counts as enhanced, not reimagined. Each enhanced requires a **dedicated decision-and-build session with the user**. Bulk generation is forbidden; the museum's first round of AI-generated enhanceds were called "slop" and removed.

**Where it lives:** native in the museum, alongside everything else we write. Usually `src/components/enhanced/<Slug>.tsx`, or a Next.js route in `src/app/(museum)/...` or `src/app/(ssr)/...` for SSR-style enhanceds. No submodule plumbing — the enhanced imports museum primitives (zcanon tokens, SiblingRail, ProjectChrome, React 19, Next.js), so its canonical home is necessarily here. A `museum-ready/enhanced` branch on the source repo would carry inert code — see [sources.md § Why no museum-ready/enhanced submodule branch](sources.md#why-no-museum-readyenhanced-submodule-branch).

Escape hatch: `enhancedExternal: "https://..."` on the project entry, for the rare case where enhanced work needs to live in a separate deployment (different stack, pre-existing standalone project).

### Reimagined — dedicated rebuild

Total rebuild with bells and whistles. Redesigned UX, new modes, new graphics, WebGL, separate deployment. Each reimagined gets its own dedicated dev session to brainstorm and optimize.

**Where it lives:** separate repo with its own Vercel deployment. The museum entry references it via `reimaginedExternal: "https://..."`. Existing examples: `own3.vercel.app` (reimagined of milestown), `enterprize-pi.vercel.app` (reimagined of quirk-truck).

### Practical defaults

Until a enhanced or reimagined has been built deliberately for a project, the tier renders as `<Placeholder label="Coming soon" />`. Most projects sit there indefinitely; the museum's primary value is the originals.

The `original` tier may also be undefined (e.g., the `rest-rant-ssr` entry has no `original` because its SSR architecture couldn't be statically iframe-hosted). The page renderer disables tier toggles for missing tiers.

## Globe Landing Page

SVG icosphere with quaternion-driven rotation. The user can drag to spin, hover or tap vertices to engage projects, and click to anchor — which swings the chosen vertex to a fixed screen position and unfolds a hexagonal billboard out of it.

Implementation is split across the landing surface ([landing.md](landing.md)) and the globe itself ([globe.md](globe.md)). Sub-systems with their own docs:

- [globe.md](globe.md) — the icosphere, quaternion math, hook composition, rAF orchestrator, pointer routing.
- [anchor-phase.md](anchor-phase.md) — the multi-phase state machine for the click-to-anchor choreography.
- [hover-crosshair.md](hover-crosshair.md) — opt-in touch interaction where each finger is a hover cursor (vs. a drag-grab), including multi-finger lift hesitation.
- [landing.md](landing.md) — the front-page composition: globe/list switcher, URL state, breathing-mesh background, corner controls, viewport-aware framing.

The previous CSS-3D + Fibonacci-sphere implementation was rewritten as the click-to-anchor + hex-billboard interaction was added — arbitrary-axis rotation around a clicked vertex doesn't compose cleanly with the CSS-3D approach.

## Project Registry

All projects defined in `src/lib/projects.tsx`. Each project has: slug, title, description, year, category, tech arrays, and three ReactNode tiers (original, enhanced, reimagined).

Categories: games, full-stack, frontend, api, python, exercises.

## Route Shapes

Every museum URL falls into one of three shapes. The distinction matters because it controls what the URL means — whether it identifies a project, contains projects, or is a shared viewer hosting them.

### Project route — one URL, one project

The default. A single project at a top-level slug, with its own `/[project]`, `/[project]/enhanced`, `/[project]/reimagined` pages rendered by `ProjectChrome`. The URL identifies the project.

Examples: `/interactive-map`, `/food-truck`, `/milestown`, `/quirk-truck`.

Each has a `PROJECTS` entry whose slug matches the URL segment 1:1. The slug is curatorial (chosen for the museum), not derived from the source repo name — see the convention discussion in [sources-conversions.md](sources-conversions.md).

### Container route — shared prefix, distinct leaves

A URL prefix groups several sibling projects, each of which has its own sub-route and its own tiers. The container has an optional landing page; the leaves are real project routes underneath it.

Examples (planned, not yet implemented): `/react-exercises/music-search`, `/react-exercises/montys-mineral-spa`, `/react-exercises/bootstrap`, `/react-exercises/stylesheets`. The `/react-exercises` segment surfaces sibling discoverability via a side-nav (matching api-client's left rail pattern); each leaf is its own museum entry with its own original/enhanced/reimagined.

Container routes exist when several projects share genuine lineage — a series of labs working through the same library, multiple parts of one game progression — and visitors benefit from seeing the siblings as siblings rather than scattered across the landing page. They are **not** rollups. Each leaf has its own `PROJECTS` entry, its own slug, its own tier work; the container is purely a navigation surface.

The opposite of a container is a rollup: one `PROJECTS` entry standing in for many repos. Rollups are forbidden because they force the per-repo tier model into a single shared decision (see the slug-split rationale).

### Viewer route — one URL, many projects, one shared frontend

A single museum route renders many projects' data through a shared client. The viewer is **not a project** — it's a museum-level route that happens to host them. The hosted projects are query-param-selected sub-views of the same chrome.

Example: `/api-client` (and `/api-client/reimagined`). Each backend project — `music-tour-api`, `jaskis`, `admin-portal-api`, `rest-rant` (API only), `sql-injection-demo` — has a `PROJECTS` entry whose `original` field is `<ApiOriginal startWith="…" />`, which redirects to `/api-client?api=<id>`. The api-client itself is one route, one component, one shared request-builder UI. The project entries are real museum entries; the viewer is shared infrastructure.

The distinguishing test: **does the URL change when you switch between the projects it hosts?**

- Project routes: yes — `/food-truck` ≠ `/interactive-map`.
- Container routes: yes — `/react-exercises/music-search` ≠ `/react-exercises/bootstrap`.
- Viewer routes: not as path, only as query param — `/api-client?api=music-tour` vs `/api-client?api=jaskis`. The hosting frontend doesn't re-mount.

Viewer routes exist when the projects truly share a frontend by nature — they are different backends explored through the same Postman-style UI. A category of projects that all happen to be CRA apps does not warrant a viewer route, because their frontends are independent; they get project routes or a container route.

`/api-client` is currently the only viewer route. If another arises (e.g. a shared Pyodide REPL hosting multiple Python projects under one viewer), it follows the same rules: viewer is not in `PROJECTS`, hosted projects are, viewer redirects bare URL to first hosted project's query param.

## Front+back pairing convention

A project that ships **both a public frontend AND a poke-able JSON backend** gets two museum entries, one per surface, paired bidirectionally. The frontend lives at `/<slug>` (project route, iframe-served original or `pages`). The backend lives at `/api-client?api=<slug>` (viewer route). Each entry has its own slug, its own `original`/`enhanced`/`reimagined` tiers, its own conversion lifecycle.

The pairing is declared via two mirrored fields on `Project`:

| Side     | Field set          | Value                                   |
| -------- | ------------------ | --------------------------------------- |
| Frontend | `siblingApiClient` | api-client's slug (e.g. `admin-portal`) |
| Backend  | `siblingFrontend`  | frontend's slug (e.g. `admin-portal`)   |

Example pair: `admin-portal` (frontend, `/admin-portal`, three iframe-served HTML pages) ↔ `admin-portal-api` (backend, `/api-client?api=admin-portal`, the Express server reimplemented as Next.js `/api/admin-portal/*`).

`ProjectChrome` renders the frontend → backend cross-link in the notes panel ("Try the live API") alongside the GitHub source links. The backend → frontend direction is symmetric in the schema but the api-client UI does not yet render it — that's UI work pending. Until then, populate `siblingFrontend` if you want the schema to be honest, but visitors only see the frontend → backend hop today.

When the api-client UI gains the affordance, no schema change is needed — the resolver in `projects.tsx` already handles both directions.

The contract is the same one that makes container routes work: per-surface tier work + a navigation affordance, not a rollup. A rollup ("this one entry is both the frontend and the backend") forces the per-tier decisions (original vs enhanced vs reimagined) into a single shared track, which doesn't match how the surfaces actually evolve.

## Database

Neon PostgreSQL with per-project schemas:

- `public` — reserved for auth tables (Better Auth)
- `gwhac_a_mole`, `rest_rant`, `commerce`, `enterprize`, `divvy`, `music_tour`, `petfax`, `stock_charts`, `github_commits` — project-specific

Drizzle ORM with `@neondatabase/serverless` HTTP driver (no transactions needed).

## Special Cases

- **MilestO-W-N**: original → milestown2 (enhanced) → OWN3 external link (reimagined)
- **EnterPrize**: QuirkTruck (original) → EnterPrize early (enhanced) → enterprize-pi.vercel.app (reimagined)
- **Python projects**: Pyodide WebAssembly for in-browser execution
- **Backend-only projects**: ApiExplorer component (mini-Postman UI) with real Neon-backed endpoints
