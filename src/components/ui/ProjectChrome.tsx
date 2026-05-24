"use client";

import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { MuseumChrome, type TierSpec } from "@/components/ui/MuseumChrome";
import { useNotes } from "@/components/ui/ProjectChromeNotes";
import {
  projectLandingUrl,
  projectPath,
  resolveRelatedEntries,
  resolveSiblingLink,
  resolveTierSources,
  type Project,
  type ViewMode,
} from "@/lib/projects";
import styles from "./ProjectChrome.module.css";

const TIERS: { mode: ViewMode; label: string }[] = [
  { mode: "original", label: "Original" },
  { mode: "enhanced", label: "Enhanced" },
  { mode: "reimagined", label: "Reimagined" },
];

/**
 * Persistent chrome rendered by container layouts and the catch-all
 * page — survives tier navigation so the header stays put while only
 * the body content swaps. Tier picker is `<Link>`-based rather than
 * client state; the active tier is derived from the URL via
 * usePathname.
 *
 * This component is a thin wrapper around the shared <MuseumChrome>
 * primitive (which it also shares with /api-client). The project-
 * specific pieces — year/tech subtitle and the notes-toggle button —
 * live here; MuseumChrome handles the generic layout, tier picker,
 * and view-transition wiring.
 *
 * **Notes are no longer rendered inside the chrome.** The panel
 * itself lives inside the leaf's <main>, rendered by <ProjectNotes/>,
 * so it can be `position: sticky` to the body column's scroll
 * container and content scrolls UNDER it via glass blur. The toggle
 * button still lives in the chrome (so it stays accessible across
 * scroll); the two pieces share state via <NotesProvider> wrapped
 * around the leaf.
 */
export function ProjectChrome({ project }: { project: Project }) {
  const pathname = usePathname();
  const { open, setOpen } = useNotes();

  const path = projectPath(project);
  const currentTier = deriveTier(pathname, path);

  const available: Record<ViewMode, boolean> = {
    // `pages` is also a valid original source — [...path]/page.tsx
    // auto-wraps it with <MultiPageOriginal> when `original` is unset.
    original:
      project.original != null ||
      (project.pages != null && project.pages.length > 0),
    enhanced: project.enhanced != null || project.enhancedExternal != null,
    reimagined:
      project.reimagined != null || project.reimaginedExternal != null,
  };

  const tierTech =
    currentTier === "original"
      ? project.techOriginal
      : currentTier === "enhanced"
        ? project.techEnhanced
        : project.techReimagined;

  // Projects can opt out of tiers entirely via `plannedTiers` — the
  // tier picker hides those altogether rather than showing a dead
  // disabled pill.
  const planned = project.plannedTiers ?? [
    "original",
    "enhanced",
    "reimagined",
  ];
  const tiers: TierSpec[] = TIERS.filter(({ mode }) =>
    planned.includes(mode),
  ).map(({ mode, label }) => ({
    label,
    href: available[mode] ? projectLandingUrl(project, mode) : undefined,
    current: currentTier === mode,
  }));

  // Show the notes-toggle only when there's something to show in the
  // panel — same predicate ProjectNotes uses to decide whether to
  // render the aside at all.
  const note = project.notes?.[currentTier];
  const tierSources = resolveTierSources(project, currentTier);
  const siblingLink = resolveSiblingLink(project, currentTier);
  const relatedEntries = resolveRelatedEntries(project);
  const hasPanelContent =
    Boolean(note) ||
    tierSources.length > 0 ||
    siblingLink !== null ||
    relatedEntries.length > 0;

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
            onClick={() => setOpen(!open)}
            className={styles.notesToggle}
            aria-expanded={open}
            aria-controls="project-notes-panel"
          >
            <ChevronDown
              size={12}
              className={`${styles.notesChevron} ${open ? styles.notesChevronOpen : ""}`}
            />
            Notes
          </button>
        )
      }
      tiers={tiers}
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
  for (let i = 0; i < pathSegments.length; i++) {
    if (segments[i] !== pathSegments[i]) return "original";
  }
  const tier = segments[pathSegments.length];
  if (tier === "enhanced") return "enhanced";
  if (tier === "reimagined") return "reimagined";
  return "original";
}

export { deriveTier };
