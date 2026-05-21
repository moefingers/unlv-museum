"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Collapsible } from "@/components/ui/Collapsible";
import {
  CONTAINERS,
  pageSlug,
  projectPath,
  type ContainerId,
  type Project,
} from "@/lib/projects";
import styles from "./SiblingRail.module.css";

/**
 * Vertical sibling navigation for containerized projects.
 *
 * Mirrors /api-client's sidebar (the canonical in-museum pattern for
 * grouped navigation): one rail, the active entry expands to reveal
 * its sub-items inline. Here:
 *   - Each sibling is a top-level row (title + description).
 *   - The active sibling expands underneath to show its `pages` list
 *     when one is declared (multi-page originals). MultiPageOriginal
 *     no longer renders its own rail — pages live here, in one place.
 *   - Clicking a page navigates to ?page=<slug> on the active sibling.
 *   - Clicking a different sibling routes to its leaf URL; the page
 *     list re-renders for the new active sibling.
 *
 * State is URL-driven:
 *   - Active sibling = current path segment (from usePathname).
 *   - Active page    = `?page=<slug>` (from useSearchParams).
 *
 * Both are read here AND in MultiPageOriginal independently — no
 * shared context needed. SiblingRail is a Suspense boundary because
 * useSearchParams requires one.
 *
 * Drawer behavior at narrow viewports (or on the reimagined tier
 * regardless of width) — same as before: rail slides over content,
 * toggle button pinned at the left edge, backdrop catches outside taps.
 */
export function SiblingRail(props: {
  container: ContainerId;
  siblings: Project[];
}) {
  return (
    <Suspense>
      <SiblingRailInner {...props} />
    </Suspense>
  );
}

function SiblingRailInner({
  container,
  siblings,
}: {
  container: ContainerId;
  siblings: Project[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activePageSlug = searchParams.get("page");
  // Path shape for a container leaf is /<container>/<slug>(/<tier>)?.
  // Segment 0 = container ID, segment 1 = slug, optional segment 2 =
  // tier. Reading these from pathname (rather than accepting them as
  // props) is what lets this component live inside a container layout
  // — the layout can't see [slug] params from below, but the URL
  // always has the answer.
  const segments = pathname.split("/").filter(Boolean);
  const current = segments[1] ?? "";
  const tierSegment = segments[2];
  const tier =
    tierSegment === "enhanced" || tierSegment === "reimagined"
      ? tierSegment
      : "original";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const containerTitle = CONTAINERS[container].title;

  return (
    <div className={styles.host} data-rail-open={open} data-tier={tier}>
      <button
        type="button"
        className={styles.backdrop}
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => setOpen(false)}
      />

      <aside
        id="sibling-rail"
        className={styles.rail}
        aria-label={`${containerTitle} — siblings`}
        aria-hidden={!open}
      >
        <div className={styles.railHeader}>
          <p className={`text-xs ${styles.containerLabel}`}>Series</p>
          <p className={`text-sm ${styles.containerTitle}`}>{containerTitle}</p>
        </div>
        <nav className={styles.list}>
          {siblings.map((sib) => {
            const isCurrent = sib.slug === current;
            const sibUrl = `/${projectPath(sib)}`;
            return (
              <div key={sib.slug} className={styles.entry}>
                <Link
                  href={sibUrl}
                  className={`${styles.item} ${
                    isCurrent ? styles.itemCurrent : ""
                  }`}
                  aria-current={isCurrent ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  <span className={styles.itemTitle}>{sib.title}</span>
                  {sib.description && (
                    <span className={`text-xs ${styles.itemDescription}`}>
                      {sib.description}
                    </span>
                  )}
                </Link>
                {/*
                  Page list — only the active sibling's Collapsible
                  opens. Pages are URL-driven via ?page=<slug>; clicking
                  routes to the same leaf with a new ?page= value, which
                  MultiPageOriginal also reads to swap the iframe.
                */}
                {sib.pages && sib.pages.length > 0 && (
                  <Collapsible open={isCurrent}>
                    <ol className={styles.pageList}>
                      {sib.pages.map((page, i) => {
                        const slug = pageSlug(page.label);
                        // Default-page heuristic: the route-level
                        // redirect lands bare/unknown ?page= on the
                        // first page's slug. So "active page is page
                        // 0" when the param is missing OR matches.
                        const isFirstPage = i === 0;
                        const isActivePage =
                          activePageSlug === slug ||
                          (!activePageSlug && isFirstPage);
                        return (
                          <li key={slug}>
                            <Link
                              href={`${sibUrl}?page=${slug}`}
                              className={`${styles.pageItem} ${
                                isActivePage ? styles.pageItemActive : ""
                              }`}
                              aria-current={isActivePage ? "page" : undefined}
                              onClick={() => setOpen(false)}
                            >
                              <span className={styles.pageNumber}>{i + 1}</span>
                              <span className={styles.pageLabel}>
                                {page.label}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ol>
                  </Collapsible>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      <button
        type="button"
        className={styles.toggle}
        aria-controls="sibling-rail"
        aria-expanded={open}
        aria-label={open ? "Close sibling rail" : "Open sibling rail"}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronLeft
          size={18}
          className={styles.toggleIcon}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
