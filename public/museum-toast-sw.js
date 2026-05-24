/**
 * museum-toast-sw.js — Service Worker that surfaces filtered server errors
 * as museum-level toasts.
 *
 * Scope: registered at the museum origin's root, so it intercepts every
 * same-origin fetch from every page AND every iframe loaded from the
 * same origin (including /originals/<slug>/*). Cross-origin fetches
 * are opaque to the SW; that's a Service Worker limitation, not a
 * design choice.
 *
 * Flow:
 *   1. fetch(event.request) — pass through unmodified
 *   2. Inspect the resolved response status
 *   3. If shouldSurface(method, url, status) — postMessage to every
 *      controlled client with the response envelope
 *   4. The MuseumToastLayer component on each page renders the toast
 *
 * Filter logic is mirrored from src/lib/toast-filter.ts. Keep the two
 * in sync — there's no build step pulling the TS in here. The TS file
 * is the source of truth; treat changes here as the secondary edit.
 */

/* eslint-disable no-undef */

const PATH_INCLUDES = [/^\/api\//, /^\/originals\//];

const PATH_EXCLUDES = [
  /^\/api\/auth\//,
  /^\/_next\//,
  /\.(?:png|jpe?g|gif|svg|webp|ico|woff2?|ttf|otf|css|map)(?:\?|$)/i,
];

function shouldSurface(_method, url, status) {
  if (status < 400) return false;
  let pathname;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return false;
  }
  for (const excluded of PATH_EXCLUDES) {
    if (excluded.test(pathname)) return false;
  }
  for (const included of PATH_INCLUDES) {
    if (included.test(pathname)) return true;
  }
  return false;
}

// Skip waiting on the previous SW + claim all clients immediately on
// activate. Without these the SW would only start intercepting on the
// NEXT page load after install, which makes the toast-on-first-error
// experience flaky for visitors who happen to hit a 401 right after
// the SW upgrades.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// The intercept. We DON'T call event.respondWith() — that would force
// us to clone the response and risk introducing latency or bugs in
// the pass-through path. Instead we let the browser handle the fetch
// natively and just observe the eventual response via waitUntil +
// a parallel fetch. Trade-off: this fires a second request, which is
// wasteful. Switching to respondWith + clone is the right call once
// this proves out.
//
// Actually — Service Workers DO see the response object through
// respondWith without a second request. Let's do that properly:
self.addEventListener("fetch", (event) => {
  // Only intercept GET/POST/PUT/PATCH/DELETE — Workers can't easily
  // observe websocket frames or EventSource streams, and they aren't
  // toast candidates anyway.
  const method = event.request.method;
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) return;

  event.respondWith(
    fetch(event.request).then((response) => {
      // Inspect status; postMessage if it crosses the filter.
      if (shouldSurface(method, event.request.url, response.status)) {
        self.clients
          .matchAll({ includeUncontrolled: true, type: "window" })
          .then((clients) => {
            for (const client of clients) {
              client.postMessage({
                source: "museum-toast-sw",
                kind: "response-error",
                method,
                url: event.request.url,
                status: response.status,
                statusText: response.statusText,
                ts: Date.now(),
              });
            }
          });
      }
      return response;
    }),
  );
});
