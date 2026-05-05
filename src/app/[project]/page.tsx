"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { SlidingView, ModeToggle } from "@/components/ui/SlidingView";
import { PROJECTS, type ViewMode } from "@/lib/projects";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";

const VALID_MODES: ViewMode[] = ["original", "remastered", "reimagined"];

export default function ProjectPage() {
  const params = useParams<{ project: string }>();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode") as ViewMode | null;
  const initialMode =
    modeParam && VALID_MODES.includes(modeParam) ? modeParam : "original";
  const [mode, setMode] = useState<ViewMode>(initialMode);

  const project = PROJECTS.find((p) => p.slug === params.project);
  if (!project) notFound();

  const handleModeChange = (newMode: ViewMode) => {
    setMode(newMode);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", newMode);
    window.history.replaceState({}, "", url.toString());
  };

  const reimaginedContent = project.externalLink ? (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <p className="text-zinc-600 dark:text-zinc-400">
        The reimagined version lives as its own application.
      </p>
      <a
        href={project.externalLink}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Open {project.title} Reimagined
        <ExternalLink size={16} />
      </a>
    </div>
  ) : (
    project.reimagined
  );

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-zinc-200 bg-white/80 px-6 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
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
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {project.year} &middot; {project.techOriginal.join(", ")}
            </p>
          </div>
        </div>
        <ModeToggle mode={mode} onChange={handleModeChange} />
      </header>

      <SlidingView mode={mode}>
        {project.original}
        {project.remastered}
        {reimaginedContent}
      </SlidingView>
    </div>
  );
}
