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

## Deploy-Time Gotcha: Sensitive Env Vars Need a Fresh Build

Vercel's **sensitive** env vars are baked into each deploy at build time — existing deploys do NOT pick up new values added afterwards. If you push auth code and _then_ push env vars via `pnpm vercel:env push`, the running deploy will still throw `BetterAuthError: You are using the default secret` because `process.env.BETTER_AUTH_SECRET` was undefined when that build's environment was sealed.

**Fix:** push an empty commit (or any commit) after the env vars land. Vercel will build a fresh deploy with the new env, and Better Auth will resolve the secret correctly.

This bit us once during the auth rollout — flagging it here so future env additions follow the order:

1. Add the env var to `.env.local`
2. `pnpm vercel:env push --yes`
3. Push a commit (any) to trigger a fresh deploy

If sensitive isn't required, mark the env var as `encrypted` instead (`# @vercel: type=encrypted target=...` annotation) — those are readable at runtime by Vercel's runtime and don't require a rebuild.

## GitHub OAuth App

- Application name: **UNLV Museum**
- Client ID: `Ov23lihWCteko6FLX5Ry` (public — fine to commit)
- Client secret: `.env.local` only, never committed
- Authorization callback URLs:
  - `https://unlv-museum.recanon.com/api/auth/callback/github` (production)
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
- `trustedOrigins`: the production domain, plus any localhost or private-network `Origin`, plus `https://*-<VERCEL_SCOPE>.vercel.app` when `VERCEL_SCOPE` is set. Both extras apply on production too, which is too wide: [#11](https://github.com/moefingers/unlv-museum/issues/11) narrows them

## Sign-In Surface

Two entry points:

1. **Header chip** — a small "Sign in with GitHub" button in the museum-wide header (top right). Visible at all times when signed out; shows the user's avatar + verified badge when signed in. Clicking the avatar opens a popover with "Sign out" and "Profile" links.
2. **Action-gated modal** — when a signed-out user clicks an action that requires auth (e.g. "Add book" on admin-portal-v2), a modal pops with "Sign in with GitHub to add a book" + the same button. Modal closes on successful auth and re-attempts the original action.

Both routes call `authClient.signIn.social({ provider: "github", callbackURL: <current page> })`.

## Authentication by Environment

| Feature               | localhost    | LAN IP       | Vercel preview | Production | Chrome MCP         |
| --------------------- | ------------ | ------------ | -------------- | ---------- | ------------------ |
| GitHub OAuth (direct) | No — on prod | No — on prod | No — on prod   | Yes        | No (bot detection) |
| PAT (POST → cookie)   | Yes          | Yes          | Yes            | Yes        | Yes (primary)      |
| WAF rate limiting     | No-op        | No-op        | Active         | Active     | Same as env        |

**GitHub sign-in runs on production only.** Elsewhere the sign-in chip sends the browser to the same page on production; to be signed in on the other origin itself, use a PAT. See §Sign-in off production.

This diverges from zcanon/OutlastSite, which use Google. Google allows multiple callbacks and has a localhost-port-agnostic exemption, so their gate is "localhost direct, others relay."

Chrome MCP and other automated browsers use **PAT** because OAuth flows trip bot detection — see §PAT. PAT is also the only way to sign in locally without internet connectivity to production.

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

## Sign-in off production

GitHub sign-in runs on production only. Elsewhere (Vercel previews, LAN IPs, localhost) the sign-in chip sends the browser to the same page on `https://unlv-museum.recanon.com`, where it can sign in. To be signed in on the other origin itself, use a PAT (§PAT): Chrome MCP, automated tests and local work all do.

**There is no OAuth relay (removed 2026-11-14).** The museum used to relay sign-in through production: `/auth/relay` → GitHub → `/auth/relay/complete`, which minted an HMAC-signed "claim" and redirected it to `/auth/claim` on the other origin, which exchanged it at `/api/auth/claim/session` for a session. All of it is gone, the claim endpoint included, because a claim was a bearer sign-in:

- **Wherever the relay delivered it, a claim could be stolen.** The callback check once trusted any `*.vercel.app`, `*.vercel.dev` or `*.vercel.sh` host, where anyone can make a free host. A developer's own `next dev` relay delivered to any machine on their network over plain http. And the claim page followed any `callbackURL`, `javascript:` included. Each way, one link could hand a stranger the session of whoever followed it.
- **Anyone holding the signing secret could mint one** for any user, the admin included, without signing in at all.
- **It was reusable:** no audience, no nonce, no single use, for its whole minute.

GitHub sign-in off production returns only with an attested relay (OutlastSite's or zcanon's design: the callback host proven by a Vercel OIDC token, the claim a single-use database row bound to the browser that started it). [#13](https://github.com/moefingers/unlv-museum/issues/13) lists what it must do.

**Where a browser may go after sign-in** (`isTrustedCallbackUrl` in `src/lib/callback-validation.ts`, used by `/auth/redirect`): `unlv-museum.recanon.com` over https, and localhost or the private network in local development only (`next dev`, not on a Vercel deployment).

**Secrets.** Production's `BETTER_AUTH_SECRET` is production's alone: it signs Better Auth's session cookie cache, so whoever holds it can sign in to production as anyone. Preview has its own value on Vercel. Development has none there: put your own random value in `.env.local` (`openssl rand -base64 32`), and if yours is production's (the old setup asked for that), replace it. `pnpm vercel:env push` never pushes this key (`BUILTIN_SKIP_KEYS` in `scripts/vercel-env.ts`), and it leaves alone any key with more than one entry on Vercel, so a laptop's value can't reach production that way.

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

Single-domain only. The museum cookie is set on `unlv-museum.recanon.com` (production) or `localhost:3000` (dev). **No `.recanon.com` parent-domain cookie** — sibling projects under that subdomain don't share auth with the museum. Each project that wants its own auth runs its own Better Auth.

### Defense: `cookiePrefix: "museum"`

`advanced.cookiePrefix` in `src/lib/auth.ts` prefixes every Better Auth cookie with `museum.` — so the session cookie is `museum.session_token` instead of the default `better-auth.session_token`. This is **defensive against sibling-project cookie leak**: if another project on `*.recanon.com` (mistakenly) sets `better-auth.session_token` with `domain=.recanon.com`, the browser will deliver that cookie to the museum too. Better Auth would then read a cookie signed with a foreign secret, fail to validate it, and behave erratically.

The prefix makes our cookies un-collidable with any unprefixed Better Auth installation. If a sibling project also adopts a unique prefix (`zcanon.`, `outlast.`, etc.), the defense is symmetric.

### Symptom of collision

User signs in successfully (OAuth callback runs, server creates session row), but the SignInChip continues to show "Sign in" instead of the avatar. `/api/auth/get-session` returns `null` despite the database having a valid session. Clearing all cookies for `recanon.com` in the browser restores the sign-in.

If you see this, audit sibling projects for parent-domain cookies (`domain=.recanon.com`). The museum's cookies are already scoped correctly; the leak is from _into_ us, not _out of_ us.

## Files

| File                                          | Purpose                                                                    |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| `src/lib/auth.ts`                             | Better Auth instance, GitHub provider, rate-limit config, `patAuth` plugin |
| `src/lib/auth-client.ts`                      | Browser-side Better Auth client (sign in / sign out / useSession)          |
| `src/lib/user-audit.ts`                       | `emitUserAudit()` event emitter                                            |
| `src/lib/schema/auth.ts`                      | Drizzle schema for `auth.*` tables                                         |
| `src/lib/pat-plugin.ts`                       | Better Auth plugin: `/pat/session`                                         |
| `src/lib/callback-validation.ts`              | Where `/auth/redirect` may send a signed-in browser                        |
| `src/app/(museum)/api/auth/[...all]/route.ts` | Better Auth's catch-all route handler                                      |
| `src/app/(museum)/auth/redirect/page.tsx`     | Generic post-auth landing                                                  |
| `src/app/(museum)/api/whoami/route.ts`        | Auth smoke-test endpoint                                                   |
| `src/components/auth/SignInChip.tsx`          | Header chip — sign in / avatar + verified badge                            |
| `scripts/generate-pat.ts`                     | `pnpm pat:generate` PAT minter                                             |

## What we explicitly skip from zcanon

The following patterns are documented in zcanon's auth doc but **do not apply** to the museum:

- **Multi-tenant cookies** (`crossSubDomainCookies: ".recanon.com"`) — sibling projects have their own auth
- **`organization` plugin** — no orgs in the museum
- **`admin` plugin's impersonation** — no admin role yet (could add later)
- **Email/password** — GitHub-only suffices
- **Customer portals** — no clients
- **Sign-in lockout / preregistration** — single-operator, no abuse vectors yet
- **Tenant-routing on `/auth/redirect`** — no orgs, just a simple safe-default redirect

Each of these is straightforward to add if the museum's scope changes; this list exists so a future engineer knows they're skipped on purpose, not by accident.
