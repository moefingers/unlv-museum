# Architecture

## Overview

UNLV Museum is a portfolio showcase of academic projects from UNLV's software development course, rebuilt across three tiers: original, remastered, and reimagined.

Deployed to `unlv-museum.infinite-syndicate.com` as a separate Vercel project with an explicit DNS CNAME overriding infinite-syndicate's wildcard.

## Three-Tier System

- **Original**: preservation. Only breaking fixes, Next.js compatibility ports, auth, and rate limiting are allowed. Nothing else changes — the goal is to show coursework as it was. Served as static HTML via self-hosted iframes (CRA/Vite apps rebuilt with `PUBLIC_URL=.` and `HashRouter` for iframe compat), or as Next.js SSR ports for projects that were originally server-rendered.
- **Remastered**: stays true to the original, beautified and enhanced in every regard. Scope is small and additive — e.g. adding a leaderboard to gwhac-a-mole counts as remastered, not reimagined. Each remastered should be discussed with the user before building. Bulk generation is forbidden; AI-generated bulk remastereds were called "slop" and removed.
- **Reimagined**: total rebuild with bells and whistles. Redesigned UX, new modes, new graphics, WebGL, etc. Each reimagined gets its own dedicated dev session to brainstorm and optimize — not built incrementally alongside other work, never bulk-generated.

**Practical rule:** by default, both remastered and reimagined for a project are `<Placeholder label="Coming soon" />` until they get their own dev session. The originals stand alone.

## Globe Landing Page

3D CSS sphere using `preserve-3d` transforms. Cards distributed via Fibonacci sphere algorithm, positioned with `rotateY(lon) rotateX(-lat) translateZ(radius)`.

Key implementation details:

- `preserve-3d` chain must be unbroken from the perspective root to every leaf element that uses `translateZ`
- Cards have stacked depth layers behind them (each slightly larger) for a 3D extrusion effect
- iOS-style momentum physics: exponential velocity decay (600ms time constant), EMA velocity tracking, pole bounce reflection
- 18° axial tilt via a separate wrapper div (not in the rotation transform)

## Project Registry

All projects defined in `src/lib/projects.tsx`. Each project has: slug, title, description, year, category, tech arrays, and three ReactNode tiers (original, remastered, reimagined).

Categories: games, full-stack, frontend, api, python, exercises.

## Database

Neon PostgreSQL with per-project schemas:

- `public` — reserved for auth tables (Better Auth)
- `gwhac_a_mole`, `rest_rant`, `commerce`, `enterprize`, `divvy`, `music_tour`, `petfax`, `stock_charts`, `github_commits` — project-specific

Drizzle ORM with `@neondatabase/serverless` HTTP driver (no transactions needed).

## Special Cases

- **MilestO-W-N**: original → milestown2 (remastered) → OWN3 external link (reimagined)
- **EnterPrize**: QuirkTruck (original) → EnterPrize early (remastered) → enterprize-pi.vercel.app (reimagined)
- **Python projects**: Pyodide WebAssembly for in-browser execution
- **Backend-only projects**: ApiExplorer component (mini-Postman UI) with real Neon-backed endpoints
