# Identity and Signup

A museum-wide convention: **any tier that exposes login or signup must
tie the project-level identity to the visitor's authenticated GitHub
(museum) session.** No anonymous project users. No project users that
exist without a museum-known counterpart.

This document is the canonical contract for that rule. It applies
across Original, Enhanced, and Reimagined tiers uniformly — so the
moment a tier has a `users` table or any auth surface, this is the
default it must implement.

## Identity surfaces vs. pedagogical fixtures

This contract applies to **identity surfaces** — `users` tables whose
rows ARE project-level identities. A row in such a table represents a
person; a login grants the visitor the ability to act as that person;
subsequent state (comments, reviews, orders, etc.) FKs back to the user
row.

It does NOT apply to **pedagogical fixtures** — `users` tables whose
rows are demo data the visitor manipulates rather than identities the
visitor inhabits. sql-injection-demo is the canonical example: its
`users` table contains seed rows the visitor tries to bypass via
injection. The "login" doesn't grant a session, doesn't gate anything,
doesn't tie subsequent state to the matched row — it returns a success
page and ends. The rows are queryable data, not identities.

The whole-route gate still applies to fixture surfaces: the museum
session is required to reach the demo at all (the Enhanced API
conventions don't carve out for pedagogy — secure end-to-end, with
usability offered to signed-in visitors only). Every attempt is
audited under the visitor's GitHub login. But the `museum_user_id` FK
on the fixture table itself doesn't make sense — the rows aren't
museum identities, they're demo seeds.

A quick decision rule: does logging in as that user enable any
subsequent state writes that attribute to them? If yes (rest-rant
comments), it's an identity surface and the contract below applies in
full. If no (sql-injection-demo's login returns a static page), it's a
fixture, and only the museum-session gate applies.

## The contract

When a project's domain includes an **identity surface** (rest-rant's
reviewers, future projects with customer-facing auth, etc.), the
project-level `users` table must:

1. Carry a **non-nullable** `museum_user_id` FK pointing at `auth.user(id)`.
2. Be **indexed** on `museum_user_id` for audit-log pivoting AND for the
   per-login enforcement described below.
3. Refuse any insert path that would land a row with `museum_user_id =
NULL`. That means the API surfaces that create project users must
   take the museum session as a non-optional precondition.

Concretely:

```sql
CREATE TABLE <project_schema>.users (
  id SERIAL PRIMARY KEY,
  museum_user_id TEXT NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
  -- project-specific columns (email, first_name, password_digest, etc.) below
  ...
);
CREATE INDEX <project_schema>_users_museum_user_idx
  ON <project_schema>.users (museum_user_id);
```

`ON DELETE CASCADE` is the right call here because a deleted museum
user shouldn't leave dangling project-level identities. If a project's
domain demands soft-delete instead, override with `ON DELETE SET NULL`

- a `deleted_at` column AND make the column nullable — but the FK
  itself must still exist.

## Login is three-factor, not two

The non-nullable FK is the data-model anchor. The behavioral
consequence is that **every project-level login check includes the
museum session as a hard predicate** — not as an authorization layer
on top of a successful login, but as part of the lookup query itself.

A login attempt at any tier passes only when ALL THREE conditions are
true:

1. The submitted email/username matches a `users` row.
2. The submitted password verifies against that row's `password_digest`.
3. The current museum session's `auth.user.id` equals that row's
   `museum_user_id`.

Concretely, the query shape is:

```sql
SELECT * FROM <project_schema>.users
WHERE email = $1
  AND museum_user_id = $2  -- the visitor's current museum-session user.id
LIMIT 1;
-- then bcrypt.compare(submittedPassword, row.password_digest)
```

If the email exists but `museum_user_id` doesn't match the current
session, return the same `404 Could not find a user with the provided
credentials` response that a wrong-password attempt returns. **Do
not** return a distinct "this account belongs to a different museum
identity" error — that would leak the existence of the account to a
visitor who isn't the rightful owner.

This means:

- A stolen project-level password is useless on its own. The attacker
  also has to be signed into the museum as the GitHub identity tied
  to that account.
- A visitor who creates a project-level account under one GitHub
  identity cannot log into it from another GitHub identity, even if
  they remember the password. Switching GitHub sessions effectively
  switches which set of project-level accounts they can access.
- The museum session IS the authorization domain. The
  email/username/password layer is preserved for source-faithfulness
  (rest-rant's signup form, sql-injection-demo's login form) but it
  is no longer the security boundary — the GitHub layer is.

The same predicate applies to **password reset, account recovery, and
any other "log into this account" surface a project might add later**.
There is no flow at any tier that lets a visitor enter another
museum-identity's project account.

## Why this rule

- **Maximum auditability.** Every project-level mutation can pivot
  through the museum-user FK to a GitHub identity. The audit log's
  `actor_login` column already stores the GitHub login of whoever made
  the request; the FK makes "which project user is that?" a single
  indexed join, not a guess.
- **Anti-abuse floor.** Sock-puppet project accounts require sock-
  puppet GitHub accounts. GitHub OAuth is the friction floor; making
  it the project-level floor too inherits that property for free.
- **One sign-in event.** Museum visitors are already GitHub-signed-in
  by the time they reach any mutation surface (per the Enhanced API
  conventions — every mutation route is guarded). Project signup is
  just "create a per-project profile linked to the museum identity";
  no second password is required if the project's domain doesn't
  demand one.
- **Reversibility.** A visitor who signs out of GitHub takes their
  project-level identity with them via cascade. No orphan rows. No
  "user deleted their GitHub but their reviews still attribute to
  someone."

## Cross-tier application

### Original tier

If the source repo includes its own signup/login (rest-rant's bcrypt
flow, sql-injection-demo's vulnerable login form), the Original tier
preserves those columns verbatim — that's the source-faithful
contract. The `museum_user_id` FK is added ALONGSIDE the source's
columns, not as a replacement. The source's `password_digest` /
`username` / etc. stay; we just refuse to insert without a museum
session AND store the link.

The Original tier's wire shape still returns whatever the source
returned. The FK is internal — visible only in the audit log's join
path, not in `GET /users` responses.

### Enhanced tier

Same data model as Original (the FK is on the SAME table — there's
only one `users` table per project). The Enhanced surface may expose
the museum-user link in its response shape if the UX benefits from
it, but isn't required to.

### Reimagined tier

The natural home for "museum-OAuth" UX — a project signup screen
that offers "use my museum identity" (auto-link, no extra fields)
OR "create a project-local identity" (museum-linked PLUS optional
project-local fields like username/password to preserve original
semantics).

A Reimagined tier may also introduce roles (admin, customer, staff)
as additional columns on the same `users` table — those decisions
are domain-specific and don't change this contract.

## How to add a new project that needs auth

When you're scaffolding a project whose Original tier includes a
`users` table:

1. Add `museum_user_id TEXT NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE`
   to the schema BEFORE any users-table writes ship.
2. Add the index on `museum_user_id`.
3. Wire every users-write handler through `guardMutation()` (so the
   museum session is always available) and store
   `guard.actor.id` into `museum_user_id` on insert.
4. Set `actor_id` + `actor_login` on the audit row as usual (those
   record the museum-session actor, not the project-level user).
5. If the project-level UI ever needs to surface "you're acting as
   project-user X under museum-identity Y", read it via the FK join.
   Don't store the museum login redundantly on the project user — it
   would drift from `auth.user.name`.

## Anti-pattern: project-only users

A project that ships `users` without `museum_user_id` is a
correctness violation against this contract. The audit log might
still record `actor_login` (the museum GitHub) for the mutation, but
the project-user row itself becomes detachable from any museum
identity — losing the auditability the contract guarantees.

There is no carve-out for "we'll add the FK later." Add it from the
first migration; backfilling is harder than starting right.

## Current status (2026-05-22)

- **Original tier**: rest-rant has a `users` table WITHOUT
  `museum_user_id` today. This is a debt to repay when the
  rest-rant Enhanced surface ships its first users-related
  endpoint, OR sooner via a migration + handler-wiring pass.
- **Enhanced tier**: rest-rant Enhanced is in progress (this
  session). The user concept gets touched only via `guardMutation`-
  gated handlers — no new write paths for `users` yet, so the FK
  can be added in the same migration that lands here.
- **Reimagined tier**: no project has shipped Reimagined yet. When
  the first one does, the museum-OAuth UX should land alongside.

## The login-button UI pattern

When a port's source repo has its own third-party login button (Google,
Facebook, Discord, Apple, etc.), the museum-ready conversion replaces
that button with a single **"Login with UNLV Museum"** button that
triggers the museum's GitHub-OAuth flow. The pattern:

- **One button per third-party provider on the source** collapses into
  **one button total** (the museum-OAuth button). If the source had
  Google + Facebook, both go away; the museum button replaces both.
- **Label**: literally "Login with UNLV Museum". Not "Sign in with
  GitHub" — the visitor's mental model is the museum session, not the
  GitHub session underneath. The fact that GitHub is the backing
  provider is implementation detail.
- **Icon**: the museum's own SVG mark (NOT the GitHub octocat). The
  museum mark visually signals "this is the museum's auth, the same
  one that gates every other exhibit you've visited."
- **Email/password form, if the source had one, stays.** The
  three-factor predicate above means museum-OAuth is the security
  boundary even when the email/password form remains. Sources that ship
  email/password (rest-rant, h-data) keep the form for source-faithful
  reasons; sources that don't (most static SPAs) get just the museum
  button.

Why this matters as a reusable pattern: every Enhanced/Reimagined port
that inherits a third-party login from its source will face this
choice. Codifying it here means the answer is mechanical, not a
per-project deliberation:

| Source's login UI | Museum-ready UI |
|---|---|
| email + password + "Sign in with Google" | email + password + "Login with UNLV Museum" |
| email + password only | email + password + "Login with UNLV Museum" |
| "Sign in with Google" only | "Login with UNLV Museum" only |
| "Sign in with Google" + "Sign in with Facebook" | "Login with UNLV Museum" only |
| email + password + "Sign in with Apple" + "Continue with Microsoft" | email + password + "Login with UNLV Museum" |

The museum-OAuth button always lands at the bottom of the form
(below email/password if present), styled identically to the
"primary action" button it sits next to so it reads as "another way
in," not as a downgrade or upsell.

### Where to put the SVG

The museum mark — a hexagon with an inscribed triangle, drawn in oklch
with a soft white-to-blue radial gradient — is canonically defined in
[src/app/icon.svg](../../src/app/icon.svg) (the App Router auto-serves
it as the museum's favicon at `/icon.svg`). For in-tree React use, the
mark is also available as a typed component at
[src/components/ui/MuseumMark.tsx](../../src/components/ui/MuseumMark.tsx)
— prefer that component over `<img src="/icon.svg">` because it inlines
the SVG without a network fetch and accepts a `hue` prop so the mark
can carry status mood (250=museum blue, 70=warning, 25=destructive).
Each instance must pass a unique `gradientId` so multiple side-by-side
copies don't collide on `<defs>`.

For Enhanced ports running inside a submodule whose dev server is
separate, copy the raw SVG (the icon.svg content, not the React
component) to the submodule's `public/` on first wiring and document
the copy in the port's sources-conversions row — the submodule can't
`import` from museum-side paths.

## Related

- `project_enhanced_api_conventions.md` (memory): the broader
  Enhanced precedent — audit log, /api/v2/, guarded writes.
- `auth.md` (internal_docs): Better Auth + GitHub OAuth setup,
  session model, `auth.user` schema.
