"use client";

import { createContext, useContext, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRightLeft, Link2 } from "lucide-react";
import { siGithub } from "simple-icons";
import { Collapsible } from "@/components/ui/Collapsible";
import {
  resolveRelatedEntries,
  resolveSiblingLink,
  resolveTierSources,
  type Project,
  type ViewMode,
} from "@/lib/projects";
import styles from "./ProjectChrome.module.css";

/**
 * Per-tier notes (text + GitHub source links + sibling/related links).
 *
 * Lives in TWO physical locations in the leaf DOM:
 *   1. The toggle button — rendered inside the chrome's title row via
 *      <ProjectChrome>'s `titleExtra` slot. Flips open/closed state.
 *   2. The panel — rendered inside <main> as a sticky child, positioned
 *      just below the chrome (top: var(--chrome-h)) with a glassy
 *      backdrop so content scrolls beneath it.
 *
 * The two pieces share state via <NotesProvider>, which the leaf
 * wraps around <ProjectChrome /> + <main>. Without the provider both
 * components fall back to their own local state — a graceful default
 * that keeps the button and panel functional in isolation but means
 * they don't sync. Leaves should always wrap.
 *
 * Why split: the chrome (<header>) is `position: sticky` at the
 * document top and overlays both columns. The notes panel needs to
 * be `position: sticky` INSIDE the body column's scroll container so
 * content can scroll under it via glass blur. Those two surfaces
 * can't share a single DOM ancestor and still maintain their
 * independent sticky behavior — so the JSX has to live in two
 * places.
 */

interface NotesState {
  open: boolean;
  setOpen: (v: boolean) => void;
}

const NotesContext = createContext<NotesState | null>(null);

export function NotesProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <NotesContext.Provider value={{ open, setOpen }}>
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes(): NotesState {
  const ctx = useContext(NotesContext);
  // Fallback when used outside a provider — keeps the components
  // functional but the button and panel won't sync. Leaves should
  // always wrap in <NotesProvider>.
  const [open, setOpen] = useState(true);
  return ctx ?? { open, setOpen };
}

// Inline GitHub mark (matches ProjectChrome's local helper). Duplicated
// rather than imported to keep ProjectNotes independently consumable.
function GithubMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={siGithub.path} />
    </svg>
  );
}

/**
 * The sticky notes panel that lives inside <main className=leafBody>.
 *
 * Renders nothing when the leaf has no notes content for this tier.
 * Pins at `top: var(--chrome-h)` so it tucks under the sticky chrome;
 * glassy backdrop-filter so the tier body scrolling beneath stays
 * visible.
 *
 * Open/closed state comes from <NotesProvider> (or falls back to local
 * state if no provider is wrapping). Vertical Collapsible animates the
 * height change so the panel slides open without jumping content.
 */
export function ProjectNotes({
  project,
  tier,
}: {
  project: Project;
  tier: ViewMode;
}) {
  const { open } = useNotes();
  const panelRef = useRef<HTMLDivElement>(null);

  const note = project.notes?.[tier];
  const tierSources = resolveTierSources(project, tier);
  const siblingLink = resolveSiblingLink(project, tier);
  const relatedEntries = resolveRelatedEntries(project);
  const hasPanelContent =
    Boolean(note) ||
    tierSources.length > 0 ||
    siblingLink !== null ||
    relatedEntries.length > 0;

  // Measure the panel's height and write it to --notes-h on the
  // enclosing <main> so the chromeSpacer above can reserve matching
  // space. Notes is sticky inside leafBody and DOES take flow height
  // (so its placement after the spacer + before tier body is what
  // pushes tier-body content down past notes — the spacer covers
  // only the chrome's height, then notes' own flow height covers
  // itself).
  //
  // Wait — that means we shouldn't add notes-h to chromeSpacer at
  // all. Notes' flow height already pushes content down. The
  // chromeSpacer only needs chrome-h. Reverting the spacer formula
  // to chrome-h-only.
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const main = el.closest("main") as HTMLElement | null;
    if (!main) return;
    const apply = () => {
      const h = el.getBoundingClientRect().height;
      const px = `${Math.round(h)}px`;
      main.style.setProperty("--notes-h", px);
      // Mirror to :root so portaled UI outside the shell (e.g. the
      // rail's toggle chevron on document.body) reads the same value
      // via inheritance. Same pattern as MuseumPageShell's --chrome-h.
      document.documentElement.style.setProperty("--notes-h", px);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      main.style.removeProperty("--notes-h");
      document.documentElement.style.removeProperty("--notes-h");
    };
  }, [open]);

  if (!hasPanelContent) return null;

  return (
    <aside
      ref={panelRef}
      className={styles.notesArea}
      style={{
        // Same workaround as in MuseumChrome.tsx: PostCSS strips the
        // unprefixed `backdrop-filter` when a -webkit- variant sits
        // next to it. Inline style bypasses the CSS pipeline so the
        // unprefixed property survives for modern Chrome/Firefox.
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <Collapsible open={open} duration={200}>
        <div className={`text-sm ${styles.notesPanel}`}>
          {note && <p className={styles.notesText}>{note}</p>}
          {(tierSources.length > 0 ||
            siblingLink ||
            relatedEntries.length > 0) && (
            <ul className={styles.repoLinkList}>
              {tierSources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    className={styles.repoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <GithubMark size={14} />
                    <span>{source.label} on GitHub</span>
                  </a>
                </li>
              ))}
              {siblingLink && (
                <li>
                  <Link href={siblingLink.url} className={styles.repoLink}>
                    <ArrowRightLeft size={14} aria-hidden="true" />
                    <span>{siblingLink.label}</span>
                  </Link>
                </li>
              )}
              {relatedEntries.map((related) => (
                <li key={related.url}>
                  <Link href={related.url} className={styles.repoLink}>
                    <Link2 size={14} aria-hidden="true" />
                    <span>
                      See also:{" "}
                      {related.crossesTo ? (
                        <>
                          {related.crossesTo} / {related.label}
                        </>
                      ) : (
                        related.label
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Collapsible>
    </aside>
  );
}
