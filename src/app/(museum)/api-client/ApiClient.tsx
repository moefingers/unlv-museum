"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Collapsible } from "@/components/ui/Collapsible";
import { SignInChip } from "@/components/auth/SignInChip";
import styles from "./ApiClient.module.css";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface Endpoint {
  label: string;
  method: Method;
  path: string;
  description: string;
  body?: string;
}

interface ApiProject {
  id: string;
  title: string;
  baseUrl: string;
  description: string;
  tech: string;
  endpoints: Endpoint[];
}

const APIS_ORIGINAL: ApiProject[] = [
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

const APIS_REIMAGINED: ApiProject[] = [
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

/* Per-method colors and the small dot indicator are driven by --method-*
   tokens in globals.css. JSX consumers set data-method="GET|POST|..." on
   .methodDot / .methodLabel / .method-button elements and the right
   color cascades automatically — no JS lookup table needed. */

export type Tier = "original" | "reimagined";

/**
 * Shared shell used by /api-client (Original) and /api-client/reimagined
 * (Reimagined). Tier is fixed per-route; switching tiers is a real navigation
 * (`<Link>` in the header strip), matching the rest of the museum's tier
 * pattern in ProjectChrome.
 */
export default function ApiClient({ tier }: { tier: Tier }) {
  return (
    <Suspense>
      <ApiClientInner tier={tier} />
    </Suspense>
  );
}

function ApiClientInner({ tier }: { tier: Tier }) {
  const searchParams = useSearchParams();
  const apis = tier === "reimagined" ? APIS_REIMAGINED : APIS_ORIGINAL;
  const initialApi = searchParams.get("api") ?? apis[0]!.id;

  const [activeApiId, setActiveApiId] = useState(initialApi);
  const [method, setMethod] = useState<Method>("GET");
  const [path, setPath] = useState("/");
  const [body, setBody] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [responseContentType, setResponseContentType] = useState<string | null>(
    null,
  );
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

  const activeApi = apis.find((a) => a.id === activeApiId) ?? apis[0]!;

  const switchApi = (id: string) => {
    setActiveApiId(id);
    setPath("/");
    setMethod("GET");
    setBody("");
    setResponse(null);
    setResponseContentType(null);
    setStatus(null);
    const url = new URL(window.location.href);
    url.searchParams.set("api", id);
    window.history.replaceState({}, "", url.toString());
  };

  const loadEndpoint = (ep: Endpoint) => {
    setMethod(ep.method);
    setPath(ep.path);
    setBody(ep.body ?? "");
    setResponse(null);
    setResponseContentType(null);
    setStatus(null);
  };

  const send = async () => {
    setLoading(true);
    setResponse(null);
    setResponseContentType(null);
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
      const ct = res.headers.get("content-type") ?? "";
      setResponseContentType(ct);
      const text = await res.text();
      // Prettify JSON regardless of content-type; HTML/other passes through.
      if (ct.includes("application/json")) {
        try {
          setResponse(JSON.stringify(JSON.parse(text), null, 2));
        } catch {
          setResponse(text);
        }
      } else {
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

  const statusClass =
    status === null
      ? ""
      : status >= 200 && status < 300
        ? styles.statusSuccess
        : status >= 400
          ? styles.statusError
          : styles.statusWarning;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerLead}>
          <Link
            href="/"
            className={styles.backLink}
            aria-label="Back to museum"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">API Client</h1>
            <p className={`text-xs ${styles.headerSubtitle}`}>
              Backend-only UNLV projects — live endpoints, interactive explorer
            </p>
          </div>
        </div>

        {/*
          Tier strip — mirrors ProjectChrome's pill. These projects skip the
          Enhanced tier entirely; only Original and Reimagined are surfaced.
          Each segment is a <Link> to its own route, so switching tiers is a
          real navigation that participates in the museum's view transitions.
        */}
        <nav className={styles.tierPicker} aria-label="Tier">
          <Link
            href="/api-client"
            aria-current={tier === "original" ? "page" : undefined}
            className={`${styles.tier} ${
              tier === "original" ? styles.tierCurrent : styles.tierIdle
            }`}
          >
            Original
          </Link>
          <Link
            href="/api-client/reimagined"
            aria-current={tier === "reimagined" ? "page" : undefined}
            className={`${styles.tier} ${
              tier === "reimagined" ? styles.tierCurrent : styles.tierIdle
            }`}
          >
            Reimagined
          </Link>
        </nav>

        <SignInChip />
      </header>

      <div className={styles.body}>
        {/* Left: Knowledge Base */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <p className={`text-xs ${styles.sidebarIntro}`}>
              Live endpoints backed by a real database.
            </p>
          </div>
          <div>
            {apis.map((api) => (
              <div key={api.id} className={styles.kbEntry}>
                <button
                  onClick={() => switchApi(api.id)}
                  className={`${styles.kbEntryButton} ${
                    activeApiId === api.id ? styles.kbEntryButtonActive : ""
                  }`}
                >
                  <p className={`text-sm ${styles.kbEntryTitle}`}>
                    {api.title}
                  </p>
                  <p className={`text-xs ${styles.kbEntryTech}`}>{api.tech}</p>
                </button>
                <Collapsible open={activeApiId === api.id}>
                  <div className={styles.kbDetailsPanel}>
                    <p className={`text-xs ${styles.kbDetailsDescription}`}>
                      {api.description}
                    </p>
                    <div className={styles.kbEndpoints}>
                      {api.endpoints.map((ep, i) => (
                        <button
                          key={i}
                          onClick={() => loadEndpoint(ep)}
                          className={`text-xs ${styles.kbEndpoint}`}
                        >
                          <span
                            className={styles.methodDot}
                            data-method={ep.method}
                          />
                          <span
                            className={styles.methodLabel}
                            data-method={ep.method}
                          >
                            {ep.method}
                          </span>
                          <span className={styles.kbEndpointDescription}>
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

          {history.length > 0 && (
            <div className={styles.history}>
              <p className={`text-xs ${styles.historyLabel}`}>History</p>
              <div className={styles.historyList}>
                {history.map((h, i) => (
                  <div key={i} className={`text-xs ${styles.historyItem}`}>
                    <span className={styles.methodDot} data-method={h.method} />
                    <span style={{ fontFamily: "var(--font-mono)" }}>
                      {h.method}
                    </span>
                    <span className={styles.historyApi}>{h.api}</span>
                    <span className={styles.historyMeta}>
                      {h.status} · {h.time}ms
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Right: Client */}
        <main className={styles.client}>
          <div className={styles.apiSwitchRow}>
            {apis.map((api, i) => (
              <div key={api.id} className={styles.apiSwitchGroup}>
                {i > 0 && <span className={styles.apiSwitchSeparator}>•</span>}
                <button
                  onClick={() => switchApi(api.id)}
                  className={`${styles.apiSwitchButton} ${
                    activeApiId === api.id ? "" : styles.apiSwitchInactive
                  }`}
                >
                  {api.title}
                </button>
                <Collapsible
                  open={activeApiId === api.id}
                  direction="horizontal"
                  duration={200}
                >
                  <span className={`text-xs ${styles.apiSwitchBaseUrl}`}>
                    {api.baseUrl}
                  </span>
                </Collapsible>
              </div>
            ))}
          </div>

          <div className={styles.requestRow}>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as Method)}
              className={`method-button ${styles.methodSelect}`}
              data-method={method}
              aria-label="HTTP method"
            >
              {(["GET", "POST", "PUT", "PATCH", "DELETE"] as const).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            {/*
              baseUrl prefix is a per-API segment glued to the path input.
              Rendering ALL candidates side-by-side (each wrapped in a
              horizontal Collapsible, only the active one open) makes
              switching APIs cross-fade the prefix — old one slides closed
              while the new one slides open in the same row — rather than
              swap text in place.
            */}
            <div className={styles.pathGroup}>
              {apis.map((api) => (
                <Collapsible
                  key={api.id}
                  open={api.id === activeApiId}
                  direction="horizontal"
                  duration={300}
                >
                  <span className={`text-sm ${styles.baseUrlPrefix}`}>
                    {api.baseUrl}
                  </span>
                </Collapsible>
              ))}
              <input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                className={`text-sm ${styles.pathInput}`}
                placeholder="/endpoint"
              />
            </div>
            <button
              onClick={send}
              disabled={loading}
              className={`btn btn-primary ${styles.sendButton}`}
            >
              {loading ? "..." : "Send"}
            </button>
          </div>

          {method !== "GET" && (
            <div className={styles.bodyEditor}>
              <label>Request Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                className={styles.bodyTextarea}
                placeholder='{"key": "value"}'
              />
            </div>
          )}

          <div className={styles.responsePane}>
            <div className={styles.responseHeader}>
              <span className={`text-xs ${styles.responseLabel}`}>
                Response
              </span>
              {status !== null && (
                <span
                  className={`text-xs ${styles.statusBadge} ${statusClass}`}
                >
                  {status}
                </span>
              )}
              {responseContentType && (
                <span className={`text-xs ${styles.contentType}`}>
                  Content-Type: {responseContentType}
                </span>
              )}
            </div>
            <ResponseBody text={response} contentType={responseContentType} />
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * Renders a fetched response body in the right mode for its content-type.
 *  - text/html  → sandboxed iframe via srcDoc, wrapped in a shimmer-bordered
 *                 frame so it reads as "this is a whole frontend embedded
 *                 here, served by the API you just hit."
 *  - other      → pre-formatted text (callers prettify JSON before passing).
 */
function ResponseBody({
  text,
  contentType,
}: {
  text: string | null;
  contentType: string | null;
}) {
  if (text === null) {
    return (
      <pre className={styles.responseText}>
        Select an endpoint from the left, then click Send
      </pre>
    );
  }

  const isHtml = contentType?.includes("text/html");
  if (isHtml) {
    return (
      <div className={`response-html-shimmer ${styles.responseHtmlShell}`}>
        <iframe
          title="Response (HTML)"
          srcDoc={text}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          className={styles.responseIframe}
        />
      </div>
    );
  }

  return <pre className={styles.responseText}>{text}</pre>;
}
