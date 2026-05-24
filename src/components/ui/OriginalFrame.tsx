"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./OriginalFrame.module.css";

/**
 * Auto-size a same-origin iframe to its content height so the museum's
 * outer leafBody is the single scroll surface (with its custom
 * scrollbar). Without this, the iframe's CSS `height: 100dvh` makes
 * the iframe an internally-scrolling box and we get TWO scrollbars:
 *   1. the iframe's own native bar (because content > 100dvh)
 *   2. the leafBody's custom bar (because iframe + spacers > 100dvh)
 *
 * Strategy: after the iframe's document is ready, read the inner
 * documentElement.scrollHeight and write it back to the iframe's
 * inline height. Re-measure on:
 *   - the inner window's `resize` (font load, image load, etc.)
 *   - a MutationObserver on the inner body (form expands, lazy
 *     content swaps in)
 *   - a ResizeObserver on the inner documentElement (covers cases
 *     mutation observer misses, e.g. flex reflow on outer resize)
 *
 * Cross-origin iframes throw on contentDocument access — guard with
 * a try/catch and fall back to the CSS `height: 100dvh`.
 */
function useAutoSizeIframe(iframeRef: React.RefObject<HTMLIFrameElement | null>) {
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;
    let detachResize: (() => void) | null = null;

    const measure = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        // Use documentElement (html element) — scrollHeight on the
        // doc element covers both flow content and absolutely-
        // positioned content. body.scrollHeight sometimes misses
        // tall absolutely-positioned children.
        const h = doc.documentElement.scrollHeight;
        if (h > 0) iframe.style.height = `${h}px`;
      } catch {
        // Cross-origin or detached document — leave CSS height alone.
      }
    };

    const wire = () => {
      try {
        const doc = iframe.contentDocument;
        const win = iframe.contentWindow;
        if (!doc || !win) return;
        measure();
        // Same-origin: addEventListener / observers all work directly.
        const onResize = () => measure();
        win.addEventListener("resize", onResize);
        detachResize = () => win.removeEventListener("resize", onResize);
        mo = new MutationObserver(measure);
        mo.observe(doc.body, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true,
        });
        ro = new ResizeObserver(measure);
        ro.observe(doc.documentElement);
      } catch {
        // Cross-origin; CSS fallback applies.
      }
    };

    // Iframes may already be loaded by the time the effect fires.
    if (iframe.contentDocument?.readyState === "complete") {
      wire();
    }
    const onLoad = () => {
      // Re-wire on each navigation inside the iframe. Old observers
      // attached to the previous document are detached by load.
      detachResize?.();
      mo?.disconnect();
      ro?.disconnect();
      detachResize = null;
      mo = null;
      ro = null;
      wire();
    };
    iframe.addEventListener("load", onLoad);

    return () => {
      iframe.removeEventListener("load", onLoad);
      detachResize?.();
      mo?.disconnect();
      ro?.disconnect();
    };
  }, [iframeRef]);
}

/**
 * Iframe wrapper for an Original-tier static asset (HTML, CRA build,
 * Vite build, etc). Sandboxed; same-origin so React can read the
 * iframe's contentWindow when `syncHash` is on.
 *
 * When `syncHash` is true, the OUTER browser URL carries the iframe's
 * current hash route via a `?route=` query param. Same family as the
 * existing `?page=` pattern that multi-page Originals use:
 *
 *   /rest-rant                  → iframe loads bare src
 *   /rest-rant?route=/places/4  → iframe loads src + "#/places/4"
 *
 * Bidirectional:
 *   - On mount: read `?route` from the museum URL, set iframe.src
 *     accordingly so refresh / share / direct-link all land at the
 *     correct SPA route.
 *   - On the iframe's `hashchange`: write the new hash back to the
 *     museum URL via history.replaceState (no scroll, no remount).
 *
 * Visitors who never enable an SPA route still see a clean
 * `/rest-rant` outer URL. Only the first hash change appends a
 * `?route=`. Opt-in via the `syncHash` prop on a per-project basis
 * in `src/lib/projects.tsx`.
 */
interface OriginalFrameProps {
  src: string;
  /**
   * When true, sync the iframe's hash fragment with a `?route=`
   * query param on the museum URL. Enable for iframed SPAs that
   * use a HashRouter (rest-rant CRA, art-gallery, music-search,
   * montys-mineral-spa, declarative-counter). Default false to
   * keep single-screen projects' URLs uncluttered.
   */
  syncHash?: boolean;
}

export function OriginalFrame(props: OriginalFrameProps) {
  // useSearchParams suspends in App Router; isolate it behind a boundary
  // so single-screen iframes (no syncHash) don't pay the cost.
  if (!props.syncHash) {
    return <PlainFrame src={props.src} />;
  }
  return (
    <Suspense fallback={<PlainFrame src={props.src} />}>
      <SyncingFrame src={props.src} />
    </Suspense>
  );
}

function PlainFrame({ src }: { src: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useAutoSizeIframe(iframeRef);
  return (
    <iframe
      ref={iframeRef}
      src={src}
      className={`${styles.frame} ${styles.frameOriginal}`}
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
      title="Original project"
    />
  );
}

function SyncingFrame({ src }: { src: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useAutoSizeIframe(iframeRef);
  const searchParams = useSearchParams();
  // The initial `?route=` value at mount — used to compose the initial
  // iframe src. Reads from the URL *once* on render so the iframe's
  // src attribute is stable and React doesn't remount on every URL
  // tick. Subsequent ?route= changes are handled by the effect below.
  const initialRoute = searchParams.get("route");
  const initialSrc = initialRoute ? composeSrcWithHash(src, initialRoute) : src;

  // Attach the iframe's `hashchange` listener once the iframe document
  // loads. The iframe is same-origin so contentWindow.addEventListener
  // works directly — no postMessage bridge needed for this leg.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const wireHashSync = () => {
      const cw = iframe.contentWindow;
      if (!cw) return;
      const onHashChange = () => {
        // Read the iframe's current hash (without the leading "#")
        const hash = cw.location.hash.replace(/^#/, "");
        const url = new URL(window.location.href);
        if (hash) {
          if (url.searchParams.get("route") === hash) return;
          url.searchParams.set("route", hash);
        } else {
          if (!url.searchParams.has("route")) return;
          url.searchParams.delete("route");
        }
        // replaceState (not pushState) so the museum's outer history
        // isn't polluted with one entry per SPA navigation. The SPA's
        // own HashRouter still maintains its own history inside the
        // iframe — back/forward at the browser level pops the outer
        // entry, but visitors who want to back-step inside the SPA
        // can use the SPA's own UI. (Tradeoff: pushState would put
        // every nav in browser history; replaceState matches the
        // ?page= pattern's behavior, which is also replaceState.)
        window.history.replaceState({}, "", url.toString());
      };
      cw.addEventListener("hashchange", onHashChange);
      return () => cw.removeEventListener("hashchange", onHashChange);
    };

    // Wire once the iframe's document is ready. Use both `load` and an
    // immediate attempt — same-origin iframes are sometimes already
    // loaded by the time the effect fires.
    let cleanup: (() => void) | undefined;
    if (iframe.contentDocument?.readyState === "complete") {
      cleanup = wireHashSync();
    }
    const onLoad = () => {
      cleanup?.();
      cleanup = wireHashSync();
    };
    iframe.addEventListener("load", onLoad);
    return () => {
      iframe.removeEventListener("load", onLoad);
      cleanup?.();
    };
  }, []);

  // If the outer ?route= changes due to browser back/forward, push
  // that into the iframe's hash. Guarded so we don't fight the
  // hashchange listener above when the iframe was the source of truth.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const cw = iframe.contentWindow;
    if (!cw) return;
    const targetHash = searchParams.get("route") ?? "";
    const currentHash = cw.location.hash.replace(/^#/, "");
    if (targetHash === currentHash) return;
    cw.location.hash = targetHash;
  }, [searchParams]);

  return (
    <iframe
      ref={iframeRef}
      src={initialSrc}
      className={`${styles.frame} ${styles.frameOriginal}`}
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
      title="Original project"
    />
  );
}

/**
 * Compose the iframe's src + a hash route. The `route` value is
 * already a path-shaped string ("/places/4") — we strip any leading
 * `#` defensively before appending.
 */
function composeSrcWithHash(src: string, route: string): string {
  const cleanRoute = route.replace(/^#/, "");
  // If the src already has a hash, replace it; otherwise append.
  const hashIdx = src.indexOf("#");
  const base = hashIdx >= 0 ? src.slice(0, hashIdx) : src;
  return cleanRoute ? `${base}#${cleanRoute}` : base;
}

export function ExternalFrame({ src }: { src: string }) {
  return (
    <iframe
      src={src}
      className={styles.frame}
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
      title="Original project (external)"
    />
  );
}

export function SourceCodeView({
  files,
}: {
  files: { name: string; content: string }[];
}) {
  return (
    <div className={styles.sourceList}>
      {files.map((file) => (
        <div key={file.name}>
          <h3 className={styles.sourceFileName}>{file.name}</h3>
          <pre className={styles.sourceCodeBlock}>
            <code>{file.content}</code>
          </pre>
        </div>
      ))}
    </div>
  );
}
