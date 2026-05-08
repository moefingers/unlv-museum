# Architecture

## Overview

UNLV Museum is a portfolio showcase of academic projects from UNLV's software development course, rebuilt across three tiers: original, remastered, and reimagined.

Deployed to `unlv-museum.infinite-syndicate.com` as a separate Vercel project with an explicit DNS CNAME overriding infinite-syndicate's wildcard.

## Three-Tier System

- **Original**: preserved source with only breaking fixes. Served as static HTML via self-hosted iframes. Some originals were CRA/Vite apps rebuilt with `PUBLIC_URL=.` and `HashRouter` for iframe compatibility.
- **Remastered**: faithful modern rewrite in TypeScript/React/Tailwind. Same scope as the original, superior execution.
- **Reimagined**: creative expansion reaching canon standards. Database-backed, interactive, with features the original never had.

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
