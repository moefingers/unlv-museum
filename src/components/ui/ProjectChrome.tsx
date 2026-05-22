"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRightLeft, ChevronDown } from "lucide-react";
import { siGithub } from "simple-icons";
import { Collapsible } from "@/components/ui/Collapsible";
import { MuseumChrome, type TierSpec } from "@/components/ui/MuseumChrome";
import {
  projectPath,
  resolveSiblingLink,
  resolveTierSources,
  type Project,
  type ViewMode,
} from "@/lib/projects";
import styles from "./ProjectChrome.module.css";

// Inline GitHub mark via simple-icons' CC0 path — same approach as
// SignInChip, since lucide-react 1.x doesn't ship brand glyphs.
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

const TIERS: { mode: ViewMode; label: string }[] = [
  { mode: "original", label: "Original" },
  { mode: "enhanced", label: "Enhanced" },
  { mode: "reimagined", label: "Reimagined" },
];

/**
 * Persistent chrome rendered by [project]/layout.tsx — survives tier
 * navigation so the header stays put while only the body content swaps.
 * Tier picker is `<Link>`-based rather than client state; the active tier
 * is derived from the URL via usePathname.
 *
 * This component is now a thin wrapper around the shared <MuseumChrome>
 * primitive (which it also shares with /api-client). The project-specific
 * pieces — per-tier note panel + its toggle button, year/tech subtitle —
 * live here; MuseumChrome handles the generic layout, tier picker, and
 * view-transition wiring.
 */
export function ProjectChrome({ project }: { project: Project }) {
  const pathname = usePathname();
  const [notesOpen, setNotesOpen] = useState(true);

  const path = projectPath(project);
  const currentTier = deriveTier(pathname, path);

  const available: Record<ViewMode, boolean> = {
    // `pages` is also a valid original source — [...path]/page.tsx
    // auto-wraps it with <MultiPageOriginal> when `original` is unset.
    // Without this, multi-page projects (admin-portal, js-dom-events)
    // would render the Original tier toggle as disabled even though
    // the route serves it correctly.
    original:
      project.original != null ||
      (project.pages != null && project.pages.length > 0),
    enhanced: project.enhanced != null || project.enhancedExternal != null,
    reimagined:
      project.reimagined != null || project.reimaginedExternal != null,
  };

  const note = project.notes?.[currentTier];

  const tierTech =
    currentTier === "original"
      ? project.techOriginal
      : currentTier === "enhanced"
        ? project.techEnhanced
        : project.techReimagined;

  // Projects can opt out of tiers entirely via `plannedTiers` — the
  // tier picker hides those altogether rather than showing a dead
  // disabled pill. (Coming-soon placeholders remain visible for
  // tiers that ARE in the plan but not yet built — the picker still
  // renders a disabled pill there to set expectations.)
  const planned = project.plannedTiers ?? [
    "original",
    "enhanced",
    "reimagined",
  ];
  const tiers: TierSpec[] = TIERS.filter(({ mode }) =>
    planned.includes(mode),
  ).map(({ mode, label }) => ({
    label,
    href: available[mode]
      ? mode === "original"
        ? `/${path}`
        : `/${path}/${mode}`
      : undefined,
    current: currentTier === mode,
  }));

  const tierSources = resolveTierSources(project, currentTier);
  const siblingLink = resolveSiblingLink(project);
  // The notes panel hosts the per-tier note, the GitHub source links,
  // and the cross-link to the api-client/frontend counterpart when
  // this project is half of an api+client pair. Show the toggle (and
  // the panel) when ANY piece of content exists for this tier.
  const hasPanelContent =
    Boolean(note) || tierSources.length > 0 || siblingLink !== null;

  return (
    <MuseumChrome
      title={project.title}
      subtitle={
        <>
          {project.year}
          {tierTech && tierTech.length > 0 ? ` · ${tierTech.join(", ")}` : ""}
        </>
      }
      titleExtra={
        hasPanelContent && (
          <button
            onClick={() => setNotesOpen(!notesOpen)}
            className={styles.notesToggle}
          >
            <ChevronDown
              size={12}
              className={`${styles.notesChevron} ${notesOpen ? styles.notesChevronOpen : ""}`}
            />
            Notes
          </button>
        )
      }
      tiers={tiers}
      belowRow={
        hasPanelContent && (
          <Collapsible open={notesOpen} duration={200}>
            <div className={`text-sm ${styles.notesPanel}`}>
              {note && <p className={styles.notesText}>{note}</p>}
              {(tierSources.length > 0 || siblingLink) && (
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
                      {/*
                        Internal navigation — use next/link so the
                        cross-link participates in the view-transition
                        pipeline rather than triggering a full reload,
                        and so the api-client's own client-side state
                        (sidebar, history) initializes cleanly.
                      */}
                      <Link href={siblingLink.url} className={styles.repoLink}>
                        <ArrowRightLeft size={14} aria-hidden="true" />
                        <span>{siblingLink.label}</span>
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </div>
          </Collapsible>
        )
      }
    />
  );
}

function deriveTier(pathname: string, path: string): ViewMode {
  // /<path>            → original
  // /<path>/enhanced   → enhanced
  // /<path>/reimagined → reimagined
  // <path> may be "<slug>" (flat) or "<container>/<slug>" (containerized).
  const segments = pathname.split("/").filter(Boolean);
  const pathSegments = path.split("/").filter(Boolean);
  // The URL must start with the project's path segments; anything else means
  // we're on an unrelated route and the chrome is being rendered for nothing.
  for (let i = 0; i < pathSegments.length; i++) {
    if (segments[i] !== pathSegments[i]) return "original";
  }
  const tier = segments[pathSegments.length];
  if (tier === "enhanced") return "enhanced";
  if (tier === "reimagined") return "reimagined";
  return "original";
}
