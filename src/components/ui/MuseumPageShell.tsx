"use client";

import { useEffect, useRef } from "react";
import styles from "./MuseumPageShell.module.css";

/**
 * Layout primitive shared by every museum project route.
 *
 * Owns:
 *   - the full-viewport flex row that holds the rail (col 1) and the
 *     body column (col 2). Both columns go the full viewport height;
 *     content scrolls UNDER the sticky chrome (and, for the body
 *     column, also under the sticky notes panel).
 *   - measuring the leaf's <header> via ResizeObserver and exposing
 *     its height as `--chrome-h` on the shell root. Rail and body
 *     content use that as a top spacer so their first row isn't
 *     trapped beneath the chrome's glass blur.
 *   - a left-rail slot (`rail` prop) — container layouts inject a
 *     SiblingRail here; the catch-all (flat slugs, no siblings)
 *     passes nothing.
 *   - the viewport slot (`children`) that holds the leaf's <header>
 *     + <main> output as siblings (display: contents on the wrapper
 *     so they participate in the shell's row directly).
 *
 * The leaf is expected to emit exactly two siblings:
 *   1. <ProjectChrome /> (rendered as a <header> via MuseumChrome) —
 *      stays sticky at top: 0 and floats over both columns.
 *   2. <main className={museumPageShellStyles.leafBody}>
 *        {ProjectNotes if present}
 *        {tierBody}
 *      </main>
 *      The <main> is the scroll container for the body column. The
 *      optional ProjectNotes child is sticky inside it at
 *      `top: var(--chrome-h)` so it tucks under the chrome but stays
 *      pinned while the tier body scrolls underneath.
 *
 * Why measurement happens here, not at the chrome: the chrome is
 * shared with /api-client (which has its OWN shell), so the chrome
 * itself shouldn't write a global CSS variable. The shell scopes the
 * variable to its own root.
 */
export function MuseumPageShell({
  rail,
  children,
}: {
  rail?: React.ReactNode;
  children: React.ReactNode;
}) {
  const shellRef = useRef<HTMLDivElement>(null);

  // Measure the leaf's <header> so other parts of the shell can use
  // its height as a top spacer (chromeSpacer, sticky notes, custom
  // scrollbar offsets). The header may not exist on first mount — it
  // gets rendered by the leaf page, which may stream in later. We watch
  // for it via MutationObserver and switch to ResizeObserver once it
  // appears. Both observers disconnect on unmount.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    let ro: ResizeObserver | null = null;
    let attachedHeader: HTMLElement | null = null;

    const attachTo = (header: HTMLElement) => {
      if (attachedHeader === header) return;
      ro?.disconnect();
      attachedHeader = header;
      const apply = () => {
        const h = header.getBoundingClientRect().height;
        shell.style.setProperty("--chrome-h", `${Math.round(h)}px`);
      };
      apply();
      ro = new ResizeObserver(apply);
      ro.observe(header);
    };

    const tryAttach = () => {
      const header = shell.querySelector("header") as HTMLElement | null;
      if (header) attachTo(header);
    };

    tryAttach();
    // Re-scan whenever a node is added/removed under the shell — covers
    // the header arriving after first paint (Suspense, streaming, view
    // transitions) and tier swaps that remount the chrome.
    const mo = new MutationObserver(tryAttach);
    mo.observe(shell, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      ro?.disconnect();
    };
  }, []);

  return (
    <div
      ref={shellRef}
      data-museum-shell=""
      className={`${styles.shell} ${rail ? styles.withRail : ""}`}
    >
      {rail && <div className={styles.rail}>{rail}</div>}
      {children}
    </div>
  );
}

// Consumers of the CSS module (server components rendering the leaf
// body) import the module directly:
//   import museumPageShellStyles from
//     "@/components/ui/MuseumPageShell.module.css";
//
// Re-exporting `styles` from this `"use client"` module to server
// components doesn't survive Next 16's RSC boundary — non-component
// named exports get stripped. Direct module import is the canonical
// path.
