# Security

The security surface splits into two focused docs:

- **Authentication** → [auth.md](auth.md) — Better Auth + GitHub OAuth, session model, sign-in surface, `verified` capability flag, audit log
- **Rate limiting** → [rate-limiting.md](rate-limiting.md) — Vercel WAF + Better Auth built-in, per-path windows, layer-3 (Upstash) deferral criteria

Cross-cutting principles:

- **Don't gate read-only content.** The museum is browsable without an account. GET endpoints stay anonymous.
- **All mutations require a session.** POST/PATCH/DELETE on `/api/*` (and any reimagined-tier mutation surface) check `getSession()` and 401 on absence.
- **Audit attribution is FK'd to `auth.user(id)`.** Project-domain mutations write to a per-pgSchema audit table referencing the actor.
- **Single domain, single cookie.** No `.infinite-syndicate.com` parent-domain cookie. Sibling projects on other subdomains run their own auth.

## SQL Injection Demo lockdown

`/api/sql-demo` and `/api/sql-demo/login-html` DELIBERATELY execute
string-interpolated SQL — that's the whole pedagogy of the original UNLV
exercise (`' OR '1'='1' --` bypasses auth). Hitting the museum's main
DB through `db.ts` would let any visitor exfiltrate **everything**
the `neondb_owner` role can SELECT, via a one-line UNION in the
username field: `auth.user` emails, `auth.account` OAuth tokens,
`jaskis.audit_log`, every project's data. An audit on 2026-05-20
confirmed this was possible:

```
{"username":"x' AND 1=0 UNION SELECT 0, email, name FROM auth.\"user\" -- ",
 "password":"x", "mode":"vulnerable"}
→ {"rows":[{"id":0,"username":"mbzuiter@gmail.com","role":"Mohammad Zuiter"}]}
```

The fix: a least-privilege Postgres role.

- Role `sql_demo_runner` exists on the museum's Neon project.
- Grants: `CONNECT` on `neondb`, `USAGE` on `sql_demo`, `SELECT` on
  `sql_demo.users`. Nothing else.
- Connection string lives in `SQL_DEMO_DATABASE_URL` (`.env.local` +
  Vercel sensitive, target=production+preview).
- `src/lib/db-sql-demo.ts` constructs a dedicated Drizzle client from
  that URL and exports `sqlDemoDb`. Both `/api/sql-demo` routes import
  from there — they do NOT import the main `db`.
- The lockdown is enforced at the Postgres level, not by string
  inspection in the app: a UNION against `auth."user"` returns
  `permission denied for schema auth` from Postgres regardless of how
  cleverly the SQL is crafted. The pedagogy still works — UNION/OR
  injection against `sql_demo.users` behaves exactly as the original
  UNLV exercise demonstrates.

Re-running the original exfil payload post-fix returns the route's
`Failed query: ...` error path with no leaked rows.

**Stacked-statement DDL/DML** is independently blocked by the Neon HTTP
driver (which permits only one statement per request). The lockdown
above addresses the read surface, which was the catastrophic one.

If a future change adds another deliberately-vulnerable surface,
follow the same pattern: dedicated role with surgical grants, dedicated
env var, dedicated client. Never share `db.ts` with anything that runs
visitor-controlled SQL.
