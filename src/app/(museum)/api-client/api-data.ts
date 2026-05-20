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
      "REST API for music tour management. CRUD operations for bands and their tour events.",
    tech: "Originally Express + PostgreSQL + Sequelize",
    endpoints: [
      {
        label: "List bands",
        method: "GET",
        path: "/",
        description: "Returns all bands",
      },
      {
        label: "Get band",
        method: "GET",
        path: "/1",
        description: "Returns a band with its events",
      },
      {
        label: "Create band",
        method: "POST",
        path: "/",
        description: "Creates a new band",
        body: JSON.stringify(
          { name: "Midnight Rodeo", genre: "Country Rock", formedYear: 2022 },
          null,
          2,
        ),
      },
      {
        label: "Delete band",
        method: "DELETE",
        path: "/4",
        description: "Deletes a band and its events",
      },
    ],
  },
  {
    id: "jaskis",
    title: "JASKIS API",
    baseUrl: "/api/jaskis",
    description:
      "Animal-bounties registry from the JASKIS MongoDB exercise. Original was a MongoDB shell tutorial — same data shape (name, species, location, wantedFor, client, reward, captured), surfaced here as a REST API.",
    tech: "Originally MongoDB shell exercise; museum port runs on Postgres",
    endpoints: [
      {
        label: "List bounties",
        method: "GET",
        path: "/",
        description: "Returns all bounties (newest first)",
      },
      {
        label: "Get bounty",
        method: "GET",
        path: "/1",
        description: "Returns a single bounty by ID",
      },
      {
        label: "Create bounty",
        method: "POST",
        path: "/",
        description: "Creates a new bounty",
        body: JSON.stringify(
          {
            name: "Thanoceros",
            species: "Rhinoceros",
            location: "Grasslands",
            wantedFor: "Eating too much grass",
            client: "Songbird",
            reward: 10000,
            captured: false,
          },
          null,
          2,
        ),
      },
      {
        label: "Mark captured",
        method: "PUT",
        path: "/1",
        description: "Update a bounty (any subset of fields)",
        body: JSON.stringify({ captured: true }, null, 2),
      },
      {
        label: "Delete bounty",
        method: "DELETE",
        path: "/2",
        description: "Removes a bounty",
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
      "Restaurant review backend. CRUD on places, threaded comments, signup/login auth.",
    tech: "Originally Express + PostgreSQL + Sequelize + bcrypt",
    endpoints: [
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
      "Educational demo showing vulnerable vs safe SQL queries against a real database.",
    tech: "Originally Express + SQLite",
    endpoints: [
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

export const APIS_REIMAGINED: ApiProject[] = [
  {
    id: "music-tour-v2",
    title: "Music Tour v2",
    baseUrl: "/api/v2/music-tour",
    description:
      "Reimagined: paginated results, search, filtering, OpenAPI spec. Coming soon.",
    tech: "Next.js API Routes + Drizzle + OpenAPI",
    endpoints: [
      {
        label: "List bands (paginated)",
        method: "GET",
        path: "/?page=1&limit=10",
        description: "Paginated band listing",
      },
      {
        label: "Search bands",
        method: "GET",
        path: "/?search=rock",
        description: "Full-text search",
      },
    ],
  },
  {
    id: "jaskis-v2",
    title: "JASKIS v2",
    baseUrl: "/api/v2/jaskis",
    description:
      "Reimagined: geolocation-aware, ratings, photo uploads. Coming soon.",
    tech: "Next.js API Routes + Drizzle + Blob Storage",
    endpoints: [
      {
        label: "List nearby spots",
        method: "GET",
        path: "/?lat=36.1&lng=-115.1",
        description: "Location-based filtering",
      },
      {
        label: "Top rated",
        method: "GET",
        path: "/?sort=rating",
        description: "Sort by rating",
      },
    ],
  },
  {
    id: "admin-portal-v2",
    title: "Admin Portal v2",
    baseUrl: "/api/v2/admin-portal",
    description:
      "Reimagined: auth-gated, audit log, bulk operations. Coming soon.",
    tech: "Next.js API Routes + Drizzle + Better Auth",
    endpoints: [
      {
        label: "List books",
        method: "GET",
        path: "/",
        description: "Same endpoint, auth required in v2",
      },
    ],
  },
  {
    id: "sql-demo-v2",
    title: "SQL Demo v2",
    baseUrl: "/api/v2/sql-demo",
    description:
      "Reimagined: sandboxed execution, query explain plans, injection taxonomy. Coming soon.",
    tech: "Next.js API Routes + Sandbox",
    endpoints: [
      {
        label: "Explain query",
        method: "POST",
        path: "/",
        description: "Returns query plan alongside result",
        body: JSON.stringify(
          { username: "admin", password: "test", mode: "safe" },
          null,
          2,
        ),
      },
    ],
  },
];

export type Tier = "original" | "reimagined";

export function getApisForTier(tier: Tier): ApiProject[] {
  return tier === "reimagined" ? APIS_REIMAGINED : APIS_ORIGINAL;
}
