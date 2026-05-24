/**
 * Toast filter — decides which intercepted responses become museum-level
 * toasts, and what those toasts say.
 *
 * Shared between the Service Worker (public/museum-toast-sw.js) and any
 * UI code that wants to test the same predicates. Pure functions, no
 * DOM access, no React — safe to import from a Worker context.
 *
 * The Service Worker imports this file as ESM (`importScripts` is the
 * legacy path; Workers in Chrome support `import` since the module-
 * worker era). To keep that import simple, this file is plain TS with
 * NO project-relative `@/` imports — only relative paths or stdlib.
 */

/**
 * Path prefixes the toast layer cares about. Anything matching one of
 * these is a candidate for a toast (subject to PATH_EXCLUDES and the
 * status filter). Same-origin only — cross-origin responses are mostly
 * opaque to Service Workers anyway.
 */
const PATH_INCLUDES: RegExp[] = [/^\/api\//, /^\/originals\//];

/**
 * Path patterns explicitly muted. Better Auth's session-probe routes
 * return 401 by design when a visitor isn't signed in — that's not a
 * user-actionable error and would spam every page load. Next's HMR
 * traffic in dev is similarly noisy. Add new entries here when a
 * legitimate-but-noisy endpoint surfaces.
 */
const PATH_EXCLUDES: RegExp[] = [
  // Better Auth session lookups — these 401 by design when unauthed.
  /^\/api\/auth\//,
  // Next.js HMR + dev pipeline traffic.
  /^\/_next\//,
  // Static asset 404s — projects sometimes intentionally reference
  // missing images (placeholder fallbacks); a flood of asset toasts
  // would drown out the actually-actionable mutation errors.
  /\.(?:png|jpe?g|gif|svg|webp|ico|woff2?|ttf|otf|css|map)(?:\?|$)/i,
];

/**
 * Decide whether an intercepted response gets surfaced as a museum
 * toast. Called from the Service Worker's `fetch` handler after the
 * upstream response settles.
 *
 *   - status < 400 → never toast (success path)
 *   - excluded path → never toast (known noise)
 *   - included path + 4xx/5xx → toast
 *   - everything else → never toast
 *
 * Method is currently unused but kept in the signature so we can
 * later mute, e.g., 404s on GET while keeping POST 404s visible
 * (different semantics — POST 404 often means "stale handler").
 */
export function shouldSurface(
  _method: string,
  url: string,
  status: number,
): boolean {
  if (status < 400) return false;
  let pathname: string;
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

/**
 * Human-readable message for a status code, with optional per-status
 * hints. The endpoint URL is passed so the message can quote it where
 * useful ("Add Book at /api/admin-portal/addBook needs sign-in").
 *
 * Returns `{ title, hint? }` so the toast UI can decide its layout —
 * one prominent line + an optional dimmer sub-line for the actionable
 * next step.
 */
export interface ToastCopy {
  title: string;
  hint?: string;
}

export function humanMessage(status: number, url: string): ToastCopy {
  let endpoint: string;
  try {
    endpoint = new URL(url).pathname;
  } catch {
    endpoint = url;
  }
  if (status === 401) {
    return {
      title: "Sign in to continue",
      hint: `${endpoint} requires a museum account. Use the avatar menu (top-right) to sign in with GitHub.`,
    };
  }
  if (status === 403) {
    return {
      title: "Permission denied",
      hint: `${endpoint} refused the request even though you're signed in. The action may be reserved for project owners.`,
    };
  }
  if (status === 404) {
    return {
      title: "Endpoint not found",
      hint: `${endpoint} responded 404 — the route may have been renamed or never existed.`,
    };
  }
  if (status === 409) {
    return {
      title: "Conflict",
      hint: `${endpoint} rejected the request because of a conflict (probably a duplicate or stale state).`,
    };
  }
  if (status === 429) {
    return {
      title: "Rate limit reached",
      hint: `${endpoint} is throttling you. Wait a minute and try again, or sign in for a higher budget.`,
    };
  }
  if (status >= 500 && status < 600) {
    return {
      title: "Server error",
      hint: `${endpoint} returned ${status}. The museum server hiccuped; try again in a moment.`,
    };
  }
  if (status >= 400 && status < 500) {
    return {
      title: `Request rejected (${status})`,
      hint: `${endpoint} returned ${status}.`,
    };
  }
  return {
    title: `Unexpected response (${status})`,
    hint: `${endpoint} returned ${status}.`,
  };
}
