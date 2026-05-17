"use client";

import { useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { SlidingView, ModeToggle } from "@/components/ui/SlidingView";
import { PROJECTS, type ViewMode } from "@/lib/projects";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, ChevronDown } from "lucide-react";
import { Collapsible } from "@/components/ui/Collapsible";

const VALID_MODES: ViewMode[] = ["original", "enhanced", "reimagined"];

export default function ProjectPage() {
  const params = useParams<{ project: string }>();
  const searchParams = useSearchParams();

  const project = PROJECTS.find((p) => p.slug === params.project);
  if (!project) notFound();

  const available: Record<ViewMode, boolean> = {
    original: project.original != null,
    enhanced: project.enhanced != null || project.enhancedExternal != null,
    reimagined:
      project.reimagined != null || project.reimaginedExternal != null,
  };

  const firstAvailable: ViewMode =
    (VALID_MODES.find((m) => available[m]) as ViewMode) ?? "original";

  const modeParam = searchParams.get("mode") as ViewMode | null;
  const initialMode =
    modeParam && VALID_MODES.includes(modeParam) && available[modeParam]
      ? modeParam
      : firstAvailable;

  const [mode, setMode] = useState<ViewMode>(initialMode);
  const [notesOpen, setNotesOpen] = useState(true);

  const handleModeChange = (newMode: ViewMode) => {
    if (!available[newMode]) return;
    setMode(newMode);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", newMode);
    window.history.replaceState({}, "", url.toString());
  };

  const note = project.notes?.[mode];

  const tierTech =
    mode === "original"
      ? project.techOriginal
      : mode === "enhanced"
        ? project.techEnhanced
        : project.techReimagined;

  const enhancedContent: ReactNode = project.enhancedExternal ? (
    <ExternalTierCard
      tier="enhanced"
      title={project.title}
      href={project.enhancedExternal}
    />
  ) : (
    (project.enhanced ?? <UnavailableSlot label="enhanced" />)
  );

  const reimaginedContent: ReactNode = project.reimaginedExternal ? (
    <ExternalTierCard
      tier="reimagined"
      title={project.title}
      href={project.reimaginedExternal}
    />
  ) : (
    (project.reimagined ?? <UnavailableSlot label="reimagined" />)
  );

  return (
    <div className="flex h-screen flex-col">
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
          <ModeToggle
            mode={mode}
            onChange={handleModeChange}
            available={available}
          />
        </div>
        {note && (
          <Collapsible open={notesOpen} duration={200}>
            <p className="border-t border-zinc-200 bg-amber-50/40 px-6 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-amber-950/20 dark:text-zinc-300">
              {note}
            </p>
          </Collapsible>
        )}
      </header>

      <SlidingView mode={mode}>
        {project.original ?? <UnavailableSlot label="original" />}
        {enhancedContent}
        {reimaginedContent}
      </SlidingView>
    </div>
  );
}

function UnavailableSlot({ label }: { label: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <p className="text-center text-zinc-400 dark:text-zinc-600">
        No {label} tier for this project.
      </p>
    </div>
  );
}

function ExternalTierCard({
  tier,
  title,
  href,
}: {
  tier: "enhanced" | "reimagined";
  title: string;
  href: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <p className="text-zinc-600 dark:text-zinc-400">
        The {tier} version lives as its own application.
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Open {title} {tier === "enhanced" ? "Enhanced" : "Reimagined"}
        <ExternalLink size={16} />
      </a>
    </div>
  );
}
