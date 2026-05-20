"use client";

import {
  Suspense,
  startTransition,
  useEffect,
  useState,
  ViewTransition,
} from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { pageSlug, type ProjectPage } from "@/lib/projects";
import styles from "./MultiPageOriginal.module.css";

/**
 * Original-tier renderer for projects whose source ships as multiple
 * sibling HTML files (a tour, a walkthrough, etc.). Mounts a vertical
 * page picker beside the sandboxed iframe; clicking a page swaps the
 * iframe's src in place.
 *
 * Vocabulary mirrors /api-client (the canonical reference for in-page
 * URL-addressable navigation in this codebase). Specifically:
 *
 *  - Active page is reflected in the URL as `?page=<slug>` so pages
 *    are shareable, bookmarkable, and survive browser back/forward.
 *    The route-level page.tsx normalizes bare and unknown values to
 *    `?page=<first-page-slug>` so the client never has to render a
 *    "no page selected" state.
 *  - URL writes use `history.replaceState` (no router push) — the
 *    navigation isn't a real route change, just a state mirror, and
 *    we don't want every page click to grow the history stack.
 *  - State updates are wrapped in `startTransition` so the React 19
 *    view-transition pipeline captures old/new snapshots of named
 *    elements. The rail highlight (`page-rail-current`) slides and
 *    the iframe (`project-page-frame`) cross-fades.
 *
 * The drawer behavior (toggle button, backdrop, Esc-to-close) mirrors
 * SiblingRail / api-client's sidebar so the three navigation surfaces
 * feel like the same component family.
 */
export function MultiPageOriginal({ pages }: { pages: ProjectPage[] }) {
  // useSearchParams suspends, so the inner reader sits behind a boundary.
  // Same pattern as ApiClient's ApiClientInner.
  return (
    <Suspense>
      <MultiPageOriginalInner pages={pages} />
    </Suspense>
  );
}

function MultiPageOriginalInner({ pages }: { pages: ProjectPage[] }) {
  const searchParams = useSearchParams();
  // Server-side page.tsx already redirected bare/unknown ?page= values
  // to the first page's slug. A null here means a typo'd param survived
  // (rare — usually browser back to a hand-edited URL). Fall back to
  // pages[0] silently rather than render nothing.
  const initialSlug = searchParams.get("page") ?? pageSlug(pages[0]!.label);

  const [activeSlug, setActiveSlug] = useState(initialSlug);
  const [open, setOpen] = useState(false);

  // Esc closes the sidebar drawer on narrow viewports. Bound only while
  // open to keep the document key surface clean. Same pattern as
  // SiblingRail / ApiClientInner.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const active =
    pages.find((p) => pageSlug(p.label) === activeSlug) ?? pages[0]!;

  const switchPage = (slug: string) => {
    // Drawer closes on selection; wide viewports ignore the flag via CSS.
    // `startTransition` is what makes the iframe cross-fade and the rail
    // highlight slide — regular setState wouldn't trigger view transitions
    // (per the Next.js view-transitions doc).
    startTransition(() => {
      setActiveSlug(slug);
      setOpen(false);
    });
    const url = new URL(window.location.href);
    url.searchParams.set("page", slug);
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <div className={styles.shell} data-rail-open={open}>
      <button
        type="button"
        className={styles.backdrop}
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => setOpen(false)}
      />

      <aside
        id="page-rail"
        className={styles.rail}
        aria-label="Pages"
        aria-hidden={!open}
      >
        <div className={styles.railHeader}>
          <p className={`text-xs ${styles.railLabel}`}>Pages</p>
        </div>
        <nav className={styles.list}>
          {pages.map((page, i) => {
            const slug = pageSlug(page.label);
            const isCurrent = slug === pageSlug(active.label);
            return (
              <button
                key={slug}
                type="button"
                className={`${styles.item} ${
                  isCurrent ? styles.itemCurrent : ""
                }`}
                aria-current={isCurrent ? "page" : undefined}
                onClick={() => switchPage(slug)}
              >
                <span className={styles.itemNumber}>{i + 1}</span>
                <span className={styles.itemLabel}>{page.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <button
        type="button"
        className={styles.toggle}
        aria-controls="page-rail"
        aria-expanded={open}
        aria-label={open ? "Close page list" : "Open page list"}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronLeft
          size={18}
          className={styles.toggleIcon}
          aria-hidden="true"
        />
      </button>

      {/*
        Wrap the iframe in <ViewTransition> so the cross-fade fires on
        page swaps. The name is scoped to MultiPageOriginal — distinct
        from the chrome's `page-content` so tier swaps still get the
        chrome-level animation while page swaps get this finer-grained
        one. `key` forces a clean remount on src change (inline scripts
        re-execute, event listeners attach fresh).
      */}
      <ViewTransition name="project-page-frame">
        <iframe
          key={active.src}
          src={active.src}
          className={styles.frame}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          title={`Original project — ${active.label}`}
        />
      </ViewTransition>
    </div>
  );
}
