# UNLV Museum

## Philosophy

This project inherits zcanon's philosophy. Read these essays — they apply here.

1. [Correctness Over Convenience](../zcanon/CONTEXT/essays/correctness-over-convenience.md#winner-branch-3-refinement-3) — never shortcut a solution because it's faster
2. [The Whole House](../zcanon/CONTEXT/essays/the-whole-house.md#winner) — never suggest reducing scope; build what was asked for

## Before You Start

Read the CONTEXT docs for decisions already made:

- [Architecture](CONTEXT/internal_docs/architecture.md) — three-tier system, project registry, database schemas
- [Globe](CONTEXT/internal_docs/globe.md) — 3D CSS sphere, preserve-3d chain, momentum physics
- [Originals](CONTEXT/internal_docs/originals.md) — fix-only philosophy, common fixes, backend-dependent projects
- [Security](CONTEXT/internal_docs/security.md) — auth plan, rate limiting, API access
- [Database](CONTEXT/internal_docs/database.md) — Neon, Drizzle, per-project schemas

## Quick Reference

- **Package manager:** pnpm (never npm, yarn, or bun)
- **Commands:** `pnpm dev`, `pnpm build`, `pnpm lint`
- **Hooks:** Pre-commit runs lint-staged, pre-push runs build
- **Domain:** `unlv-museum.infinite-syndicate.com`
- **DNS:** Explicit CNAME overrides infinite-syndicate's wildcard. Comment in infinite-syndicate's `src/proxy.ts` documents the carve-out.
- **Database:** Neon project `quiet-cell-88302228`, connection via `DATABASE_URL`

## Key Constraints

- **Originals are read-only.** Fix breaking errors only. Don't modernize, refactor, or improve original code.
- **preserve-3d chain is fragile.** Any element between the perspective root and a `translateZ` leaf must have `transformStyle: preserve-3d`. Test visually after any DOM structure change.
- **Card centering uses fixed pixels** (-88px, -36px), not percentage. Depth layers with negative insets break percentage-based centering.
- **CRA originals need `PUBLIC_URL=.`** when rebuilding. Otherwise asset paths break in the iframe.
- **React 19 lint rules** prohibit `setState` directly in effect bodies. Use callback patterns or move state transitions into event handlers.
