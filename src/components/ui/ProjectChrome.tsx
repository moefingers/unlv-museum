"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { siGithub } from "simple-icons";
import { Collapsible } from "@/components/ui/Collapsible";
import { MuseumChrome, type TierSpec } from "@/components/ui/MuseumChrome";
import {
  projectPath,
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
    original: project.original != null,
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

  const tiers: TierSpec[] = TIERS.map(({ mode, label }) => ({
    label,
    href: available[mode]
      ? mode === "original"
        ? `/${path}`
        : `/${path}/${mode}`
      : undefined,
    current: currentTier === mode,
  }));

  const tierSources = resolveTierSources(project, currentTier);
  // The notes panel hosts both the per-tier note and the source links.
  // Show the toggle (and the panel) when ANY piece of content exists
  // for this tier — a project might have a repo to link to even without
  // a tier-specific note, and vice versa.
  const hasPanelContent = Boolean(note) || tierSources.length > 0;

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
              {tierSources.length > 0 && (
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
