import { notFound } from "next/navigation";
import { PROJECTS } from "@/lib/projects";
import { ProjectChrome } from "@/components/ui/ProjectChrome";

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
    <div className="flex h-screen flex-col">
      <ProjectChrome project={project} />
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
