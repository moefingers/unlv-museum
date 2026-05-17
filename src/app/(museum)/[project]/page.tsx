import { notFound, redirect } from "next/navigation";
import { PROJECTS, type ViewMode } from "@/lib/projects";
import { UnavailableSlot } from "@/components/ui/TierFallback";

const VALID_MODES: ViewMode[] = ["original", "enhanced", "reimagined"];

/**
 * Canonical landing for /<slug> — renders the original tier. Also handles
 * legacy `?mode=<tier>` query-param URLs by redirecting to /<slug>/<tier>.
 */
export default async function ProjectOriginalPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { project: slug } = await params;
  const { mode } = await searchParams;

  // Backward-compat for legacy URLs with `?mode=enhanced` etc.
  if (mode && VALID_MODES.includes(mode as ViewMode) && mode !== "original") {
    redirect(`/${slug}/${mode}`);
  }

  const project = PROJECTS.find((p) => p.slug === slug);
  if (!project) notFound();

  // Backend-only projects redirect to the rich /api-client UI rather than
  // rendering the simpler embedded ApiExplorer inside the museum chrome.
  // The `href` field is the project's preferred entry point — the Globe
  // already uses it as the link target.
  if (project.href) {
    redirect(project.href);
  }

  return project.original ?? <UnavailableSlot tier="original" />;
}
