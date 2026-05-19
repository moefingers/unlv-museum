"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import { Collapsible } from "@/components/ui/Collapsible";
import { SignInChip } from "@/components/auth/SignInChip";
import {
  APIS_ORIGINAL,
  APIS_REIMAGINED,
  type Endpoint,
  type Method,
  type Tier,
} from "./api-data";
import styles from "./ApiClient.module.css";

export type { Tier } from "./api-data";

/* Per-method colors and the small dot indicator are driven by --method-*
   tokens in globals.css. JSX consumers set data-method="GET|POST|..." on
   .methodDot / .methodLabel / .method-button elements and the right
   color cascades automatically — no JS lookup table needed. */

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
  // Server already redirected the bare URL to ?api=<first>; null means a
  // typo'd query param survived (or browser back to a hand-edited URL).
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
  // Sidebar collapse — only meaningful on narrow viewports. CSS at the wide
  // breakpoint pins the sidebar open regardless of this flag, so toggling
  // it on a desktop is a no-op visually but harmless to leave wired.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Esc closes the sidebar drawer on narrow viewports. Bound only while
  // open to keep the document key surface clean.
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  const activeApi = apis.find((a) => a.id === activeApiId) ?? apis[0]!;

  const switchApi = (id: string) => {
    setActiveApiId(id);
    setPath("/");
    setMethod("GET");
    setBody("");
    setResponse(null);
    setResponseContentType(null);
    setStatus(null);
    // Drawer closes on selection; wide viewports ignore the flag via CSS.
    setSidebarOpen(false);
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
    <div className={styles.shell} data-sidebar-open={sidebarOpen}>
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
        {/* Backdrop sits behind the drawer on narrow viewports; CSS hides
            it above the breakpoint. Click closes the drawer. */}
        <button
          type="button"
          className={styles.sidebarBackdrop}
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Left: Knowledge Base */}
        <aside
          id="api-sidebar"
          className={styles.sidebar}
          aria-hidden={!sidebarOpen}
        >
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

        {/* Drawer toggle. Pinned to the right edge of the sidebar's open
            position. Hidden above the breakpoint via CSS — wide viewports
            render the sidebar permanently. The chevron rotates 180° when
            open (→ becomes ←) since both states are "pull this direction." */}
        <button
          type="button"
          className={styles.sidebarToggle}
          aria-controls="api-sidebar"
          aria-expanded={sidebarOpen}
          aria-label={sidebarOpen ? "Close API list" : "Open API list"}
          onClick={() => setSidebarOpen((v) => !v)}
        >
          <ChevronLeft
            size={18}
            className={styles.sidebarToggleIcon}
            aria-hidden="true"
          />
        </button>

        {/* Right: Client. Named page-content so tier swaps fade+blur the
            body the same way project pages do. Sidebar (left) and header
            (above) stay pinned via their own names. */}
        <main
          className={styles.client}
          style={{ viewTransitionName: "page-content" }}
        >
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
