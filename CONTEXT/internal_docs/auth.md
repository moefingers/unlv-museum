# Auth — Better Auth + GitHub OAuth

The museum uses Better Auth with **GitHub OAuth as the only provider**. Sign-in is optional for browsing, required for any endpoint that mutates state. Authored audit logs across the museum FK to `auth.user(id)`.

For broader Better Auth philosophy and patterns that don't apply here (multi-tenant orgs, impersonation, PAT, customer portals, email/password, OAuth relays), see [zcanon's auth doc](../../../zcanon/CONTEXT/internal_docs/auth.md). This file documents what's specific to the museum.

## Why GitHub-only

The museum is a development-oriented artifact — visitors are likely developers who already have a GitHub. Tying authorship in audit logs to `github.login` makes contributions feel communal (e.g. "moefingers added 'Warp Speed'"), and it cleanly opens the door to later wiring GitHub stats where they're relevant (e.g. "verified contributor — has X public repos"). Email/password would land a heavier flow for no real lift in trust signal. OAuth relays / multi-provider trees can be added later if needed.

## Decisions, recorded

| Decision        | Choice                       | Why                                                   |
| --------------- | ---------------------------- | ----------------------------------------------------- |
| Provider        | GitHub only                  | Audience fit; communal authorship                     |
| Library         | Better Auth                  | Matches zcanon + OutlastSite; one mental model        |
| Session storage | Database (Neon Postgres)     | Serverless-safe; survives cold starts                 |
| Cookie scope    | Museum domain only           | No sibling projects share the museum's DB             |
| Identity DB     | Same Neon project as museum  | All inline reimagined projects share `auth.*` via FKs |
| Sign-in surface | Header chip + action-gated   | Visible, but doesn't gate browsing                    |
| Verified badge  | `auth.user.verified` boolean | Unlocks full features per-project                     |

## Architecture

```
unlv-museum (Neon project)
├── auth.*          ← Better Auth's tables (user, session, account, verification, userAuditLog)
├── admin_portal.*  ← v1 original (no auth required; legacy)
└── admin_portal_v2.*  ← reimagined, FKs `created_by → auth.user(id)`
    ... future reimagined projects, same pattern
```

External museum-referenced projects (`own3.vercel.app`, `enterprize.vercel.app`, etc.) are **unrelated** — they have their own auth, their own DBs. The museum just links out to them. No shared identity.

## GitHub OAuth App

- Application name: **UNLV Museum**
- Client ID: `Ov23lihWCteko6FLX5Ry` (public — fine to commit)
- Client secret: `.env.local` only, never committed
- Authorization callback URLs:
  - `https://unlv-museum.infinite-syndicate.com/api/auth/callback/github` (production)
  - `http://localhost:3000/api/auth/callback/github` (local dev)
- Owner: `@moefingers`
- Manage at: https://github.com/settings/developers → OAuth Apps → UNLV Museum

Scope requested: `read:user user:email` (default). The museum never acts on the user's behalf on GitHub — no repo or write scopes.

## Configuration

See `src/lib/auth.ts`. Critical knobs:

- `database`: drizzle adapter pointing at the museum's Neon DB
- `socialProviders.github`: `clientId` + `clientSecret` from env
- `rateLimit.storage: "database"` — required for serverless (default `"memory"` resets on cold start)
- `cookieOptions.domain`: unset (defaults to request host) — no parent-domain games
- `trustedOrigins`: localhost + the production domain. No `*.vercel.app` wildcard — preview deployments are intentionally unauthenticated until the relay pattern is ported (museum doesn't need it yet)

## Sign-In Surface

Two entry points:

1. **Header chip** — a small "Sign in with GitHub" button in the museum-wide header (top right). Visible at all times when signed out; shows the user's avatar + verified badge when signed in. Clicking the avatar opens a popover with "Sign out" and "Profile" links.
2. **Action-gated modal** — when a signed-out user clicks an action that requires auth (e.g. "Add book" on admin-portal-v2), a modal pops with "Sign in with GitHub to add a book" + the same button. Modal closes on successful auth and re-attempts the original action.

Both routes call `authClient.signIn.social({ provider: "github", callbackURL: <current page> })`.

## Authentication by Environment

| Feature               | localhost | LAN IP         | Vercel preview | Production | Chrome MCP         |
| --------------------- | --------- | -------------- | -------------- | ---------- | ------------------ |
| GitHub OAuth (direct) | Yes       | No — via relay | No — via relay | Yes        | No (bot detection) |
| PAT (POST → cookie)   | Yes       | Yes            | Yes            | Yes        | Yes (primary)      |
| WAF rate limiting     | No-op     | No-op          | Active         | Active     | Same as env        |

Three callback URLs registered on the GitHub OAuth App: production, `localhost`, and `127.0.0.1`. Local dev signs in directly. Preview, LAN IPs, and other non-registered origins **relay through production** — see §OAuth Relay. Chrome MCP and other automated browsers use **PAT** because GitHub's OAuth flow trips bot detection — see §PAT.

## Verified-User Signal

`auth.user.verified` is a boolean column on Better Auth's user table. Defaults `false`. Each project decides what "verified" unlocks (e.g. higher rate-limit tier, ability to add books vs only edit). The flag is read off the session.

Initial verification is manual — set via SQL by the museum admin. Future: tie it to GitHub account age + public-repo count, or self-serve via an email confirmation. Until then, anyone gets a session on first sign-in but lands at `verified = false`.

**Important:** `verified` does NOT gate sign-in. Anyone with a GitHub account can sign in; `verified` is a per-project capability flag the routes check.

## Admin Role

`auth.user.role = 'admin'` is intentionally **single-occupant** — the museum's operator (`@moefingers`). There is no user-management UI for promoting/demoting admins; the role is assigned by direct SQL once the operator's user row exists (which happens automatically on their first GitHub sign-in):

```sql
UPDATE auth.user
SET role = 'admin', verified = true
WHERE email = 'mbzuiter@gmail.com';
```

Admin powers (today):

- Toggle other users' `verified` flag (via a dashboard yet to be built)
- Ban / unban users (via the dashboard)
- Read museum-wide audit logs

Admin powers explicitly NOT planned:

- Impersonation (zcanon has it, museum doesn't need it)
- Multi-admin delegation (no team — solo operator)
- User deletion (banning is enough; deletion is a footgun)

If the museum's scope ever grows past one operator, this gets revisited.

## Reading Sessions in Route Handlers

```typescript
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  // session.user.id, session.user.email, session.user.image, session.user.verified
  // ...
}
```

For mutation routes that should require verification:

```typescript
if (!session.user.verified) {
  return new Response("Verified account required", { status: 403 });
}
```

## PAT (Personal Access Tokens — Chrome MCP / Automation)

GitHub's OAuth consent flow trips bot detection when driven by Chrome MCP. PATs bypass OAuth entirely: an authenticated user generates a token via `pnpm pat:generate`, the script inserts a hashed row into `auth.personal_access_token` and writes the raw token to `.env.local` as `PAT_TOKEN`. Automated tools then exchange the token for a session cookie with a single POST:

```typescript
// Chrome MCP: evaluate_script
async () => {
  const res = await fetch("/api/auth/pat/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "museum_<...>" }),
  });
  if (res.ok) window.location.assign("/");
};
```

The endpoint is the `patAuth` plugin's `/pat/session`. On success it creates a real Better Auth session and sets the session cookie; subsequent `auth.api.getSession` calls see the user just like a regular OAuth sign-in. Tokens stay valid until revoked.

**Getting a PAT (prerequisite — user must exist in `auth.user` first):**

1. Sign in once via the museum's regular GitHub flow — this creates the user row
2. Run `pnpm pat:generate` (defaults to `mbzuiter@gmail.com`; pass `--email someone@example.com` for another user)
3. The raw token is appended to `.env.local` as `PAT_TOKEN`. **It is shown once.**

**Flags:**

| Flag      | Default              | Purpose                                        |
| --------- | -------------------- | ---------------------------------------------- |
| `--email` | `mbzuiter@gmail.com` | User to generate the PAT for                   |
| `--env`   | `.env.local`         | Target env file                                |
| `--var`   | `PAT_TOKEN`          | Variable name to write                         |
| `--after` | `BETTER_AUTH_URL`    | Insert after this var (if not already present) |

Tokens are hashed (`sha256(token)` stored in `auth.personal_access_token.token_hash`). The raw token never lives in the database. Revocation is `UPDATE auth.personal_access_token SET revoked_at = now() WHERE id = '<id>'`. There is no token-management UI yet — solo operator, manual revocation works.

## OAuth Relay (Preview / LAN auth)

Non-canonical origins (Vercel preview URLs, LAN IPs, anywhere not in the GitHub OAuth App's registered callback list) can't run GitHub OAuth directly. The relay routes them through production:

1. User on `https://unlv-museum-abc123-team.vercel.app/api-client` clicks Sign in
2. The chip calls `https://unlv-museum.infinite-syndicate.com/auth/relay?callback=https://unlv-museum-abc123-team.vercel.app/auth/claim`
3. `/auth/relay` validates the callback against `isTrustedCallbackUrl`, drops a short-lived `relay-callback` cookie, redirects to `/auth/relay/start`
4. `/auth/relay/start` fires Better Auth's GitHub OAuth flow with `callbackURL=/auth/relay/complete`
5. User authorizes UNLV Museum on GitHub → GitHub redirects to `https://unlv-museum.infinite-syndicate.com/api/auth/callback/github` → Better Auth creates session on production
6. `/auth/relay/complete` reads the `relay-callback` cookie, generates an HMAC-signed claim token (1-minute TTL), redirects to `<preview>/auth/claim?claim=<token>`
7. `/auth/claim` (on the preview origin) POSTs the token to `/api/auth/claim/session` → patAuth plugin's claim endpoint verifies signature, looks up the user, mints a session cookie on the preview origin
8. User lands wherever the original callback pointed (or `/`), signed in

The user sees: sign-in button → GitHub consent → back on their environment, authenticated. No intermediate pages.

**Security:**

- Claim tokens are HMAC-SHA256 signed with `BETTER_AUTH_SECRET` and have a 1-minute TTL
- Callback URLs are validated by `isTrustedCallbackUrl` against the trust ladder in `src/lib/callback-validation.ts` (localhost, RFC 1918 IPs, `unlv-museum.infinite-syndicate.com`, `*.vercel.app|dev|sh`)
- The `BETTER_AUTH_SECRET` must match across production and the local `.env.local` for signatures to verify — same constraint as zcanon

**Files:**

| File                                            | Purpose                                               |
| ----------------------------------------------- | ----------------------------------------------------- |
| `src/lib/claim-token.ts`                        | HMAC sign + verify, 1-minute TTL                      |
| `src/lib/callback-validation.ts`                | Trusted-origin checker                                |
| `src/lib/pat-plugin.ts`                         | Better Auth plugin: `/pat/session` + `/claim/session` |
| `src/app/(museum)/auth/relay/route.ts`          | Validates callback, stashes cookie, forwards          |
| `src/app/(museum)/auth/relay/start/page.tsx`    | Client-fires Better Auth's GitHub flow                |
| `src/app/(museum)/auth/relay/complete/route.ts` | Generates claim token, redirects                      |
| `src/app/(museum)/auth/claim/page.tsx`          | POSTs claim to `/api/auth/claim/session`              |
| `src/app/(museum)/auth/redirect/page.tsx`       | Generic post-auth landing                             |

## Audit Log

`auth.user_audit_log` records identity-surface events (`session.created`, `signin.failed`, `rate_limit.hit`). Project-domain events (`book.created`, `score.submitted`, etc.) live in **each project's own pgSchema audit table**, FK'd to `auth.user(id)`. This keeps the identity log bounded and project audit tables semantically narrow.

### Per-project audit-table shape (canonical)

Every reimagined project that mutates state ships its own `*_audit` table with this exact column set. This locks the shape so a shared read-only `<AuditFeed />` component can render any project's history without per-project glue, and so the "admin page" pattern below is uniform across projects.

```sql
CREATE TABLE "<project>"."audit" (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id text NOT NULL REFERENCES "auth"."user"(id) ON DELETE SET NULL,
  -- Denormalized at write-time so historical entries survive name/avatar
  -- changes (mirrors how Git stores author names per-commit).
  actor_name    text NOT NULL,
  actor_image   text,
  action_type   text NOT NULL,         -- e.g. "book.created", "book.removed"
  target        text NOT NULL,         -- e.g. "book:42"
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON "<project>"."audit" (created_at DESC);
CREATE INDEX ON "<project>"."audit" (actor_user_id, created_at DESC);
```

### "Read-only admin page" pattern

Reimagined projects that have an admin interface (admin-portal-v2, rest-rant-v2, etc.) expose a `/admin` sub-route that any signed-in user can visit. It renders `<AuditFeed projectSchema="...audit" />` showing every mutation to that project. Visitors can _read_ the trail but cannot mutate it — there are no admin-only buttons on this page. It's a transparent "who did what" log, not a moderation surface.

This is intentionally distinct from museum-level admin (`auth.user.role = 'admin'`), which is the only role that can verify/ban users. The two concepts must not be conflated:

| Concept              | Gate                            | Powers                                |
| -------------------- | ------------------------------- | ------------------------------------- |
| Museum admin         | `session.user.role === 'admin'` | Verify users, ban users, system-level |
| Project audit viewer | Any authenticated session       | Read this project's audit log         |

The per-project audit-table shape above is the contract that makes this possible — keep new projects on it from day one.

Helper:

```typescript
import { emitUserAudit } from "@/lib/user-audit";
emitUserAudit({
  eventType: "session.created",
  userId,
  email,
  ipAddress: request.headers.get("x-forwarded-for"),
  userAgent: request.headers.get("user-agent"),
});
```

`emitUserAudit` is try/catch-wrapped — audit-log failures must never break a request.

## Cookie Domain

Single-domain only. The museum cookie is set on `unlv-museum.infinite-syndicate.com` (production) or `localhost:3000` (dev). **No `.infinite-syndicate.com` parent-domain cookie** — sibling projects under that subdomain don't share auth with the museum. Each project that wants its own auth runs its own Better Auth.

## Files

| File                                            | Purpose                                                                    |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| `src/lib/auth.ts`                               | Better Auth instance, GitHub provider, rate-limit config, `patAuth` plugin |
| `src/lib/auth-client.ts`                        | Browser-side Better Auth client (sign in / sign out / useSession)          |
| `src/lib/user-audit.ts`                         | `emitUserAudit()` event emitter                                            |
| `src/lib/schema/auth.ts`                        | Drizzle schema for `auth.*` tables                                         |
| `src/lib/pat-plugin.ts`                         | Better Auth plugin: `/pat/session` + `/claim/session`                      |
| `src/lib/claim-token.ts`                        | HMAC sign + verify for relay claim tokens                                  |
| `src/lib/callback-validation.ts`                | Trusted-origin check for relay callbacks                                   |
| `src/app/(museum)/api/auth/[...all]/route.ts`   | Better Auth's catch-all route handler                                      |
| `src/app/(museum)/auth/relay/route.ts`          | OAuth relay entry                                                          |
| `src/app/(museum)/auth/relay/start/page.tsx`    | Fires the GitHub OAuth flow on production                                  |
| `src/app/(museum)/auth/relay/complete/route.ts` | Generates claim token, redirects to origin                                 |
| `src/app/(museum)/auth/claim/page.tsx`          | Claims session on non-canonical origin                                     |
| `src/app/(museum)/auth/redirect/page.tsx`       | Generic post-auth landing                                                  |
| `src/app/(museum)/api/whoami/route.ts`          | Auth smoke-test endpoint                                                   |
| `src/components/auth/SignInChip.tsx`            | Header chip — sign in / avatar + verified badge                            |
| `scripts/generate-pat.ts`                       | `pnpm pat:generate` PAT minter                                             |

## What we explicitly skip from zcanon

The following patterns are documented in zcanon's auth doc but **do not apply** to the museum:

- **Multi-tenant cookies** (`crossSubDomainCookies: ".infinite-syndicate.com"`) — sibling projects have their own auth
- **`organization` plugin** — no orgs in the museum
- **`admin` plugin's impersonation** — no admin role yet (could add later)
- **Email/password** — GitHub-only suffices
- **Customer portals** — no clients
- **Sign-in lockout / preregistration** — single-operator, no abuse vectors yet
- **Tenant-routing on `/auth/redirect`** — no orgs, just a simple safe-default redirect

Each of these is straightforward to add if the museum's scope changes; this list exists so a future engineer knows they're skipped on purpose, not by accident.
