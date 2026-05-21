"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  CONTAINERS,
  projectPath,
  type ContainerId,
  type Project,
} from "@/lib/projects";
import styles from "./SiblingRail.module.css";

/**
 * Vertical sibling navigation for containerized projects.
 *
 * Layout pattern mirrors /api-client's sidebar:
 *   - Above the responsive breakpoint, the rail is permanent at the left
 *     edge of the viewport row.
 *   - Below it, the rail detaches into a drawer that slides over the
 *     content. A toggle button rides the rail's right edge in both
 *     positions; a backdrop catches taps outside the open drawer.
 *   - Esc closes the drawer.
 *
 * The component renders only when there are siblings to show — the
 * layout already filters by `project.container`, so this just guards
 * against a one-leaf container slipping through.
 */
export function SiblingRail({
  container,
  current,
  siblings,
}: {
  container: ContainerId;
  current: string;
  siblings: Project[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Tier is the last path segment when it's "enhanced" or "reimagined";
  // anything else means we're on the original tier. The rail's CSS uses
  // data-tier to decide whether to apply drawer-mode at wide viewports
  // (reimagined gets drawer mode so the polished surface has the room).
  const lastSegment = pathname.split("/").filter(Boolean).pop();
  const tier =
    lastSegment === "enhanced" || lastSegment === "reimagined"
      ? lastSegment
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
            return (
              <Link
                key={sib.slug}
                href={`/${projectPath(sib)}`}
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
