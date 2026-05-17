# Architecture

## Overview

UNLV Museum is a portfolio showcase of academic projects from UNLV's software development course, rebuilt across three tiers: original, enhanced, and reimagined.

Deployed to `unlv-museum.infinite-syndicate.com` as a separate Vercel project with an explicit DNS CNAME overriding infinite-syndicate's wildcard.

## Three-Tier System

The tiers differ in what they preserve, who wrote them, and where they live.

### Original — preservation

Goal: render the coursework as visitors should see it. Source code edits are scoped to **hosting compatibility only**: dead URL substitution, iframe sandbox fixes, asset path corrections, `PUBLIC_URL`/HashRouter swaps for static hosting, Next.js SSR ports for projects that were originally server-rendered.

The build pipeline (Node, package manager, framework version, dev tooling) MAY be modernized on each source repo's `museum-ready` branch as long as the rebuilt output is functionally and visually equivalent. See [sources.md](sources.md) for the full preservation policy. The contract: `museum-ready` must build cleanly on a currently-supported Node LTS.

**Where it lives:** submodule at `.sources/<repo>/` pinned to `museum-ready` branch SHA. Built artifact is committed to `public/originals/<slug>/` and iframe-served.

### Enhanced — enhanced but faithful

Stays true to the original's spirit, beautified and enhanced in every regard. Scope is small and additive — e.g. adding a leaderboard to gwhac-a-mole counts as enhanced, not reimagined. Each enhanced requires a **dedicated decision-and-build session with the user**. Bulk generation is forbidden; the museum's first round of AI-generated enhanceds were called "slop" and removed.

**Where it lives:** native in the museum, alongside everything else we write. Usually `src/components/enhanced/<Slug>.tsx`, or a Next.js route in `src/app/(museum)/...` or `src/app/(ssr)/...` for SSR-style enhanceds. No submodule plumbing — it's our code, it iterates with the museum.

Escape hatch: `enhancedExternal: "https://..."` on the project entry, for the rare case where enhanced work needs to live in a separate deployment (different stack, pre-existing standalone project).

### Reimagined — dedicated rebuild

Total rebuild with bells and whistles. Redesigned UX, new modes, new graphics, WebGL, separate deployment. Each reimagined gets its own dedicated dev session to brainstorm and optimize.

**Where it lives:** separate repo with its own Vercel deployment. The museum entry references it via `reimaginedExternal: "https://..."`. Existing examples: `own3.vercel.app` (reimagined of milestown), `enterprize-pi.vercel.app` (reimagined of quirk-truck).

### Practical defaults

Until a enhanced or reimagined has been built deliberately for a project, the tier renders as `<Placeholder label="Coming soon" />`. Most projects sit there indefinitely; the museum's primary value is the originals.

The `original` tier may also be undefined (e.g., the `rest-rant-ssr` entry has no `original` because its SSR architecture couldn't be statically iframe-hosted). The page renderer disables tier toggles for missing tiers.

## Globe Landing Page

3D CSS sphere using `preserve-3d` transforms. Cards distributed via Fibonacci sphere algorithm, positioned with `rotateY(lon) rotateX(-lat) translateZ(radius)`.

Key implementation details:

- `preserve-3d` chain must be unbroken from the perspective root to every leaf element that uses `translateZ`
- Cards have stacked depth layers behind them (each slightly larger) for a 3D extrusion effect
- iOS-style momentum physics: exponential velocity decay (600ms time constant), EMA velocity tracking, pole bounce reflection
- 18° axial tilt via a separate wrapper div (not in the rotation transform)

## Project Registry

All projects defined in `src/lib/projects.tsx`. Each project has: slug, title, description, year, category, tech arrays, and three ReactNode tiers (original, enhanced, reimagined).

Categories: games, full-stack, frontend, api, python, exercises.

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
