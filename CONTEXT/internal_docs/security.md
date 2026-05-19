# Security

The security surface splits into two focused docs:

- **Authentication** → [auth.md](auth.md) — Better Auth + GitHub OAuth, session model, sign-in surface, `verified` capability flag, audit log
- **Rate limiting** → [rate-limiting.md](rate-limiting.md) — Vercel WAF + Better Auth built-in, per-path windows, layer-3 (Upstash) deferral criteria

Cross-cutting principles:

- **Don't gate read-only content.** The museum is browsable without an account. GET endpoints stay anonymous.
- **All mutations require a session.** POST/PATCH/DELETE on `/api/*` (and any reimagined-tier mutation surface) check `getSession()` and 401 on absence.
- **Audit attribution is FK'd to `auth.user(id)`.** Project-domain mutations write to a per-pgSchema audit table referencing the actor.
- **Single domain, single cookie.** No `.infinite-syndicate.com` parent-domain cookie. Sibling projects on other subdomains run their own auth.
