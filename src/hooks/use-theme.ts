"use client";

import { useSyncExternalStore, useCallback, useEffect } from "react";

/**
 * Theme hook — mode (light/dark/system) + named theme preset.
 *
 * Mirrors zcanon's src/hooks/use-theme.ts; the FOUC-prevention
 * bootstrap that runs before paint lives in public/theme-init.js
 * and uses the SAME storage keys this hook does (museum-mode +
 * museum-theme). Drift between the two files = FOUC + a flicker
 * on every page load.
 *
 * Single source of truth: localStorage. useSyncExternalStore
 * subscribes to the `storage` event (cross-tab) and to
 * matchMedia (when mode === "system" and the OS flips). The
 * `applyMode`/`applyThemeName` effects below mirror the store's
 * state to the <html> element's className/data-theme so CSS
 * variables resolve correctly.
 *
 * Why a same-tab dispatch of `Event("storage")` in setMode/setTheme:
 * the native `storage` event only fires in OTHER tabs by spec.
 * Without our manual dispatch, clicking the toggle would update
 * localStorage but the hook in the same tab wouldn't notice until
 * something else triggered a re-subscription.
 */
export type Mode = "light" | "dark" | "system";
export type ResolvedMode = "light" | "dark";

const MODE_KEY = "museum-mode";
const THEME_KEY = "museum-theme";

function resolveMode(stored: string | null): ResolvedMode {
  if (stored === "light" || stored === "dark") return stored;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getModeSnapshot(): Mode {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(MODE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system")
    return stored;
  return "system";
}

function getResolvedModeSnapshot(): ResolvedMode {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(MODE_KEY);
  return resolveMode(stored === "system" ? null : stored);
}

function getThemeSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(THEME_KEY);
}

function getServerSnapshot(): Mode {
  return "system";
}

function getServerResolvedSnapshot(): ResolvedMode {
  return "light";
}

function getServerThemeSnapshot(): string | null {
  return null;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    mq.removeEventListener("change", callback);
  };
}

function applyMode(resolved: ResolvedMode) {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

function applyThemeName(name: string | null) {
  if (name) {
    document.documentElement.setAttribute("data-theme", name);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

function withViewTransition(fn: () => void) {
  if (document.startViewTransition) {
    // Rapid toggles abort the previous transition — its finished promise
    // rejects with InvalidStateError. Catch so it doesn't bubble up.
    document.startViewTransition(fn).finished.catch(() => {});
  } else {
    fn();
  }
}

export function useTheme() {
  const mode = useSyncExternalStore(
    subscribe,
    getModeSnapshot,
    getServerSnapshot,
  );
  const resolvedMode = useSyncExternalStore(
    subscribe,
    getResolvedModeSnapshot,
    getServerResolvedSnapshot,
  );
  const theme = useSyncExternalStore(
    subscribe,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  useEffect(() => {
    applyMode(resolvedMode);
  }, [resolvedMode]);

  useEffect(() => {
    applyThemeName(theme);
  }, [theme]);

  const setMode = useCallback((next: Mode) => {
    withViewTransition(() => {
      localStorage.setItem(MODE_KEY, next);
      window.dispatchEvent(new Event("storage"));
    });
  }, []);

  const toggleMode = useCallback(() => {
    const current = getResolvedModeSnapshot();
    setMode(current === "dark" ? "light" : "dark");
  }, [setMode]);

  const setTheme = useCallback((name: string | null) => {
    withViewTransition(() => {
      if (name) {
        localStorage.setItem(THEME_KEY, name);
      } else {
        localStorage.removeItem(THEME_KEY);
      }
      window.dispatchEvent(new Event("storage"));
    });
  }, []);

  return { mode, resolvedMode, theme, setMode, toggleMode, setTheme };
}
