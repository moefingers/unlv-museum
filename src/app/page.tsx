import { ViewTransition } from "react";
import Link from "next/link";
import { PROJECTS, CATEGORY_LABELS, type Category } from "@/lib/projects";

export default function Home() {
  const categories = Object.keys(CATEGORY_LABELS) as Category[];

  return (
    <ViewTransition name="page-content">
      <div className="flex flex-1 flex-col items-center px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          UNLV Museum
        </h1>
        <p className="mt-4 max-w-lg text-center text-zinc-600 dark:text-zinc-400">
          Projects from UNLV&apos;s software development course, rebuilt across
          three tiers: original, remastered, and reimagined.
        </p>

        <div className="mt-12 w-full max-w-5xl space-y-12">
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
                      href={`/${project.slug}`}
                      className="group rounded-lg border border-zinc-200 p-5 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
                    >
                      <h3 className="font-semibold group-hover:underline">
                        {project.title}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        {project.description}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {project.techOriginal.map((tech) => (
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
      </div>
    </ViewTransition>
  );
}
