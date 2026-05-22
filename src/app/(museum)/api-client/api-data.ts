/**
 * API metadata for the api-client viewer.
 *
 * Extracted from ApiClient.tsx so the server-side page.tsx files can read
 * the first-entry id for default-redirect logic without pulling in the full
 * client component. Pure data + types, no React.
 */

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface Endpoint {
  label: string;
  method: Method;
  path: string;
  description: string;
  body?: string;
}

export interface ApiProject {
  id: string;
  title: string;
  baseUrl: string;
  description: string;
  tech: string;
  endpoints: Endpoint[];
  /**
   * Optional museum-route cross-link surfaced in the api-client's
   * details panel. Used to point visitors from the API view to its
   * paired frontend (or to a related Replaced UI). Mirrors the
   * `siblingFrontend` field on the backend's projects.tsx entry, but
   * lives here because the api-client viewer has its own per-API
   * details panel that ProjectChrome doesn't render.
   */
  relatedRoute?: { label: string; url: string };
}

export const APIS_ORIGINAL: ApiProject[] = [
  {
    id: "music-tour",
    title: "Music Tour API",
    baseUrl: "/api/music-tour",
    description:
      "REST API for music tour management — bands, events, stages, and the cross-references between them. Mirrors the UNLV exercise's three controllers verbatim: lookups go by NAME, mutations go by integer ID, and the GET-by-name responses include the nested join data the source's Sequelize `include` chain produced.",
    tech: "Originally Express + PostgreSQL + Sequelize",
    endpoints: [
      // ── bands ───────────────────────────────────────────────────────
      {
        label: "List bands",
        method: "GET",
        path: "/bands",
        description: "Returns all bands (optional ?name=<like> filter)",
      },
      {
        label: "Filter bands by name",
        method: "GET",
        path: "/bands?name=jin",
        description: "Case-insensitive LIKE filter (Sequelize Op.like)",
      },
      {
        label: "Get band (by name)",
        method: "GET",
        path: "/bands/Jingle Jongle",
        description: "Returns the band + nested meet_greets + set_times",
      },
      {
        label: "Create band",
        method: "POST",
        path: "/bands",
        description: "Creates a new band",
        body: JSON.stringify(
          {
            name: "Midnight Rodeo",
            genre: "Country Rock",
            availableStartTime: "2024-06-01T18:00:00Z",
            endTime: "2024-06-01T23:00:00Z",
          },
          null,
          2,
        ),
      },
      {
        label: "Update band (by id)",
        method: "PUT",
        path: "/bands/69",
        description:
          "Update by integer band_id (mutating endpoints use id, not name)",
        body: JSON.stringify({ genre: "Updated Genre" }, null, 2),
      },
      {
        label: "Delete band (by id)",
        method: "DELETE",
        path: "/bands/420",
        description:
          "Delete by integer band_id — cascades meet_greets + set_times",
      },
      // ── events ──────────────────────────────────────────────────────
      {
        label: "List events",
        method: "GET",
        path: "/events",
        description: "Returns all events (optional ?name=<like> filter)",
      },
      {
        label: "Get event (by name)",
        method: "GET",
        path: "/events/Jinglefest",
        description: "Returns the event + nested meet_greets/set_times/stages",
      },
      {
        label: "Create event",
        method: "POST",
        path: "/events",
        description: "Creates a new event",
        body: JSON.stringify(
          {
            name: "Summer Slam",
            date: "2024-07-15T00:00:00Z",
            startTime: "2024-07-15T17:00:00Z",
            endTime: "2024-07-15T23:00:00Z",
          },
          null,
          2,
        ),
      },
      {
        label: "Update event (by id)",
        method: "PUT",
        path: "/events/1",
        description: "Update by integer event_id",
        body: JSON.stringify({ name: "Jinglefest 2024" }, null, 2),
      },
      {
        label: "Delete event (by id)",
        method: "DELETE",
        path: "/events/9",
        description: "Delete by integer event_id — cascades junctions",
      },
      // ── stages ──────────────────────────────────────────────────────
      {
        label: "List stages",
        method: "GET",
        path: "/stages",
        description: "Returns all stages (optional ?stage_name=<like> filter)",
      },
      {
        label: "Get stage (by name)",
        method: "GET",
        path: "/stages/Main Stage",
        description:
          "Returns the stage + every event it's at (M:M via stage_events)",
      },
      {
        label: "Create stage",
        method: "POST",
        path: "/stages",
        description: "Creates a new stage",
        body: JSON.stringify({ stageName: "Acoustic Tent" }, null, 2),
      },
      {
        label: "Delete stage (by id)",
        method: "DELETE",
        path: "/stages/80",
        description:
          "Delete by integer stage_id — cascades set_times + stage_events",
      },
    ],
  },
  {
    id: "admin-portal",
    title: "Admin Portal",
    baseUrl: "/api/admin-portal",
    description:
      "Book inventory management. The original Express server served the admin UI HTML at / alongside these JSON routes, so the frontend reads as a sibling endpoint that opens a URL.",
    tech: "Originally Express + JSON file store",
    relatedRoute: {
      label: "Open the Original admin UI",
      url: "/js-exercises/admin-portal",
    },
    endpoints: [
      {
        label: "Admin Portal page",
        method: "GET",
        path: "/",
        description: "HTML — admin.html (Edit / Add / Delete)",
      },
      {
        label: "Book List page",
        method: "GET",
        path: "/index.html",
        description: "HTML — index.html (read-only)",
      },
      {
        label: "List books",
        method: "GET",
        path: "/listBooks",
        description: "Returns all books",
      },
      {
        label: "Add book",
        method: "POST",
        path: "/addBook",
        description: "Adds a new book",
        body: JSON.stringify(
          {
            title: "Warp Speed",
            description: "A sci-fi thriller",
            year: "2023",
            quantity: 50,
          },
          null,
          2,
        ),
      },
      {
        label: "Update book",
        method: "PATCH",
        path: "/updateBook",
        description: "Updates a book (id in body)",
        body: JSON.stringify({ id: 1, quantity: 500 }, null, 2),
      },
      {
        label: "Remove book",
        method: "DELETE",
        path: "/removeBook/3",
        description: "Removes a book by id",
      },
    ],
  },
  {
    id: "rest-rant",
    title: "Rest-Rant API",
    baseUrl: "/api/rest-rant",
    description:
      "Restaurant review backend. CRUD on places, threaded comments, signup/login auth. Same monorepo as the Rest-Rant SPA card on the landing globe — the original Express server packaged the frontend + the API together. The museum carve-out applies: writes (including signup/login) require GitHub sign-in, and project-level users are locked to museum identities via museum_user_id FK.",
    tech: "Originally Express + PostgreSQL + Sequelize + bcrypt",
    relatedRoute: {
      label: "Open the Rest-Rant frontend",
      url: "/rest-rant",
    },
    endpoints: [
      {
        label: "Rest-Rant page",
        method: "GET",
        path: "/",
        description: "HTML — the SPA's index.html",
      },
      {
        label: "List places",
        method: "GET",
        path: "/places",
        description: "Returns all places",
      },
      {
        label: "Get place + comments",
        method: "GET",
        path: "/places/1",
        description: "Returns a place with its comments and authors",
      },
      {
        label: "Create place",
        method: "POST",
        path: "/places",
        description: "Creates a new place",
        body: JSON.stringify(
          {
            name: "Magnolia Bakery",
            city: "Las Vegas",
            state: "NV",
            cuisines: "Bakery, Coffee",
            pic: "https://placebear.com/g/405/400",
            founded: 2014,
          },
          null,
          2,
        ),
      },
      {
        label: "Update place",
        method: "PUT",
        path: "/places/1",
        description: "Updates a place",
        body: JSON.stringify({ cuisines: "Thai" }, null, 2),
      },
      {
        label: "Delete place",
        method: "DELETE",
        path: "/places/5",
        description: "Deletes a place (cascade comments)",
      },
      {
        label: "Add comment",
        method: "POST",
        path: "/places/2/comments",
        description: "Adds a comment to a place",
        body: JSON.stringify(
          {
            authorId: 1,
            stars: 5,
            content: "Best cappuccino in Phoenix.",
            rant: false,
          },
          null,
          2,
        ),
      },
      {
        label: "Delete comment",
        method: "DELETE",
        path: "/places/1/comments/1",
        description: "Deletes a comment under a place",
      },
      {
        label: "Sign up",
        method: "POST",
        path: "/users",
        description: "Creates a new user (bcrypt-hashed password)",
        body: JSON.stringify(
          {
            firstName: "Alex",
            lastName: "Sample",
            email: "alex@example.com",
            password: "password",
          },
          null,
          2,
        ),
      },
      {
        label: "Login",
        method: "POST",
        path: "/authentication",
        description: "Verifies email + password, returns the user",
        body: JSON.stringify(
          { email: "john@example.com", password: "password" },
          null,
          2,
        ),
      },
    ],
  },
  {
    id: "sql-demo",
    title: "SQL Injection Demo",
    baseUrl: "/api/sql-demo",
    description:
      "Educational demo showing vulnerable vs safe SQL queries against a real database. The visitor-facing form lives at /sql-injection-demo — this card is the structured-inspection lab.",
    tech: "Originally Express + SQLite",
    endpoints: [
      {
        label: "SQL Demo page",
        method: "GET",
        path: "/",
        description:
          "HTML — the login form (same page iframed at /sql-injection-demo)",
      },
      {
        label: "Login (vulnerable)",
        method: "POST",
        path: "/",
        description: "String-interpolated query — try injecting!",
        body: JSON.stringify(
          { username: "admin", password: "s3cur3P@ss", mode: "vulnerable" },
          null,
          2,
        ),
      },
      {
        label: "SQL injection!",
        method: "POST",
        path: "/",
        description: "Bypasses auth with OR 1=1",
        body: JSON.stringify(
          {
            username: "' OR '1'='1' --",
            password: "anything",
            mode: "vulnerable",
          },
          null,
          2,
        ),
      },
      {
        label: "Same attack (safe)",
        method: "POST",
        path: "/",
        description: "Parameterized query neutralizes the attack",
        body: JSON.stringify(
          { username: "' OR '1'='1' --", password: "anything", mode: "safe" },
          null,
          2,
        ),
      },
      {
        label: "Login (safe)",
        method: "POST",
        path: "/",
        description: "Normal login via parameterized query",
        body: JSON.stringify(
          { username: "alice", password: "alice123", mode: "safe" },
          null,
          2,
        ),
      },
    ],
  },
];

/**
 * Enhanced tier — same Original surface, augmented with what the era's
 * tooling couldn't have offered. For backend ports that allow mutations
 * without observability in the Original, the floor of Enhanced is an
 * audit log over the same data + GitHub sign-in on writes (see
 * /mongo-client/enhanced for the pattern). Entries here land as each
 * Original gets its Enhanced surface; the tab is intentionally empty
 * until real Enhanced work ships.
 */
export const APIS_ENHANCED: ApiProject[] = [
  {
    id: "music-tour",
    title: "Music Tour API (v2)",
    baseUrl: "/api/v2/music-tour",
    description:
      "Enhanced tier — same source-faithful CRUD as v1 plus: batch reads via `?names=A,B,C`, a transactional `/batch` endpoint for compound writes, cross-resource `/search`, a public `/audit-log` window onto every mutation across both tiers (with GitHub-login attribution), and a `/rate-limit` observability endpoint. Mutations on both v1 and v2 require sign-in; the audit log makes any abuse self-attributing.",
    tech: "Next.js + Drizzle + @vercel/firewall + Better Auth PAT",
    endpoints: [
      // ── bands ──────────────────────────────────────────────────────
      {
        label: "List bands",
        method: "GET",
        path: "/bands",
        description: "Same as v1 — optional ?name=<like> filter",
      },
      {
        label: "Batch read bands",
        method: "GET",
        path: "/bands?names=Jingle Jongle,Dingle Dongle",
        description:
          "v2 only — comma-separated names returns array of bands with their full meet_greets + set_times join chains",
      },
      {
        label: "Get band (by name)",
        method: "GET",
        path: "/bands/Jingle Jongle",
        description: "Same as v1 — band + nested meet_greets/set_times",
      },
      {
        label: "Create band",
        method: "POST",
        path: "/bands",
        description: "Sign-in required — audit row recorded with tier=enhanced",
        body: JSON.stringify(
          {
            name: "v2 Probe Band",
            genre: "Test",
            availableStartTime: "2024-06-01T18:00:00Z",
            endTime: "2024-06-01T23:00:00Z",
          },
          null,
          2,
        ),
      },
      // ── events ─────────────────────────────────────────────────────
      {
        label: "List events",
        method: "GET",
        path: "/events",
        description: "Same as v1",
      },
      {
        label: "Batch read events",
        method: "GET",
        path: "/events?names=Jinglefest,Dingledays",
        description: "v2 only — multi-event response with join chains",
      },
      // ── stages ─────────────────────────────────────────────────────
      {
        label: "List stages",
        method: "GET",
        path: "/stages",
        description: "Same as v1",
      },
      // ── v2-only endpoints ──────────────────────────────────────────
      {
        label: "Cross-resource search",
        method: "GET",
        path: "/search?q=jingle",
        description:
          "v2 only — one query, three result arrays (bands, events, stages)",
      },
      {
        label: "Compound write (batch)",
        method: "POST",
        path: "/batch",
        description:
          "v2 only — single Postgres transaction; ALL ops succeed or ALL roll back. Each op writes its own audit row. Sign-in required.",
        body: JSON.stringify(
          {
            ops: [
              {
                method: "POST",
                path: "/bands",
                body: {
                  name: "Batch Probe 1",
                  genre: "Test",
                  availableStartTime: "2024-06-01T18:00:00Z",
                  endTime: "2024-06-01T23:00:00Z",
                },
              },
              {
                method: "POST",
                path: "/stages",
                body: { stageName: "Batch Probe Stage" },
              },
            ],
          },
          null,
          2,
        ),
      },
      {
        label: "Audit log (newest 50)",
        method: "GET",
        path: "/audit-log",
        description:
          "v2 only — read every mutation across BOTH tiers (Original + Enhanced) with GitHub-login attribution. No sign-in required to READ.",
      },
      {
        label: "Audit log: filter by op",
        method: "GET",
        path: "/audit-log?op=insertOne",
        description: "Slice to creates only",
      },
      {
        label: "Audit log: by GitHub actor",
        method: "GET",
        path: "/audit-log?actor=moefingers",
        description: "Who-did-what for a specific GitHub login",
      },
      {
        label: "Audit log: by tier",
        method: "GET",
        path: "/audit-log?tier=original",
        description: "Only writes that came through /api/music-tour/* (v1)",
      },
      {
        label: "Rate-limit policy",
        method: "GET",
        path: "/rate-limit",
        description:
          "Returns your current tier (anon vs auth), the budgets each tier carries, and notes about how unconsumed budget surfaces (or doesn't) today",
      },
    ],
  },
  {
    id: "admin-portal",
    title: "Admin Portal (v2)",
    baseUrl: "/api/v2/admin-portal",
    description:
      "Enhanced tier — same book-inventory data as v1 plus: REST-shaped aliases (/books, /books/:id) alongside the original verb-prefixed paths on v1, a transactional /batch endpoint, /search across title+description, /low-stock for operational reports, /audit-log over every mutation in both tiers, and /rate-limit observability. Writes on both tiers now require GitHub sign-in (anti-abuse carve-out) and are attributed in the audit log.",
    tech: "Next.js + Drizzle + @vercel/firewall + Better Auth PAT",
    relatedRoute: {
      label: "Open the Replaced admin UI",
      url: "/js-exercises/admin-portal/enhanced",
    },
    endpoints: [
      // ── REST aliases (v2 modern shape) ──────────────────────────────
      {
        label: "List books (REST)",
        method: "GET",
        path: "/books",
        description:
          "v2 alias for v1's /listBooks — supports ?sort=, ?order=, ?limit=, ?ids=1,2,3",
      },
      {
        label: "Batch read books by id",
        method: "GET",
        path: "/books?ids=1,2,3",
        description: "v2 only — comma-separated ids returns just those rows",
      },
      {
        label: "Get one book",
        method: "GET",
        path: "/books/1",
        description: "v2 only — REST single-resource fetch by id",
      },
      {
        label: "Create book (REST)",
        method: "POST",
        path: "/books",
        description:
          "v2 alias for v1's /addBook — same body shape, sign-in required, audit row tier=enhanced",
        body: JSON.stringify(
          {
            title: "v2 Probe Book",
            description: "Inserted via REST alias",
            year: "2026",
            quantity: 1,
          },
          null,
          2,
        ),
      },
      {
        label: "Update book (REST)",
        method: "PATCH",
        path: "/books/1",
        description:
          "v2 only — id in URL (REST), not body. v1's /updateBook still wants id in the body for source-faithfulness.",
        body: JSON.stringify({ quantity: 99 }, null, 2),
      },
      {
        label: "Delete book (REST)",
        method: "DELETE",
        path: "/books/1",
        description:
          "v2 alias for v1's /removeBook/:id — sign-in required, audit row records the deleted row",
      },
      // ── v2-only endpoints ────────────────────────────────────────────
      {
        label: "Search (title + description)",
        method: "GET",
        path: "/search?q=node",
        description:
          "v2 only — case-insensitive substring match across title and description",
      },
      {
        label: "Low-stock report",
        method: "GET",
        path: "/low-stock?threshold=5",
        description:
          "v2 only — books with quantity <= threshold, sorted by quantity asc. Operational visibility era-impossible without server-side query support.",
      },
      {
        label: "Book cover (deterministic SVG)",
        method: "GET",
        path: "/cover/1?title=Sample%20Title&year=2024",
        description:
          "v2 only — returns a deterministic SVG cover seeded from the id + title + year. POST /books with no imageURL auto-fills this URL so the Replaced UI never has imageless rows. Try different ids to see the palette/typography/pattern roll.",
      },
      {
        label: "Compound write (batch)",
        method: "POST",
        path: "/batch",
        description:
          "v2 only — single Postgres transaction over multiple book ops. All succeed or all roll back. Sign-in required; one audit row per op.",
        body: JSON.stringify(
          {
            ops: [
              {
                method: "POST",
                path: "/books",
                body: {
                  title: "Batch Probe 1",
                  description: "First of two created atomically",
                  quantity: 3,
                },
              },
              {
                method: "POST",
                path: "/books",
                body: {
                  title: "Batch Probe 2",
                  description:
                    "Second of two — if either fails, both roll back",
                  quantity: 7,
                },
              },
            ],
          },
          null,
          2,
        ),
      },
      {
        label: "Audit log (newest 50)",
        method: "GET",
        path: "/audit-log",
        description:
          "v2 only — read every mutation across BOTH tiers (Original + Enhanced) with GitHub-login attribution. No sign-in required to READ.",
      },
      {
        label: "Audit log: filter by op",
        method: "GET",
        path: "/audit-log?op=insertOne",
        description: "Slice to creates only",
      },
      {
        label: "Audit log: by GitHub actor",
        method: "GET",
        path: "/audit-log?actor=moefingers",
        description: "Who-did-what for a specific GitHub login",
      },
      {
        label: "Audit log: by tier",
        method: "GET",
        path: "/audit-log?tier=original",
        description: "Only writes that came through /api/admin-portal/* (v1)",
      },
      {
        label: "Rate-limit policy",
        method: "GET",
        path: "/rate-limit",
        description:
          "Returns your current tier (anon vs auth), the budgets each tier carries, and notes about how unconsumed budget surfaces (or doesn't) today",
      },
    ],
  },
  {
    id: "rest-rant",
    title: "Rest-Rant API (v2)",
    baseUrl: "/api/v2/rest-rant",
    description:
      "Enhanced tier — same restaurant-review CRUD as v1 plus: /search across places (name/city/cuisines), a transactional /batch endpoint for compound place+comment writes, /audit-log over every mutation AND every login attempt in both tiers (with the password never recorded), and /rate-limit observability. Writes on both tiers require GitHub sign-in (anti-abuse carve-out). Per the identity-and-signup contract, project-level signup links each rest-rant user to a museum identity via museum_user_id FK, and login is three-factor (email + password + matching museum_user_id) — you can't log into someone else's project account even if you know their password.",
    tech: "Next.js + Drizzle + @vercel/firewall + bcrypt + Better Auth PAT",
    relatedRoute: {
      label: "Open the Rest-Rant frontend",
      url: "/rest-rant",
    },
    endpoints: [
      // ── places ──────────────────────────────────────────────────────
      {
        label: "List places",
        method: "GET",
        path: "/places",
        description: "Same as v1 — every place, newest first",
      },
      {
        label: "Get place + comments",
        method: "GET",
        path: "/places/1",
        description: "Place row + nested comments with author info",
      },
      {
        label: "Create place",
        method: "POST",
        path: "/places",
        description:
          "Sign-in required — audit row tier=enhanced. name + cuisines required; city/state/pic/founded optional.",
        body: JSON.stringify(
          {
            name: "Magnolia Bakery",
            city: "Las Vegas",
            state: "NV",
            cuisines: "Bakery, Coffee",
            pic: "https://placebear.com/g/405/400",
            founded: 2014,
          },
          null,
          2,
        ),
      },
      {
        label: "Update place",
        method: "PUT",
        path: "/places/1",
        description: "Partial update; audit row records before + after",
        body: JSON.stringify({ cuisines: "Thai" }, null, 2),
      },
      {
        label: "Delete place",
        method: "DELETE",
        path: "/places/5",
        description: "Cascades to comments; audit row records pre-delete state",
      },
      // ── comments ────────────────────────────────────────────────────
      {
        label: "Add comment",
        method: "POST",
        path: "/places/2/comments",
        description:
          "Sign-in required. authorId optional — when present, looked up and resolved to first+last name on the comment row.",
        body: JSON.stringify(
          {
            authorId: 1,
            stars: 5,
            content: "Best cappuccino in Phoenix.",
            rant: false,
          },
          null,
          2,
        ),
      },
      {
        label: "Delete comment",
        method: "DELETE",
        path: "/places/1/comments/1",
        description: "Hard delete; audit row records the deleted comment",
      },
      // ── users + auth ────────────────────────────────────────────────
      {
        label: "List users",
        method: "GET",
        path: "/users",
        description: "Same as v1 — no passwords in the response",
      },
      {
        label: "Sign up",
        method: "POST",
        path: "/users",
        description:
          "Sign-in required (museum-level). Per identity-and-signup.md, the project user is locked to YOUR museum identity via museum_user_id FK — you can't sign up under another museum identity's name.",
        body: JSON.stringify(
          {
            firstName: "Alex",
            lastName: "Sample",
            email: "alex@example.com",
            password: "password",
          },
          null,
          2,
        ),
      },
      {
        label: "Login (three-factor)",
        method: "POST",
        path: "/authentication",
        description:
          "Three-factor: email + password + matching museum_user_id. A login under a museum identity that doesn't own the account returns the SAME 404 as a wrong password — never leaks whether the account exists.",
        body: JSON.stringify(
          { email: "alex@example.com", password: "password" },
          null,
          2,
        ),
      },
      // ── v2-only endpoints ───────────────────────────────────────────
      {
        label: "Search places",
        method: "GET",
        path: "/search?q=bakery",
        description:
          "v2 only — case-insensitive substring match across name + city + cuisines",
      },
      {
        label: "Compound write (batch)",
        method: "POST",
        path: "/batch",
        description:
          "v2 only — single Postgres transaction over place + comment ops. All succeed or all roll back; one audit row per op. Users/auth are deliberately NOT supported here.",
        body: JSON.stringify(
          {
            ops: [
              {
                method: "POST",
                path: "/places",
                body: { name: "Batch Cafe", cuisines: "Coffee" },
              },
            ],
          },
          null,
          2,
        ),
      },
      {
        label: "Audit log (newest 50)",
        method: "GET",
        path: "/audit-log",
        description:
          "v2 only — every mutation AND every login event across both tiers, attributed to the museum visitor's GitHub login. Passwords are NEVER recorded.",
      },
      {
        label: "Audit log: only logins",
        method: "GET",
        path: "/audit-log?op=loginAttempt",
        description:
          "Slice to login attempts (failed + missing-field). loginSuccess is a separate op.",
      },
      {
        label: "Audit log: by table",
        method: "GET",
        path: "/audit-log?table=comments",
        description: "Only comment mutations",
      },
      {
        label: "Rate-limit policy",
        method: "GET",
        path: "/rate-limit",
        description:
          "Returns your current tier (anon vs auth), the budgets, plus a note about the identity-and-signup contract that rest-rant enforces on top of the standard guard",
      },
    ],
  },
];

export type Tier = "original" | "enhanced";

export function getApisForTier(tier: Tier): ApiProject[] {
  return tier === "enhanced" ? APIS_ENHANCED : APIS_ORIGINAL;
}
