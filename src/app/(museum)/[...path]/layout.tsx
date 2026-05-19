import { notFound } from "next/navigation";
import { findByPath, PROJECTS, type Project } from "@/lib/projects";
import { ProjectChrome } from "@/components/ui/ProjectChrome";
import { SiblingRail } from "@/components/ui/SiblingRail";
import styles from "./layout.module.css";

/**
 * Catch-all layout. Resolves the path (peeling off any trailing tier
 * segment) and renders the persistent project chrome + viewport. When
 * the project belongs to a container, a SiblingRail flanks the viewport
 * with links to the other leaves; flat projects render without a rail.
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;

  // Mirror the page-level tier peeling so the resolved project survives
  // tier sub-routes (/<...>/enhanced, /<...>/reimagined).
  let projectSegments = [...path];
  const last = projectSegments[projectSegments.length - 1];
  if (last === "enhanced" || last === "reimagined") {
    projectSegments = projectSegments.slice(0, -1);
  }

  const project = findByPath(projectSegments.join("/"));
  if (!project) notFound();

  const siblings: Project[] = project.container
    ? PROJECTS.filter((p) => p.container === project.container)
    : [];

  return (
    <div className={styles.shell}>
      <ProjectChrome project={project} />
      <div className={styles.viewportRow}>
        {siblings.length > 1 && (
          <SiblingRail
            container={project.container!}
            current={project.slug}
            siblings={siblings}
          />
        )}
        <div className={styles.viewport}>{children}</div>
      </div>
    </div>
  );
}
