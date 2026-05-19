# Rate Limiting

Two layers, vendor-blessed where possible. Mirrors zcanon's [rate-limiting doc](../../../zcanon/CONTEXT/internal_docs/rate-limiting.md) — the museum is a smaller scope, so Upstash isn't yet pulled in. Architecture room is left for it if traffic warrants.

## Layer 1: Vercel WAF (`@vercel/firewall`)

Infrastructure-level. Runs before function code. Counters managed by Vercel, per-region (approximation, not exact global counting).

**Setup (REST API — canonical, reusable):**

```powershell
$token = [Environment]::GetEnvironmentVariable("VERCEL_SUPER_TOKEN", "User")
$projectId = "prj_Ad83s0e9gKdaNNoHWFMlNFAQvjwA"
$teamId = "team_AhVb8lmk2DsLbBxJ6ZBqW7Iq"

$body = @{
  action = "rules.insert"
  id = $null
  value = @{
    name = "Museum API rate limit"
    description = "Per-IP rate limit on /api/* via @vercel/firewall SDK"
    active = $true
    conditionGroup = @(
      @{ conditions = @(
        @{ type = "rate_limit_api_id"; op = "eq"; value = "museum-api" }
      ) }
    )
    action = @{
      mitigate = @{
        action = "rate_limit"
        rateLimit = @{ algo = "fixed_window"; window = 60; limit = 120; keys = @("ip") }
      }
    }
  }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod `
  -Uri "https://api.vercel.com/v1/security/firewall/config?projectId=$projectId&teamId=$teamId" `
  -Method Patch -Headers @{ Authorization="Bearer $token"; "Content-Type"="application/json" } `
  -Body $body
```

**Code (route handler, mutation routes only — reads are unmetered at Layer 1 for now):**

```typescript
import { checkRateLimit } from "@vercel/firewall";

const { rateLimited } = await checkRateLimit("museum-api", { request });
if (rateLimited) {
  return new Response("Too many requests", { status: 429 });
}
```

**Key selection:** Default to client IP (via Vercel's `x-real-ip` header). Authenticated users could later get a higher-budget bucket via `rateLimitKey: userId` — not yet implemented; do this when abuse appears.

**Local dev:** `checkRateLimit` is a no-op when `NODE_ENV !== "production"`. Returns `{ rateLimited: false }`. No Vercel infrastructure needed locally.

**Caveat:** Counters are per-region. A user hitting multiple regions can exceed the global limit while staying under the per-region one. Acceptable for the museum.

## Layer 2: Better Auth built-in

Auth-route rate limiting. Configured in `src/lib/auth.ts` with `storage: "database"`.

Covers `/api/auth/*` — sign-in, sign-up (n/a here — GitHub-only), OAuth callback. Stops brute force / enumeration on the auth surface.

**Critical:** Must set `storage: "database"` on Vercel. Default `"memory"` resets on every cold start, making it useless for serverless. The single most important config knob in the auth setup.

Per-path windows (defaults from Better Auth, kept conservative):

| Path                                   | Window | Limit |
| -------------------------------------- | ------ | ----- |
| `/sign-in/social` (GitHub OAuth start) | 60s    | 20    |
| `/callback/github`                     | 60s    | 20    |
| `/sign-out`                            | 60s    | 20    |
| `/session`                             | 60s    | 100   |

These match zcanon's pattern. Tune only with reason and incident data.

## Layer 3: Upstash Redis — Not Yet

For globally exact counters, sliding-window algorithms, or routes where Postgres writes would be too expensive. **Not implemented.** WAF + Better Auth cover current museum needs.

Add it when:

- We see per-region WAF approximation actually causing problems (limit X is being exceeded N× because users hit multiple regions)
- We want to return `X-RateLimit-Remaining` / `Reset` headers (WAF SDK returns only the boolean)
- We add a route that gets hammered hard enough that Postgres writes for limit counting become hot

Setup will follow OutlastSite's pattern in `lib/rate-limit.ts` when this lands.

## Decision Guide

| Scenario                              | Layer                                      |
| ------------------------------------- | ------------------------------------------ |
| Mutation routes on the public API     | WAF (`@vercel/firewall`), key by IP        |
| `/api/auth/*` paths                   | Better Auth built-in (database storage)    |
| Exact global counters, sliding window | Upstash `@upstash/ratelimit` (when needed) |
| Bot detection (not rate limiting)     | Vercel BotID (when needed)                 |

## What stays unmetered

- All GET endpoints (read-only). The museum is meant to be browsable; rate-limiting reads punishes legitimate exploration.
- The api-client UI itself (it's a static page; no rate limit needed).
- The originals (`/originals/...`) — static files served by Vercel's CDN.
- Banner endpoints (`/github-banners/<slug>`) — cached via `s-maxage`; rate-limiting their misses provides little protection.

If a GET endpoint starts taking measurable abuse, that's the moment to revisit, not before.
