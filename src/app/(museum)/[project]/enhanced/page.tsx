import { notFound } from "next/navigation";
import { PROJECTS } from "@/lib/projects";
import {
  ExternalTierCard,
  UnavailableSlot,
} from "@/components/ui/TierFallback";

export default async function ProjectEnhancedPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project: slug } = await params;
  const project = PROJECTS.find((p) => p.slug === slug);
  if (!project) notFound();

  if (project.enhancedExternal) {
    return (
      <ExternalTierCard
        tier="enhanced"
        title={project.title}
        href={project.enhancedExternal}
      />
    );
  }
  return project.enhanced ?? <UnavailableSlot tier="enhanced" />;
}
