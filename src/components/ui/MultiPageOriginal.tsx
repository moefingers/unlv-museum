"use client";

import { Suspense, ViewTransition } from "react";
import { useSearchParams } from "next/navigation";
import { pageSlug, type ProjectPage } from "@/lib/projects";
import styles from "./MultiPageOriginal.module.css";

/**
 * Original-tier renderer for projects whose source ships as multiple
 * sibling HTML files (a tour, a walkthrough, etc.). Mounts the
 * sandboxed iframe; the page selector lives in SiblingRail (nested
 * under the active sibling, mirroring /api-client's
 * Collapsible-endpoint-list pattern).
 *
 * State is URL-driven via `?page=<slug>` — SiblingRail writes it via
 * <Link> navigation, this component reads it via useSearchParams to
 * decide which page src to render. Both components share the URL as
 * source of truth; no shared context needed.
 *
 * The route's page.tsx normalizes bare/unknown `?page=` to the first
 * page's slug before this component renders, so the search-param read
 * almost always resolves cleanly. The fallback below covers the
 * edge case where browser-back lands on a hand-edited URL.
 */
export function MultiPageOriginal({ pages }: { pages: ProjectPage[] }) {
  // useSearchParams suspends, so the inner reader sits behind a boundary.
  return (
    <Suspense>
      <MultiPageOriginalInner pages={pages} />
    </Suspense>
  );
}

function MultiPageOriginalInner({ pages }: { pages: ProjectPage[] }) {
  const searchParams = useSearchParams();
  const requested = searchParams.get("page");
  const active =
    pages.find((p) => pageSlug(p.label) === requested) ?? pages[0]!;

  return (
    // Wrap the iframe in <ViewTransition> so the cross-fade fires on
    // page swaps. The name is scoped to MultiPageOriginal — distinct
    // from the chrome's `page-content` so tier swaps still get the
    // chrome-level animation while page swaps get this finer-grained
    // one. `key` forces a clean remount on src change so inline
    // scripts re-execute and event listeners attach fresh.
    <ViewTransition name="project-page-frame">
      <iframe
        key={active.src}
        src={active.src}
        className={styles.frame}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
        title={`Original project — ${active.label}`}
      />
    </ViewTransition>
  );
}
