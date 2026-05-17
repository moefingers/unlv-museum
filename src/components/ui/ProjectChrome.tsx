"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { Collapsible } from "@/components/ui/Collapsible";
import type { Project, ViewMode } from "@/lib/projects";

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
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="Back to museum"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">{project.title}</h1>
            <p className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <span>
                {project.year}
                {tierTech && tierTech.length > 0
                  ? ` · ${tierTech.join(", ")}`
                  : ""}
              </span>
              {note && (
                <button
                  onClick={() => setNotesOpen(!notesOpen)}
                  className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${notesOpen ? "rotate-180" : ""}`}
                  />
                  Notes
                </button>
              )}
            </p>
          </div>
        </div>

        <nav
          className="inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800"
          aria-label="Tier"
        >
          {TIERS.map(({ mode, label }) => {
            const isAvailable = available[mode];
            const isCurrent = currentTier === mode;
            const href =
              mode === "original"
                ? `/${project.slug}`
                : `/${project.slug}/${mode}`;
            const baseClass =
              "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors";
            const stateClass = isCurrent
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
              : isAvailable
                ? "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                : "cursor-not-allowed text-zinc-300 dark:text-zinc-600";
            if (!isAvailable) {
              return (
                <span
                  key={mode}
                  className={`${baseClass} ${stateClass}`}
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
                className={`${baseClass} ${stateClass}`}
                aria-current={isCurrent ? "page" : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
      {note && (
        <Collapsible open={notesOpen} duration={200}>
          <p className="border-t border-zinc-200 bg-amber-50/40 px-6 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-amber-950/20 dark:text-zinc-300">
            {note}
          </p>
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
