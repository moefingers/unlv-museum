"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { SlidingView, ModeToggle } from "@/components/ui/SlidingView";
import { PROJECTS } from "@/lib/projects";
import { notFound } from "next/navigation";

type ViewMode = "original" | "remastered" | "reimagined";

export default function ProjectPage() {
  const params = useParams<{ project: string }>();
  const [mode, setMode] = useState<ViewMode>("remastered");

  const project = PROJECTS.find((p) => p.slug === params.project);
  if (!project) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-zinc-200 bg-white/80 px-6 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div>
          <h1 className="text-lg font-semibold">{project.title}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {project.year}
          </p>
        </div>
        <ModeToggle mode={mode} onChange={setMode} />
      </header>

      <SlidingView mode={mode}>
        {project.original}
        {project.remastered}
        {project.reimagined}
      </SlidingView>
    </div>
  );
}
