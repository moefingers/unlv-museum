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
 *
 * Pages built for the browser window rather than for a page of content
 * get the window instead: a frame that fills the leafBody's visible
 * area under the chrome and notes overlays (`data-fit="viewport"` in
 * OriginalFrame.module.css), scrolling inside if the page itself does.
 * Two kinds:
 *   - pages that hide overflow at the root (hidesOverflow). They never
 *     scroll in a browser; they lay themselves out to fit whatever
 *     window they get. Sized to their hidden overflow, they'd lay out
 *     for a window far taller than the screen (timer-stopwatch picks
 *     its portrait layout).
 *   - pages whose height follows the frame's own height, content sized
 *     in `vh` (followsFrameHeight). Sized to content they never settle:
 *     a taller frame is a taller viewport, so the content grows again.
 */
function useAutoSizeIframe(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
) {
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;
    let detachResize: (() => void) | null = null;
    // Set once the current document turns out to be built for the
    // window; cleared when the iframe loads a new document.
    let fitsViewport = false;

    const fitViewport = () => {
      fitsViewport = true;
      iframe.style.height = "";
      iframe.dataset.fit = "viewport";
    };

    const measure = () => {
      if (fitsViewport) return;
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        // Use documentElement (html element) — scrollHeight on the
        // doc element covers both flow content and absolutely-
        // positioned content. body.scrollHeight sometimes misses
        // tall absolutely-positioned children.
        const h = doc.documentElement.scrollHeight;
        if (h <= 0) return;
        if (h > iframe.clientHeight && followsFrameHeight(iframe, doc)) {
          fitViewport();
          return;
        }
        iframe.style.height = `${h}px`;
      } catch {
        // Cross-origin or detached document — leave CSS height alone.
      }
    };

    const wire = () => {
      try {
        const doc = iframe.contentDocument;
        const win = iframe.contentWindow;
        if (!doc || !win) return;
        // Read once per document, at load: a modal that hides body
        // overflow while it's open mustn't refit a content-sized page.
        if (hidesOverflow(doc)) fitViewport();
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
      // Measure the new document from the CSS height, not the last
      // one's: scrollHeight never reads below the frame's height, so a
      // shorter page would otherwise inherit a taller page's frame.
      fitsViewport = false;
      iframe.style.height = "";
      delete iframe.dataset.fit;
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
 * Whether the page hides overflow at the root, so it never scrolls in a
 * browser window. The window scrolls by the html element's overflow, or
 * by the body's when the html element's is `visible` (CSS overflow
 * propagation).
 */
function hidesOverflow(doc: Document): boolean {
  const view = doc.defaultView;
  if (!view) return false;
  const root = view.getComputedStyle(doc.documentElement).overflowY;
  const viewport =
    root === "visible" && doc.body
      ? view.getComputedStyle(doc.body).overflowY
      : root;
  return viewport === "hidden" || viewport === "clip";
}

/** How far followsFrameHeight stretches the frame to test a page. */
const PROBE_STEP_PX = 200;

/**
 * Whether the page's height follows the frame's own height, as it does
 * for content sized in `vh`: 100vh sections, `min-height: 100vh` plus a
 * body margin, 20vh grid items. Called when the content overflows the
 * frame; sets the frame to its current height and one step shorter and
 * reads the content height at each. Same-origin layout runs
 * synchronously on the read, so the page never paints at either height.
 *
 * The step goes down, not up: content that fits the frame reads as the
 * frame's own height, so only growth while the content overflows at
 * both heights counts, and a page that would settle just above the
 * current height fits one step up (responsive-boxes' 100vh container
 * grows 0.9 px per px of frame, creeping toward ~1,100 px). Growth of
 * at least half the step means
 * sizing to content never settles, or settles only once the frame is
 * twice the page's fixed-size content.
 */
function followsFrameHeight(iframe: HTMLIFrameElement, doc: Document): boolean {
  const high = iframe.clientHeight;
  const low = high - PROBE_STEP_PX;
  if (low <= 0) return false;
  const restore = iframe.style.height;
  iframe.style.height = `${low}px`;
  const atLow = doc.documentElement.scrollHeight;
  iframe.style.height = `${high}px`;
  const atHigh = doc.documentElement.scrollHeight;
  iframe.style.height = restore;
  return atLow > low && atHigh > high && atHigh - atLow >= PROBE_STEP_PX / 2;
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
