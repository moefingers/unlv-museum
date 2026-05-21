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
      "Restaurant review backend. CRUD on places, threaded comments, signup/login auth. Same monorepo as the Rest-Rant SPA card on the landing globe — the original Express server packaged the frontend + the API together.",
    tech: "Originally Express + PostgreSQL + Sequelize + bcrypt",
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
export const APIS_ENHANCED: ApiProject[] = [];

export type Tier = "original" | "enhanced";

export function getApisForTier(tier: Tier): ApiProject[] {
  return tier === "enhanced" ? APIS_ENHANCED : APIS_ORIGINAL;
}
