"use client";

import { useState, useEffect, Suspense, ViewTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ArrowRightLeft } from "lucide-react";
import { Collapsible } from "@/components/ui/Collapsible";
import { MuseumChrome } from "@/components/ui/MuseumChrome";
import {
  APIS_ORIGINAL,
  APIS_ENHANCED,
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
 * The single api-client viewer. ONE component for ALL API versions —
 * `?v=1` (default) shows the source-faithful endpoints, `?v=2` shows
 * the Enhanced (audit log, batch, helpful 401, etc.) endpoints. The
 * client stays mounted across version flips; only the displayed
 * endpoint list and tab pill change, with the cross-fade driven by
 * the <ViewTransition name="page-content"> boundary inside.
 *
 * `initialTier` from the server keeps SSR/CSR agreement on first
 * paint; after mount, the URL's `?v=` is the source of truth and
 * useSearchParams keeps the displayed tier in sync without a server
 * round-trip.
 */
export default function ApiClient({ tier }: { tier: Tier }) {
  return (
    <Suspense>
      <ApiClientInner initialTier={tier} />
    </Suspense>
  );
}

/**
 * Compose the destination URL for the tier picker pills.
 *
 * Preserves the currently-active api id when that api also exists in the
 * destination tier's list — so a v1→v2 click on the music-tour API
 * lands on `?api=music-tour&v=2` instead of bouncing to v2's default
 * first api via the page's `if (!known)` redirect.
 */
function tierHref(destinationTier: Tier, activeApiId: string): string {
  const destinationList =
    destinationTier === "enhanced" ? APIS_ENHANCED : APIS_ORIGINAL;
  const hasInDestination = destinationList.some((a) => a.id === activeApiId);
  const params = new URLSearchParams();
  if (hasInDestination) params.set("api", activeApiId);
  if (destinationTier === "enhanced") params.set("v", "2");
  const qs = params.toString();
  return qs ? `/api-client?${qs}` : "/api-client";
}

function ApiClientInner({ initialTier }: { initialTier: Tier }) {
  const searchParams = useSearchParams();
  // The URL is the source of truth after mount. `initialTier` keeps
  // SSR/CSR agreement on the first render; on subsequent renders the
  // `?v=` param drives which endpoint list shows. `useSearchParams`
  // re-renders ApiClient when the URL changes, and the <ViewTransition>
  // boundary fires the cross-fade.
  const vParam = searchParams.get("v");
  const tier: Tier =
    vParam === "2" ? "enhanced" : vParam === "1" ? "original" : initialTier;
  const apis = tier === "enhanced" ? APIS_ENHANCED : APIS_ORIGINAL;
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

  // PostMessage bridge — lets HTML responses rendered in the iframe
  // (e.g. the modernized Enhanced sql-demo form's "Browse the trail"
  // link) drive the request builder above. The iframe posts a
  // { source: "museum-api-client", kind: "loadEndpoint", api, method,
  // path } message; we look up the api, switch if needed, then mirror
  // the same state changes the left-rail endpoint buttons do — so the
  // path input shows the new route and the visitor is one Send click
  // from seeing the response in the same client.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data as
        | {
            source?: unknown;
            kind?: unknown;
            api?: unknown;
            method?: unknown;
            path?: unknown;
          }
        | undefined
        | null;
      if (
        !data ||
        data.source !== "museum-api-client" ||
        data.kind !== "loadEndpoint"
      )
        return;
      if (
        typeof data.api !== "string" ||
        typeof data.method !== "string" ||
        typeof data.path !== "string"
      )
        return;
      const targetApi = apis.find((a) => a.id === data.api);
      if (!targetApi) return;
      // Switch api if the message names a different one. Mirror
      // switchApi's URL update so refreshes preserve the selection.
      if (targetApi.id !== activeApiId) {
        setActiveApiId(targetApi.id);
        const url = new URL(window.location.href);
        url.searchParams.set("api", targetApi.id);
        window.history.replaceState({}, "", url.toString());
      }
      setMethod(data.method as Method);
      setPath(data.path);
      setBody("");
      // Don't clear response/status — the iframe's own navigation
      // (when the link wasn't preventDefault'd) is showing the new
      // endpoint's result; clearing would race with that.
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [apis, activeApiId]);

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
      {/*
        Shared museum chrome. /api-client surfaces Original + Enhanced
        tiers (same request/response shape, augmented with era-impossible
        additions like audit logs). Reimagined for any given project lives
        at that project's own slug (different stack, different surface) —
        it's not a tab here.
      */}
      <MuseumChrome
        title="API Client"
        subtitle="Backend-only UNLV projects — live endpoints, interactive explorer"
        tiers={[
          {
            // `?v=` is a soft URL change within the same route — Next
            // re-renders ApiClient without remounting, the <ViewTransition>
            // boundary around the body fires the cross-fade because its
            // wrapped content changes, and the chrome's CSS
            // `view-transition-name: site-header` keeps the header
            // animating in place rather than fading with the body.
            label: "Original",
            href: tierHref("original", activeApiId),
            current: tier === "original",
          },
          {
            label: "Enhanced",
            href: tierHref("enhanced", activeApiId),
            current: tier === "enhanced",
          },
        ]}
      />

      {/* Wrap the entire body (sidebar + main) in <ViewTransition> so
          both panels cross-fade on `?v=` flips. If only the right pane
          were wrapped, the sidebar's API list would snap instantly to
          the new version's entries while the main pane fades — the
          mismatch looks broken. The chrome above lives OUTSIDE this
          boundary and persists via its own `view-transition-name:
          site-header` so the header animates in place rather than
          fading with the body. */}
      <ViewTransition name="page-content">
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
                    <p className={`text-xs ${styles.kbEntryTech}`}>
                      {api.tech}
                    </p>
                  </button>
                  <Collapsible open={activeApiId === api.id}>
                    <div className={styles.kbDetailsPanel}>
                      <p className={`text-xs ${styles.kbDetailsDescription}`}>
                        {api.description}
                      </p>
                      {api.relatedRoute && (
                        // Cross-link to the paired museum route (the
                        // frontend half of an api+client pair, or a
                        // Replaced UI). Sits between the description
                        // and the endpoints list so visitors notice
                        // it before they start poking endpoints.
                        <Link
                          href={api.relatedRoute.url}
                          className={`text-xs ${styles.kbRelatedRoute}`}
                        >
                          <ArrowRightLeft size={12} aria-hidden="true" />
                          <span>{api.relatedRoute.label}</span>
                        </Link>
                      )}
                      <div className={styles.kbEndpoints}>
                        {api.endpoints.map((ep, i) => {
                          // Expand the description to its full multi-line
                          // text when this endpoint matches the
                          // request-builder's current method+path — i.e.,
                          // "the one you're currently working with."
                          // Otherwise it stays clamped to a single line.
                          const expanded =
                            api.id === activeApiId &&
                            ep.method === method &&
                            ep.path === path;
                          return (
                            <button
                              key={i}
                              onClick={() => loadEndpoint(ep)}
                              className={`text-xs ${styles.kbEndpoint}`}
                              data-expanded={expanded || undefined}
                            >
                              {/* Two-row layout per rail entry:
                                  Row 1: [dot] METHOD /path  (the literal
                                         request shape — one identifying line)
                                  Row 2: description (clamped to one line
                                         by default, expanded to full
                                         multi-line text when this entry
                                         is the active request — see
                                         .kbEndpointDescription /
                                         [data-expanded] CSS) */}
                              <div className={styles.kbEndpointTopRow}>
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
                                <span
                                  className={`text-mono ${styles.kbEndpointPath}`}
                                >
                                  {ep.path}
                                </span>
                              </div>
                              <span className={styles.kbEndpointDescription}>
                                {ep.description}
                              </span>
                            </button>
                          );
                        })}
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
                      <span
                        className={styles.methodDot}
                        data-method={h.method}
                      />
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

          {/* Right: Client.

            The .client itself is the scroll container; the controls
            block (api switcher + request builder + body editor +
            response header) is wrapped in .controlsSticky which uses
            `position: sticky; top: 0` so the controls stay glued to
            the top of the pane while the response body underneath
            scrolls. The sticky group has a translucent backdrop so the
            scrolling response is visibly sliding under it. */}
          <main className={styles.client}>
            <div className={styles.controlsSticky}>
              <div className={styles.apiSwitchRow}>
                {apis.map((api, i) => (
                  <div key={api.id} className={styles.apiSwitchGroup}>
                    {i > 0 && (
                      <span className={styles.apiSwitchSeparator}>•</span>
                    )}
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
                  {(["GET", "POST", "PUT", "PATCH", "DELETE"] as const).map(
                    (m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ),
                  )}
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
            </div>

            <ResponseBody text={response} contentType={responseContentType} />
          </main>
        </div>
      </ViewTransition>
    </div>
  );
}

/**
 * Renders a fetched response body in the right mode for its content-type.
 *  - text/html   → sandboxed iframe via srcDoc, wrapped in a shimmer-
 *                  bordered frame so it reads as "this is a whole
 *                  frontend embedded here, served by the API you just
 *                  hit."
 *  - image/svg+xml → rendered as an <img> with a data: URL plus the
 *                    raw SVG source shown underneath in a <details>,
 *                    so visitors see BOTH the rendered output and the
 *                    SVG markup that the endpoint returned.
 *  - other       → pre-formatted text (callers prettify JSON before
 *                  passing).
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
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          className={styles.responseIframe}
        />
      </div>
    );
  }

  // SVG is text-safe and the only image format we currently emit
  // (cover endpoint). For PNG/JPEG/etc. responses we'd need a binary
  // fetch path — none of the museum's routes return those today.
  const isSvg = contentType?.includes("image/svg");
  if (isSvg) {
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(text)}`;
    return (
      <div className={styles.responseImageShell}>
        <img
          src={dataUrl}
          alt="Response (SVG)"
          className={styles.responseImage}
        />
        <details className={styles.responseImageSource}>
          <summary className="text-xs">View SVG source</summary>
          <pre className={`text-xs ${styles.responseText}`}>{text}</pre>
        </details>
      </div>
    );
  }

  return <pre className={styles.responseText}>{text}</pre>;
}
