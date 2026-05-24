"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Per-tab navigation trail, persisted to sessionStorage so a refresh
 * keeps the trail and a closed tab starts fresh.
 *
 * The trail is a stack of visited URLs + a cursor index pointing at
 * the "current" entry. Three transitions update it:
 *
 *   - Visit URL that matches stack[cursor - 1] → forward navigation.
 *     Cursor moves to cursor - 1.
 *   - Visit URL that matches stack[cursor + 1] → back navigation.
 *     Cursor moves to cursor + 1.
 *   - Visit any other URL → new navigation. Drop all entries
 *     forward of the cursor (browser semantics: navigating fresh
 *     erases the forward branch), push the new entry at index 0,
 *     reset cursor to 0.
 *
 * This lets us render back/forward as plain `<Link>` elements
 * pointing at `stack[cursor + 1]` and `stack[cursor - 1]` — they
 * route through Next's `experimental.viewTransition` machinery the
 * same way side-rail Links do, so the morph fires reliably. The
 * imperative `router.back()` / `router.forward()` path had spotty
 * transitions because Next's popstate handler only animates when
 * the router cache has the target.
 *
 * Tradeoff: clicking our back button pushes a NEW browser history
 * entry (it's a Link, not a popstate), so the OS's native back
 * button and ours diverge slightly — clicking ours back then the
 * browser's back ends up two entries deep. Acceptable cost for
 * reliable transitions on the affordance most visitors actually
 * use inside the museum.
 */

const STORAGE_KEY = "museum:nav-trail";
const MAX_ENTRIES = 32;

export interface TrailEntry {
  /** Full URL including query string, e.g. `/rest-rant?page=2`. */
  url: string;
  /** Path-only component (no query), used for project lookup. */
  pathname: string;
  /** Wall-clock ms of when this entry was last visited. */
  visitedAt: number;
}

interface TrailState {
  /** Newest-first list of URLs the visitor has touched. */
  stack: TrailEntry[];
  /** Index of the "current" entry within `stack`. 0 = newest. */
  cursor: number;
}

interface TrailSnapshot {
  /** Recents list with the current entry filtered out. */
  recents: TrailEntry[];
  /** URL to navigate to for back, or null if no entry behind. */
  backHref: string | null;
  /** URL to navigate to for forward, or null if no entry ahead. */
  forwardHref: string | null;
}

// --- external store --------------------------------------------------

const EMPTY_STATE: TrailState = { stack: [], cursor: 0 };
let cachedState: TrailState | null = null;
let cachedSnapshot: TrailSnapshot | null = null;
const subscribers = new Set<() => void>();

function readFromStorage(): TrailState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return EMPTY_STATE;
    const candidate = parsed as Partial<TrailState>;
    if (!Array.isArray(candidate.stack)) return EMPTY_STATE;
    if (typeof candidate.cursor !== "number") return EMPTY_STATE;
    const stack = candidate.stack.filter(
      (e): e is TrailEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as TrailEntry).url === "string" &&
        typeof (e as TrailEntry).pathname === "string" &&
        typeof (e as TrailEntry).visitedAt === "number",
    );
    const cursor = Math.max(0, Math.min(candidate.cursor, stack.length - 1));
    return { stack, cursor };
  } catch {
    return EMPTY_STATE;
  }
}

function writeToStorage(state: TrailState): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage full or disabled — recents become best-effort.
  }
}

function buildSnapshot(state: TrailState): TrailSnapshot {
  const { stack, cursor } = state;
  // Recents = everything except the current entry, deduped by
  // pathname so a back-and-forth walk (A → B → A → B) doesn't
  // surface the same project multiple times in the dropdown.
  //
  // We iterate the stack newest-first and keep the FIRST occurrence
  // of each pathname, which is the most-recent visit and therefore
  // carries the freshest URL (latest `?page=` / `?route=`). The
  // trail itself retains all entries because back/forward really do
  // navigate through every occurrence — the dropdown is a shortcut
  // ("jump to that project, wherever in the trail") not a mirror
  // of the full history.
  const seenPaths = new Set<string>([stack[cursor]?.pathname ?? ""]);
  const recents: TrailEntry[] = [];
  for (let i = 0; i < stack.length; i++) {
    if (i === cursor) continue;
    const entry = stack[i]!;
    if (seenPaths.has(entry.pathname)) continue;
    seenPaths.add(entry.pathname);
    recents.push(entry);
  }
  // backHref is the entry OLDER than current (higher index in a
  // newest-first stack); forwardHref is the entry NEWER (lower).
  const backHref = stack[cursor + 1]?.url ?? null;
  const forwardHref = stack[cursor - 1]?.url ?? null;
  return { recents, backHref, forwardHref };
}

function getCachedState(): TrailState {
  if (cachedState === null) cachedState = readFromStorage();
  return cachedState;
}

function getSnapshot(): TrailSnapshot {
  if (cachedSnapshot === null) cachedSnapshot = buildSnapshot(getCachedState());
  return cachedSnapshot;
}

// useSyncExternalStore wants reference-stable SSR snapshots.
const SSR_SNAPSHOT: TrailSnapshot = {
  recents: [],
  backHref: null,
  forwardHref: null,
};
function getServerSnapshot(): TrailSnapshot {
  return SSR_SNAPSHOT;
}

function subscribe(notify: () => void): () => void {
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
  };
}

function commitState(next: TrailState): void {
  cachedState = next;
  cachedSnapshot = buildSnapshot(next);
  writeToStorage(next);
  subscribers.forEach((notify) => notify());
}

/**
 * Pending-trail-nav signal. The back/forward Link's onClick sets one
 * of these to declare INTENT before navigating; the next recordVisit
 * consumes the signal and moves the cursor accordingly instead of
 * pushing a fresh entry.
 *
 * Why: from inside the recording effect, "the user clicked our chrome
 * back button" and "the user clicked a see-also Link that happens to
 * point at the previous page" produce identical observable input —
 * the same URL change. Browsers distinguish them via popstate vs.
 * pushState, but we don't have that signal once we've moved off
 * router.back/.forward. The intent flag is the cheapest replacement:
 * the only code that sets it is the back/forward affordance itself.
 *
 * Module-level instead of sessionStorage because it's transient
 * (lives one render-cycle) — putting it in storage would risk a
 * stale flag if a navigation aborted halfway. A simple ref pattern
 * is enough.
 */
let pendingIntent: "back" | "forward" | null = null;
export function markTrailNavigation(direction: "back" | "forward"): void {
  pendingIntent = direction;
}

function recordVisit(url: string, pathname: string): void {
  // Skip recording the museum landing — the mark itself points there,
  // listing it in the trail would be noise, and the back affordance
  // should land at /' as a FALLBACK not as a trail entry.
  if (pathname === "/") return;

  // Consume any pending trail-nav intent. We capture and clear it
  // FIRST so an aborted nav (e.g. visitor clicked back then quickly
  // navigated somewhere else) doesn't leak the flag into the next
  // recording.
  const intent = pendingIntent;
  pendingIntent = null;

  const state = getCachedState();
  const { stack, cursor } = state;

  // The trail dedupes by PATHNAME, not full URL. Two query-string
  // conventions coexist in the museum and they want opposite
  // treatment:
  //
  //   - `?page=...` (multi-page Originals) is a real museum
  //     navigation — but the user-facing "back" semantic is still
  //     "leave this project," not "go to the previous sub-page."
  //   - `?route=...` (OriginalFrame syncHash) is iframe-internal
  //     state mirrored via history.replaceState, fired by SPAs
  //     inside iframes whenever their HashRouter navigates. NOT a
  //     museum navigation.
  //
  // Keying the trail by pathname collapses both into "the project
  // you're on," which matches the visitor's mental model. The full
  // URL is still stored on the entry so backHref / forwardHref
  // route to the most-recent query state for that pathname.

  // Same pathname as current entry: refresh the URL (so we preserve
  // the latest `?page=` / `?route=`) and bump the timestamp. Don't
  // disturb the stack/cursor.
  if (stack[cursor]?.pathname === pathname) {
    const refreshed = [...stack];
    refreshed[cursor] = { url, pathname, visitedAt: Date.now() };
    commitState({ stack: refreshed, cursor });
    return;
  }

  // Trail-back: caller declared intent and the URL matches the entry
  // one OLDER than current. Refresh that entry's URL so a subsequent
  // forward click returns to the same query. Without the intent
  // flag, a fresh navigation that HAPPENS to point at the previous
  // page (e.g. a see-also Link from project A → project B → back to
  // A via a fresh see-also click) would be mis-detected as a back
  // and the cursor would just move instead of a new entry pushing.
  if (intent === "back" && stack[cursor + 1]?.pathname === pathname) {
    const refreshed = [...stack];
    refreshed[cursor + 1] = { url, pathname, visitedAt: Date.now() };
    commitState({ stack: refreshed, cursor: cursor + 1 });
    return;
  }

  // Trail-forward: caller declared intent and the URL matches the
  // entry one NEWER than current.
  if (intent === "forward" && stack[cursor - 1]?.pathname === pathname) {
    const refreshed = [...stack];
    refreshed[cursor - 1] = { url, pathname, visitedAt: Date.now() };
    commitState({ stack: refreshed, cursor: cursor - 1 });
    return;
  }

  // Fresh navigation: drop everything FORWARD of the cursor (those
  // entries are now invalidated, same as browser history when you
  // navigate fresh from a back-state), push the new entry at index 0,
  // reset cursor.
  const remaining = stack.slice(cursor);
  const next: TrailEntry[] = [
    { url, pathname, visitedAt: Date.now() },
    ...remaining,
  ].slice(0, MAX_ENTRIES);
  commitState({ stack: next, cursor: 0 });
}

// --- public hook -----------------------------------------------------

/**
 * Subscribe to the trail snapshot AND record the current URL as a
 * side effect of mounting on a given route. Returns:
 *
 *   - recents: list of OTHER visited URLs in newest-first order.
 *     Drives the chrome's recents dropdown.
 *   - backHref: URL for the back link, or null when there's no
 *     entry behind (button should render disabled).
 *   - forwardHref: URL for the forward link, or null when there's
 *     no entry ahead.
 *
 * Mounted by `MuseumChrome` so every chrome-bearing route navigation
 * pushes / advances the trail. Calling it from multiple places is
 * safe — they all see the same store and the recording effect is
 * idempotent for a given URL.
 */
export function useNavTrail(): TrailSnapshot {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();
  const currentUrl = currentSearch ? `${pathname}?${currentSearch}` : pathname;

  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    recordVisit(currentUrl, pathname);
  }, [currentUrl, pathname]);

  return snapshot;
}
