"use client";

import { useState } from "react";
import Link from "next/link";
import { Globe } from "@/components/ui/Globe";
import {
  PROJECTS,
  CATEGORY_LABELS,
  type Category,
  type Project,
} from "@/lib/projects";
import { Globe as GlobeIcon, List } from "lucide-react";

const CATEGORY_HEX: Record<Category, { light: string; dark: string }> = {
  games: { light: "#22c55e", dark: "#15803d" },
  "full-stack": { light: "#3b82f6", dark: "#1d4ed8" },
  frontend: { light: "#a855f7", dark: "#7e22ce" },
  api: { light: "#f59e0b", dark: "#b45309" },
  python: { light: "#06b6d4", dark: "#0e7490" },
  exercises: { light: "#ec4899", dark: "#be185d" },
};

const CATEGORY_BG: Record<Category, string> = {
  games: "bg-green-500",
  "full-stack": "bg-blue-500",
  frontend: "bg-purple-500",
  api: "bg-amber-500",
  python: "bg-cyan-500",
  exercises: "bg-pink-500",
};

const DEPTH_LAYERS = 5;
const LAYER_STEP = 1.5;

function ProjectCard({ project }: { project: Project }) {
  const hex = CATEGORY_HEX[project.category];

  return (
    <Link
      href={project.href ?? `/${project.slug}`}
      className="group block w-44"
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      style={{ transformStyle: "preserve-3d" }}
    >
      <div className="relative" style={{ transformStyle: "preserve-3d" }}>
        {/* Front face with subtle category gradient */}
        <div
          className="relative rounded-lg"
          style={{
            background: `linear-gradient(315deg, rgba(255,255,255,0.97), rgba(255,255,255,0.78)), linear-gradient(315deg, ${hex.light}22, ${hex.dark}66)`,
          }}
        >
          <div className="p-3">
            <h3 className="truncate text-sm font-semibold text-zinc-900 group-hover:underline">
              {project.title}
            </h3>
            <p className="mt-0.5 text-xs text-zinc-600">{project.year}</p>
          </div>
        </div>

        {/* Backing layers with gradient */}
        {Array.from({ length: DEPTH_LAYERS }, (_, i) => {
          const t = (i + 1) / DEPTH_LAYERS;
          const z = -(i + 1) * LAYER_STEP;
          const grow = t * 2;
          return (
            <div
              key={i}
              className="absolute rounded-lg"
              style={{
                inset: `${-grow}px`,
                transform: `translateZ(${z}px)`,
                background: `linear-gradient(135deg, ${hex.light}, ${hex.dark})`,
                opacity: 0.7 + t * 0.3,
              }}
            />
          );
        })}
      </div>
    </Link>
  );
}

function ListView() {
  const categories = Object.keys(CATEGORY_LABELS) as Category[];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-12">
      {categories.map((category) => {
        const projects = PROJECTS.filter((p) => p.category === category);
        if (projects.length === 0) return null;

        return (
          <section key={category}>
            <h2 className="mb-4 text-xl font-semibold text-zinc-800 dark:text-zinc-200">
              {CATEGORY_LABELS[category]}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Link
                  key={project.slug}
                  href={project.href ?? `/${project.slug}`}
                  className="group rounded-lg border border-zinc-200 p-5 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
                >
                  <h3 className="font-semibold group-hover:underline">
                    {project.title}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {project.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(
                      project.techOriginal ??
                      project.techRemastered ??
                      project.techReimagined ??
                      []
                    ).map((tech) => (
                      <span
                        key={tech}
                        className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                    {project.year}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function LandingView() {
  const [view, setView] = useState<"globe" | "list">("globe");

  const projectCards = PROJECTS.map((project) => ({
    id: project.slug,
    node: <ProjectCard project={project} />,
  }));
  const globeItems = [
    { id: "_spacer-top", node: <div /> },
    ...projectCards,
    { id: "_spacer-bottom", node: <div /> },
  ];

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-12">
      <a
        href="https://software.infinite-syndicate.com"
        className="mb-4 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
      >
        ← Software Portfolio
      </a>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        UNLV Museum
      </h1>
      <p className="mt-4 max-w-lg text-center text-zinc-600 dark:text-zinc-400">
        Projects from UNLV&apos;s software development course, rebuilt across
        three tiers: original, remastered, and reimagined.
      </p>

      <div className="mt-6 inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        <button
          onClick={() => setView("globe")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === "globe" ? "bg-white shadow-sm dark:bg-zinc-700" : "text-zinc-600 dark:text-zinc-400"}`}
        >
          <GlobeIcon size={14} />
          Globe
        </button>
        <button
          onClick={() => setView("list")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === "list" ? "bg-white shadow-sm dark:bg-zinc-700" : "text-zinc-600 dark:text-zinc-400"}`}
        >
          <List size={14} />
          List
        </button>
      </div>

      {view === "globe" ? (
        <div className="mt-8">
          <Globe items={globeItems} />
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => (
              <span
                key={cat}
                className="flex items-center gap-1.5 text-xs text-zinc-500"
              >
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${CATEGORY_BG[cat]}`}
                />
                {CATEGORY_LABELS[cat]}
              </span>
            ))}
          </div>
          <p className="mt-2 text-center text-xs text-zinc-400">
            Drag to rotate. Click a card to explore.
          </p>
        </div>
      ) : (
        <div className="mt-12 w-full">
          <ListView />
        </div>
      )}
    </div>
  );
}
