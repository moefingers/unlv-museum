import { notFound } from "next/navigation";
import { PROJECTS } from "@/lib/projects";
import {
  ExternalTierCard,
  UnavailableSlot,
} from "@/components/ui/TierFallback";

export default async function ProjectReimaginedPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project: slug } = await params;
  const project = PROJECTS.find((p) => p.slug === slug);
  if (!project) notFound();

  if (project.reimaginedExternal) {
    return (
      <ExternalTierCard
        tier="reimagined"
        title={project.title}
        href={project.reimaginedExternal}
      />
    );
  }
  return project.reimagined ?? <UnavailableSlot tier="reimagined" />;
}
