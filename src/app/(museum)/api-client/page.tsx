"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Collapsible } from "@/components/ui/Collapsible";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPEN";

interface Endpoint {
  label: string;
  method: Method;
  path: string;
  description: string;
  body?: string;
  /**
   * When set, the Send button navigates here in a new tab instead of fetching.
   * Used for the "Frontend (admin UI)" pseudo-endpoint on admin-portal — the
   * original Express server served HTML at `/` alongside the JSON routes, so
   * the frontend reads naturally as a sibling endpoint that opens a URL.
   */
  navigateTo?: string;
}

interface ApiProject {
  id: string;
  title: string;
  baseUrl: string;
  description: string;
  tech: string;
  endpoints: Endpoint[];
}

const APIS: ApiProject[] = [
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
      "Snack spot discovery database. Full CRUD for restaurant/food spots.",
    tech: "Originally MongoDB + Express + Mongoose",
    endpoints: [
      {
        label: "List spots",
        method: "GET",
        path: "/",
        description: "Returns all snack spots",
      },
      {
        label: "Get spot",
        method: "GET",
        path: "/1",
        description: "Returns a single spot by ID",
      },
      {
        label: "Create spot",
        method: "POST",
        path: "/",
        description: "Creates a new spot",
        body: JSON.stringify(
          {
            name: "Golden Waffle House",
            city: "Las Vegas",
            state: "NV",
            cuisine: "Breakfast",
          },
          null,
          2,
        ),
      },
      {
        label: "Update spot",
        method: "PUT",
        path: "/1",
        description: "Updates a spot",
        body: JSON.stringify({ cuisine: "Brunch" }, null, 2),
      },
      {
        label: "Delete spot",
        method: "DELETE",
        path: "/2",
        description: "Deletes a spot",
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
        label: "Open admin UI",
        method: "OPEN",
        path: "/",
        description: "Frontend (admin UI)",
        navigateTo: "/originals/admin-portal/admin.html",
      },
      {
        label: "Open book list",
        method: "OPEN",
        path: "/index.html",
        description: "Frontend (read-only book list)",
        navigateTo: "/originals/admin-portal/index.html",
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

const APIS_V2: ApiProject[] = [
  {
    id: "music-tour-v2",
    title: "Music Tour v2",
    baseUrl: "/api/music-tour",
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
    baseUrl: "/api/jaskis",
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
    baseUrl: "/api/admin-portal",
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
    baseUrl: "/api/sql-demo",
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

const METHOD_COLORS: Record<Method, string> = {
  GET: "bg-green-600",
  POST: "bg-blue-600",
  PUT: "bg-amber-600",
  PATCH: "bg-amber-600",
  DELETE: "bg-red-600",
  OPEN: "bg-violet-600",
};

const METHOD_TEXT: Record<Method, string> = {
  GET: "text-green-600 dark:text-green-400",
  POST: "text-blue-600 dark:text-blue-400",
  PUT: "text-amber-600 dark:text-amber-400",
  PATCH: "text-amber-600 dark:text-amber-400",
  DELETE: "text-red-600 dark:text-red-400",
  OPEN: "text-violet-600 dark:text-violet-400",
};

export default function ApiClientPage() {
  return (
    <Suspense>
      <ApiClient />
    </Suspense>
  );
}

function ApiClient() {
  const searchParams = useSearchParams();
  const initialApi = searchParams.get("api") ?? "music-tour";
  const initialV2 = searchParams.get("v2") === "1";
  const [v2, setV2] = useState(initialV2);
  const [activeApiId, setActiveApiId] = useState(initialApi);
  const [method, setMethod] = useState<Method>("GET");
  const [path, setPath] = useState("/");
  const [body, setBody] = useState("");
  // When the loaded endpoint has `navigateTo`, Send opens that URL instead
  // of fetching. Reset to null whenever a regular endpoint is loaded.
  const [navigateTo, setNavigateTo] = useState<string | null>(null);
  // baseUrl prefix can fold away so the path input gets full width.
  const [prefixOpen, setPrefixOpen] = useState(true);
  const [response, setResponse] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<
    {
      api: string;
      method: Method;
      path: string;
      status: number;
      time: number;
    }[]
  >([]);

  const currentApis = v2 ? APIS_V2 : APIS;
  const activeApi =
    currentApis.find((a) => a.id === activeApiId) ?? currentApis[0]!;

  const switchApi = (id: string) => {
    setActiveApiId(id);
    setPath("/");
    setMethod("GET");
    setBody("");
    setNavigateTo(null);
    setResponse(null);
    setStatus(null);
    const url = new URL(window.location.href);
    url.searchParams.set("api", id);
    window.history.replaceState({}, "", url.toString());
  };

  const loadEndpoint = (ep: Endpoint) => {
    setMethod(ep.method);
    setPath(ep.path);
    setBody(ep.body ?? "");
    setNavigateTo(ep.navigateTo ?? null);
    setResponse(null);
    setStatus(null);
  };

  const send = async () => {
    // Frontend pseudo-endpoint: open the URL in a new tab rather than fetch.
    // Method check guards against stale navigateTo state if the user tweaked
    // the request after loading an OPEN endpoint (we also clear navigateTo
    // on manual edits, but the method check is the load-bearing condition).
    if (method === "OPEN" && navigateTo) {
      window.open(navigateTo, "_blank", "noopener");
      setHistory((prev) => [
        {
          api: activeApi.title,
          method,
          path,
          status: 200,
          time: 0,
        },
        ...prev.slice(0, 29),
      ]);
      return;
    }
    setLoading(true);
    setResponse(null);
    setStatus(null);
    const url = `${activeApi.baseUrl}${path}`;
    const start = performance.now();
    try {
      const opts: RequestInit = {
        method,
        headers: { "Content-Type": "application/json" },
      };
      if (method !== "GET" && body.trim()) opts.body = body;
      const res = await fetch(url, opts);
      const elapsed = Math.round(performance.now() - start);
      setStatus(res.status);
      const text = await res.text();
      try {
        setResponse(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResponse(text);
      }
      setHistory((prev) => [
        {
          api: activeApi.title,
          method,
          path,
          status: res.status,
          time: elapsed,
        },
        ...prev.slice(0, 29),
      ]);
    } catch (err) {
      setStatus(0);
      setResponse(
        `Network error: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 flex items-center gap-3 border-b border-zinc-200 bg-white/80 px-6 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <Link
          href="/"
          className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-lg font-semibold">API Client</h1>
          <p className="text-xs text-zinc-400">
            Backend-only UNLV projects — live endpoints, interactive explorer
          </p>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Left: Knowledge Base */}
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs text-zinc-400">
                Live endpoints backed by a real database.
              </p>
              <button
                onClick={() => {
                  const next = !v2;
                  setV2(next);
                  const nextApis = next ? APIS_V2 : APIS;
                  setActiveApiId(nextApis[0]!.id);
                  setResponse(null);
                  setStatus(null);
                  const url = new URL(window.location.href);
                  if (next) url.searchParams.set("v2", "1");
                  else url.searchParams.delete("v2");
                  url.searchParams.set("api", nextApis[0]!.id);
                  window.history.replaceState({}, "", url.toString());
                }}
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold transition-colors ${
                  v2
                    ? "bg-green-600 text-white"
                    : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
                }`}
              >
                {v2 ? "v2" : "v1"}
              </button>
            </div>
          </div>
          <div className="flex">
            <Collapsible open={!v2} direction="horizontal" duration={400}>
              <div className="w-72">
                {APIS.map((api) => (
                  <div key={api.id}>
                    <button
                      onClick={() => switchApi(api.id)}
                      className={`w-full border-b border-zinc-200 px-4 py-3 text-left transition-colors dark:border-zinc-800 ${
                        activeApiId === api.id && !v2
                          ? "bg-white dark:bg-zinc-800"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <p className="text-sm font-semibold">{api.title}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">{api.tech}</p>
                    </button>
                    <Collapsible open={activeApiId === api.id && !v2}>
                      <div className="border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-800">
                        <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-400">
                          {api.description}
                        </p>
                        <div className="space-y-1">
                          {api.endpoints.map((ep, i) => (
                            <button
                              key={i}
                              onClick={() => loadEndpoint(ep)}
                              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700"
                            >
                              <span
                                className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${METHOD_COLORS[ep.method]}`}
                              />
                              <span
                                className={`font-mono font-bold ${METHOD_TEXT[ep.method]}`}
                              >
                                {ep.method}
                              </span>
                              <span className="truncate text-zinc-600 dark:text-zinc-400">
                                {ep.description}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </Collapsible>
                  </div>
                ))}
              </div>
            </Collapsible>
            <Collapsible open={v2} direction="horizontal" duration={400}>
              <div className="w-72">
                {APIS_V2.map((api) => (
                  <div key={api.id}>
                    <button
                      onClick={() => switchApi(api.id)}
                      className={`w-full border-b border-zinc-200 px-4 py-3 text-left transition-colors dark:border-zinc-800 ${
                        activeApiId === api.id && v2
                          ? "bg-white dark:bg-zinc-800"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <p className="text-sm font-semibold">{api.title}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">{api.tech}</p>
                    </button>
                    <Collapsible open={activeApiId === api.id && v2}>
                      <div className="border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-800">
                        <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-400">
                          {api.description}
                        </p>
                        <div className="space-y-1">
                          {api.endpoints.map((ep, i) => (
                            <button
                              key={i}
                              onClick={() => loadEndpoint(ep)}
                              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700"
                            >
                              <span
                                className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${METHOD_COLORS[ep.method]}`}
                              />
                              <span
                                className={`font-mono font-bold ${METHOD_TEXT[ep.method]}`}
                              >
                                {ep.method}
                              </span>
                              <span className="truncate text-zinc-600 dark:text-zinc-400">
                                {ep.description}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </Collapsible>
                  </div>
                ))}
              </div>
            </Collapsible>
          </div>

          {history.length > 0 && (
            <div className="p-4">
              <p className="mb-2 text-xs font-medium text-zinc-400">History</p>
              <div className="space-y-1">
                {history.map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 text-xs text-zinc-500"
                  >
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${METHOD_COLORS[h.method]}`}
                    />
                    <span className="font-mono">{h.method}</span>
                    <span className="truncate">{h.api}</span>
                    <span className="ml-auto text-zinc-400">
                      {h.status} · {h.time}ms
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Right: Client */}
        <main className="flex flex-1 flex-col p-6">
          <div className="mb-1">
            <Collapsible open={!v2} duration={300}>
              <div className="flex flex-wrap items-baseline gap-1">
                {APIS.map((api) => (
                  <div key={api.id} className="flex items-baseline">
                    <button
                      onClick={() => switchApi(api.id)}
                      className={`shrink-0 text-xl font-bold whitespace-nowrap transition-colors ${
                        activeApiId === api.id && !v2
                          ? ""
                          : "text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400"
                      }`}
                    >
                      {api.title}
                    </button>
                    <Collapsible
                      open={activeApiId === api.id && !v2}
                      direction="horizontal"
                      duration={200}
                    >
                      <span className="ml-2 whitespace-nowrap font-mono text-xs text-zinc-400">
                        {api.baseUrl}
                      </span>
                    </Collapsible>
                  </div>
                ))}
              </div>
            </Collapsible>
            <Collapsible open={v2} duration={300}>
              <div className="flex flex-wrap items-baseline gap-1">
                {APIS_V2.map((api) => (
                  <div key={api.id} className="flex items-baseline">
                    <button
                      onClick={() => switchApi(api.id)}
                      className={`shrink-0 text-xl font-bold whitespace-nowrap transition-colors ${
                        activeApiId === api.id && v2
                          ? ""
                          : "text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400"
                      }`}
                    >
                      {api.title}
                    </button>
                    <Collapsible
                      open={activeApiId === api.id && v2}
                      direction="horizontal"
                      duration={200}
                    >
                      <span className="ml-2 whitespace-nowrap font-mono text-xs text-zinc-400">
                        {api.baseUrl}
                      </span>
                    </Collapsible>
                  </div>
                ))}
              </div>
            </Collapsible>
          </div>

          <div className="mb-4 flex gap-2">
            <select
              value={method}
              onChange={(e) => {
                setMethod(e.target.value as Method);
                setNavigateTo(null); // user took manual control
              }}
              className={`rounded-md px-3 py-2 text-sm font-bold text-white ${METHOD_COLORS[method]}`}
            >
              {(["GET", "POST", "PUT", "PATCH", "DELETE", "OPEN"] as const).map(
                (m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ),
              )}
            </select>
            {/*
              baseUrl prefix is a read-only-styled segment glued to the path
              input so the substitution stays honest. Wrapped in a horizontal
              Collapsible so the user can fold it away when they need the full
              input width; a chevron toggle on the left always stays visible.
            */}
            <div className="flex flex-1 items-stretch overflow-hidden rounded-md border border-zinc-300 focus-within:border-zinc-500 dark:border-zinc-600 dark:focus-within:border-zinc-400">
              <button
                type="button"
                onClick={() => setPrefixOpen((v) => !v)}
                aria-label={
                  prefixOpen ? "Hide baseUrl prefix" : "Show baseUrl prefix"
                }
                title={prefixOpen ? "Hide prefix" : `Show ${activeApi.baseUrl}`}
                className="flex w-7 shrink-0 items-center justify-center border-r border-zinc-300 bg-zinc-100 font-mono text-xs text-zinc-500 transition-colors hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                {prefixOpen ? "‹" : "›"}
              </button>
              <Collapsible
                open={prefixOpen}
                direction="horizontal"
                duration={180}
              >
                <span className="flex h-full items-center border-r border-zinc-300 bg-zinc-100 px-3 font-mono text-sm whitespace-nowrap text-zinc-500 select-all dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400">
                  {activeApi.baseUrl}
                </span>
              </Collapsible>
              <input
                value={path}
                onChange={(e) => {
                  setPath(e.target.value);
                  setNavigateTo(null); // user took manual control
                }}
                className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-sm outline-none dark:bg-zinc-800"
                placeholder="/endpoint"
              />
            </div>
            <button
              onClick={send}
              disabled={loading}
              className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {loading ? "..." : "Send"}
            </button>
          </div>

          {method !== "GET" && method !== "OPEN" && (
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                Request Body
              </label>
              <textarea
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setNavigateTo(null);
                }}
                rows={5}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-600 dark:bg-zinc-800"
                placeholder='{"key": "value"}'
              />
            </div>
          )}

          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-500">
                Response
              </span>
              {status !== null && (
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                    status >= 200 && status < 300
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : status >= 400
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  }`}
                >
                  {status}
                </span>
              )}
            </div>
            <pre className="min-h-48 overflow-auto rounded-lg bg-zinc-950 p-4 font-mono text-sm text-green-400">
              {response ?? "Select an endpoint from the left, then click Send"}
            </pre>
          </div>
        </main>
      </div>
    </div>
  );
}
