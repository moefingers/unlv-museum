"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { Collapsible } from "@/components/ui/Collapsible";
import { SignInChip } from "@/components/auth/SignInChip";
import type { Project, ViewMode } from "@/lib/projects";
import styles from "./ProjectChrome.module.css";

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
 */
export function ProjectChrome({ project }: { project: Project }) {
  const pathname = usePathname();
  const [notesOpen, setNotesOpen] = useState(true);

  const currentTier = deriveTier(pathname, project.slug);

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

  return (
    <header className={styles.header}>
      <div className={styles.row}>
        <div className={styles.leadGroup}>
          <Link
            href="/"
            className={styles.backLink}
            aria-label="Back to museum"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className={styles.titleBlock}>
            <h1 className="text-lg font-semibold">{project.title}</h1>
            <p className={`text-sm ${styles.meta}`}>
              <span>
                {project.year}
                {tierTech && tierTech.length > 0
                  ? ` · ${tierTech.join(", ")}`
                  : ""}
              </span>
              {note && (
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
              )}
            </p>
          </div>
        </div>

        <div className={styles.trailGroup}>
          <SignInChip />
          <nav className={styles.tierPicker} aria-label="Tier">
            {TIERS.map(({ mode, label }) => {
              const isAvailable = available[mode];
              const isCurrent = currentTier === mode;
              const href =
                mode === "original"
                  ? `/${project.slug}`
                  : `/${project.slug}/${mode}`;
              const stateClass = isCurrent
                ? styles.tierCurrent
                : isAvailable
                  ? styles.tierAvailable
                  : styles.tierDisabled;
              if (!isAvailable) {
                return (
                  <span
                    key={mode}
                    className={`${styles.tier} ${stateClass}`}
                    aria-disabled="true"
                    title={`${label} not available`}
                  >
                    {label}
                  </span>
                );
              }
              return (
                <Link
                  key={mode}
                  href={href}
                  className={`${styles.tier} ${stateClass}`}
                  aria-current={isCurrent ? "page" : undefined}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      {note && (
        <Collapsible open={notesOpen} duration={200}>
          <p className={`text-sm ${styles.notesPanel}`}>{note}</p>
        </Collapsible>
      )}
    </header>
  );
}

function deriveTier(pathname: string, slug: string): ViewMode {
  // /<slug>            → original
  // /<slug>/enhanced   → enhanced
  // /<slug>/reimagined → reimagined
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== slug) return "original";
  const tier = segments[1];
  if (tier === "enhanced") return "enhanced";
  if (tier === "reimagined") return "reimagined";
  return "original";
}
