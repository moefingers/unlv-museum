"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { humanMessage } from "@/lib/toast-filter";
import { MuseumMark } from "@/components/ui/MuseumMark";
import styles from "./MuseumToastLayer.module.css";

/*
 * MuseumMark — the hexagon + inscribed triangle from src/app/icon.svg —
 * now lives at @/components/ui/MuseumMark. The toast layer uses it
 * with per-instance `hue` so the same mark can carry status meaning:
 *
 *   - 250  → museum blue (default; informational / unknown)
 *   -  70  → warning yellow (auth, 401/403)
 *   -  25  → destructive red (server, 5xx)
 *
 * Each toast renders its own SVG (unique gradient id per instance) so
 * the <defs> from multiple side-by-side toasts don't collide.
 */

/** Hue per toast kind — matches the border color treatment below. */
function hueForKind(kind: "auth" | "server" | "other"): number {
  if (kind === "auth") return 70; // yellow
  if (kind === "server") return 25; // red
  return 250; // museum blue
}

/**
 * Museum-level toast layer. Listens for `response-error` postMessages
 * from the museum-toast Service Worker (public/museum-toast-sw.js)
 * and renders a stacked toast UI in the top-right of the viewport.
 *
 * Use case: any time an iframed Original (or any museum-level fetch)
 * hits a 4xx/5xx response on a path the toast filter cares about,
 * the visitor sees a friendly toast explaining what happened — most
 * importantly, "sign in to do this" when a write fires a 401.
 *
 * The bottom-right corner is intentionally LEFT FREE so per-project
 * UIs (e.g. AdminPortalEnhanced's own toast stack) don't collide.
 *
 * Dedup: multiple SW messages with the same {url, status} arriving
 * within DEDUP_WINDOW_MS coalesce into one toast — useful when a
 * project's code retries silently and would otherwise stack
 * identical toasts.
 */

const TOAST_TTL_MS = 8000;
const DEDUP_WINDOW_MS = 1500;
const MAX_VISIBLE = 5;
/**
 * Duration the toast spends in the "leaving" state — applying the
 * slide-out animation class — before being unmounted from state.
 * Keep in lockstep with .toastLeaving's animation duration in the
 * module CSS, otherwise the unmount can race the animation.
 */
const TOAST_EXIT_MS = 220;

interface Toast {
  id: string;
  status: number;
  url: string;
  title: string;
  hint?: string;
  /** Timestamp the toast was created; used for dedup + auto-dismiss. */
  createdAt: number;
  /** True while the exit animation is running; the React node stays
   *  mounted for TOAST_EXIT_MS so the CSS animation can complete. */
  leaving?: boolean;
}

interface SwMessage {
  source: "museum-toast-sw";
  kind: "response-error";
  method: string;
  url: string;
  status: number;
  statusText: string;
  ts: number;
}

function isSwMessage(data: unknown): data is SwMessage {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    d.source === "museum-toast-sw" &&
    d.kind === "response-error" &&
    typeof d.url === "string" &&
    typeof d.status === "number"
  );
}

function toastKind(status: number): "auth" | "server" | "other" {
  if (status === 401 || status === 403) return "auth";
  if (status >= 500) return "server";
  return "other";
}

export function MuseumToastLayer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Two-phase dismissal: mark `leaving` so CSS runs the exit
  // animation, then unmount after TOAST_EXIT_MS. Idempotent — calling
  // dismiss on an already-leaving toast is a no-op.
  const dismiss = (id: string) => {
    setToasts((prev) => {
      // Already leaving? Don't restart the timer.
      const target = prev.find((t) => t.id === id);
      if (!target || target.leaving) return prev;
      return prev.map((t) => (t.id === id ? { ...t, leaving: true } : t));
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_EXIT_MS);
  };

  useEffect(() => {
    // Register the SW once on mount. No-op if already registered.
    // Errors are intentionally swallowed — toasts are a UX nicety,
    // not load-bearing functionality.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/museum-toast-sw.js", { scope: "/" })
        .catch(() => {
          /* SW registration failed; toasts will be silent. */
        });
    }

    const onMessage = (event: MessageEvent) => {
      if (!isSwMessage(event.data)) return;
      const { status, url } = event.data;
      const copy = humanMessage(status, url);
      const now = Date.now();
      const id = `${url}|${status}|${now}`;

      setToasts((prev) => {
        // Dedup: drop incoming if there's an identical {url, status}
        // toast from within the dedup window AND not already leaving
        // (so a stale-leaving toast doesn't suppress a fresh fire).
        const recentDuplicate = prev.find(
          (t) =>
            !t.leaving &&
            t.url === url &&
            t.status === status &&
            now - t.createdAt < DEDUP_WINDOW_MS,
        );
        if (recentDuplicate) return prev;
        const next: Toast = {
          id,
          status,
          url,
          title: copy.title,
          hint: copy.hint,
          createdAt: now,
        };
        // Cap the stack — drop the oldest if we'd exceed MAX_VISIBLE.
        const trimmed =
          prev.length >= MAX_VISIBLE
            ? prev.slice(prev.length - MAX_VISIBLE + 1)
            : prev;
        return [...trimmed, next];
      });

      // Auto-dismiss via the same two-phase path so the slide-out
      // animation runs regardless of whether the user clicked close
      // or the TTL fired. Schedule the leaving flip at TTL, and the
      // unmount at TTL + EXIT.
      setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
        );
      }, TOAST_TTL_MS);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, TOAST_TTL_MS + TOAST_EXIT_MS);
    };

    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className={styles.layer}
      role="region"
      aria-label="Museum notifications"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const kind = toastKind(t.status);
        const kindClass =
          kind === "auth"
            ? styles.toastAuth
            : kind === "server"
              ? styles.toastServer
              : "";
        let endpoint: string;
        try {
          endpoint = new URL(t.url).pathname;
        } catch {
          endpoint = t.url;
        }
        return (
          <div
            key={t.id}
            className={`${styles.toast} ${kindClass} ${t.leaving ? styles.toastLeaving : ""}`}
          >
            <span className={styles.icon}>
              <MuseumMark
                size={18}
                hue={hueForKind(kind)}
                gradientId={`museum-toast-mark-${t.id.replace(/[^a-z0-9]+/gi, "-")}`}
              />
            </span>
            <div className={styles.body}>
              <p className={`text-sm ${styles.title}`}>{t.title}</p>
              {t.hint && (
                <p className={`text-xs ${styles.hint}`}>
                  {t.hint.replace(endpoint, "")}
                  <span className={styles.endpoint}>{endpoint}</span>
                </p>
              )}
            </div>
            <button
              type="button"
              className={styles.close}
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
