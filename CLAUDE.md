# UNLV Museum

## Philosophy

This project inherits zcanon's philosophy. Read these essays — they apply here.

1. [Correctness Over Convenience](../zcanon/CONTEXT/essays/correctness-over-convenience.md#winner-branch-3-refinement-3) — never shortcut a solution because it's faster
2. [The Whole House](../zcanon/CONTEXT/essays/the-whole-house.md#winner) — never suggest reducing scope; build what was asked for

## Before You Start

Read the CONTEXT docs for decisions already made:

- [Architecture](CONTEXT/internal_docs/architecture.md) — three-tier system, project registry, database schemas
- [Sources](CONTEXT/internal_docs/sources.md) — **REQUIRED before touching `public/originals/` or any source repo.** Submodule pattern, museum-ready branch policy, sync.config.ts recipes, conversion workflow.
- [Sources conversion status](CONTEXT/internal_docs/sources-conversions.md) — per-project tracking and agent-ready conversion specs
- [All-repos audit](CONTEXT/internal_docs/all-repos-audit.md) — canonical 54-repo inventory of UNLV-era work (raw roster; reconciled to museum slugs in sources-conversions.md)
- [Globe](CONTEXT/internal_docs/globe.md) — 3D CSS sphere, preserve-3d chain, momentum physics
- [Auth](CONTEXT/internal_docs/auth.md) — **REQUIRED before touching any mutation route.** Better Auth + GitHub OAuth, session model, verified flag, audit log.
- [Rate limiting](CONTEXT/internal_docs/rate-limiting.md) — Vercel WAF + Better Auth built-in, per-path windows, when to add Upstash
- [Security overview](CONTEXT/internal_docs/security.md) — cross-cutting principles + pointers to auth + rate-limiting
- [Database](CONTEXT/internal_docs/database.md) — Neon, Drizzle, per-project schemas
- [View transitions](CONTEXT/internal_docs/view-transitions.md) — participant inventory, the "stays still" pattern, intentional non-namings
- [Social unfurls](CONTEXT/internal_docs/social-unfurls.md) — **REQUIRED before touching `og:*` / `twitter:*` metadata or `public/og/`.** Per-platform card matrix, the LinkedInBot UA carve-out, ffmpeg `+faststart` requirement, favicon regeneration.

## Quick Reference

- **Package manager:** pnpm (never npm, yarn, or bun)
- **Commands:** `pnpm dev`, `pnpm build`, `pnpm lint`
- **Hooks:** Pre-commit runs lint-staged + verify-locks. Pre-push (a) runs `sync:source-meta` when `projects.tsx` is in the push (so source-repo banners auto-update when tier presence changes), (b) verifies every submodule's HEAD is pushed upstream, (c) runs `pnpm build`. If sync produces submodule pointer bumps, the hook blocks; commit the staged bumps and re-push.
- **Domain:** `unlv-museum.infinite-syndicate.com`
- **DNS:** Explicit CNAME overrides infinite-syndicate's wildcard. Comment in infinite-syndicate's `src/proxy.ts` documents the carve-out.
- **Database:** Neon project `quiet-cell-88302228`, connection via `DATABASE_URL`

## Key Constraints

- **Originals are read-only.** Fix breaking errors only. Don't modernize, refactor, or improve original code.
- **preserve-3d chain is fragile.** Any element between the perspective root and a `translateZ` leaf must have `transformStyle: preserve-3d`. Test visually after any DOM structure change.
- **Card centering uses fixed pixels** (-88px, -36px), not percentage. Depth layers with negative insets break percentage-based centering.
- **CRA originals need `PUBLIC_URL=.`** when rebuilding. Otherwise asset paths break in the iframe.
- **React 19 lint rules** prohibit `setState` directly in effect bodies. Use callback patterns or move state transitions into event handlers.
