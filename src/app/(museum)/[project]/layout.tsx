import { notFound } from "next/navigation";
import { PROJECTS } from "@/lib/projects";
import { ProjectChrome } from "@/components/ui/ProjectChrome";
import styles from "./layout.module.css";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ project: string }>;
}) {
  const { project: slug } = await params;
  const project = PROJECTS.find((p) => p.slug === slug);
  if (!project) notFound();

  return (
    <div className={styles.shell}>
      <ProjectChrome project={project} />
      <div className={styles.viewport}>{children}</div>
    </div>
  );
}
