# Security Plan

## Overview

The museum has two attack surfaces:

1. **Frontend interactions** — reimagined projects with database mutations (leaderboards, reviews, CRUD)
2. **Public API endpoints** — the ApiExplorer exposes real REST endpoints that external tools (Postman, curl) can hit

Both need authentication and rate limiting to prevent abuse.

## Authentication

Port Better Auth from zcanon. The museum needs:

- **Email + password signup/login** — same as zcanon, using emailOTP for verification
- **Google OAuth** — optional, reduces friction
- **Session cookies** — `better-auth.session_token`, cross-subdomain for `*.infinite-syndicate.com`
- **Session-gated mutations** — all POST/PUT/DELETE endpoints require a valid session

### What requires auth

- Writing reviews (rest-rant reimagined)
- Submitting leaderboard scores (gwhac-a-mole reimagined)
- Creating/updating/deleting any database record via API
- All POST/PUT/DELETE on `/api/*` routes

### What stays public

- All GET endpoints (read-only data is fine without auth)
- All original tier content (static HTML, no mutations)
- All remastered tier content (client-only, no server calls)
- The landing page and globe

## Rate Limiting

Port the rate limiting pattern from zcanon:

- **Database-backed** — `rateLimit` table in the `public` schema
- **30 requests per 60 seconds per IP** for write endpoints
- **Fail-open** — if the rate limit check fails (DB down), allow the request
- Applied via middleware or per-route checks on mutation endpoints

## API Token Access

For external API consumers (Postman, scripts, bots):

- **Option A**: IP-based rate limiting only, no token required for GET, session required for writes
- **Option B**: Personal Access Tokens (PAT) like zcanon — users generate tokens after login, use `Authorization: Bearer <token>` header

Start with Option A. Upgrade to Option B if abuse occurs.

## Implementation Order

1. Add Better Auth (auth schema in `public`, login/signup pages)
2. Add session checks to all mutation API routes
3. Add rate limiting table and middleware
4. Gate reimagined mutation UIs behind session (show login prompt if not authenticated)

## What NOT to do

- Don't gate read-only content behind auth — the museum should be browsable without an account
- Don't require auth for the original or remastered tiers
- Don't add auth complexity to the globe or landing page
- Don't rate limit GET requests (only mutations)
