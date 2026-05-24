"use client";

import { useRef } from "react";
import { CustomScrollbar } from "./CustomScrollbar";
import styles from "./MuseumPageShell.module.css";

/**
 * Client wrapper that pairs the leaf's <main className=leafBody> with
 * a <CustomScrollbar/> bound to it. Server-component leaf pages can't
 * own the ref directly, so this exists to bridge that gap: the leaf
 * passes its <main> children in here, and this component hands the
 * scroller's ref to the custom scrollbar.
 *
 * The custom scrollbar sits over the visible surface only (below the
 * chrome + notes overlays). leafBody's native scrollbar is hidden via
 * `scrollbar-width: none` / `::-webkit-scrollbar { display: none }`
 * in MuseumPageShell.module.css.
 */
export function LeafBodyScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  return (
    <>
      <main ref={ref} className={styles.leafBody}>
        {children}
      </main>
      <CustomScrollbar
        scrollerRef={ref}
        topOffsetVar="--chrome-h"
        extraTopOffsetVar="--notes-h"
        /* The leaf body often holds iframes (CRA originals, embedded
           HTML) with their own white background that doesn't follow
           the museum's dark/light mode. The "dark" variant uses a
           dark fill with a light outline so the thumb reads on both
           white iframe content AND dark museum theme. */
        variant="dark"
      />
    </>
  );
}
