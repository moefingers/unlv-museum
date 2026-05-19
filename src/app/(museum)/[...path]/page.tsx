import { ViewTransition } from "react";
import { notFound, redirect } from "next/navigation";
import { findByPath, projectPath, type ViewMode } from "@/lib/projects";
import {
  ExternalTierCard,
  UnavailableSlot,
} from "@/components/ui/TierFallback";

const VALID_MODES: ViewMode[] = ["original", "enhanced", "reimagined"];

/**
 * Catch-all project route. Accepts:
 *   /<slug>                                  → flat project, original tier
 *   /<slug>/<tier>                           → flat project, named tier
 *   /<container>/<slug>                      → containerized project, original tier
 *   /<container>/<slug>/<tier>               → containerized project, named tier
 *
 * The legacy `?mode=<tier>` query-param URL is rewritten to the path-segment
 * form before tier dispatch, same as the prior implementation.
 */
export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { path } = await params;
  const { mode } = await searchParams;

  // Last segment may be a tier ("enhanced" or "reimagined"); peel it off so
  // findByPath can match against the project path alone.
  let tier: ViewMode = "original";
  let projectSegments = [...path];
  const last = projectSegments[projectSegments.length - 1];
  if (last === "enhanced" || last === "reimagined") {
    tier = last;
    projectSegments = projectSegments.slice(0, -1);
  }

  const project = findByPath(projectSegments.join("/"));
  if (!project) notFound();

  // Backward-compat for legacy `?mode=<tier>` URLs from before the path-segment
  // tier convention. Redirect to canonical /<...>/<tier>.
  if (mode && VALID_MODES.includes(mode as ViewMode) && mode !== "original") {
    redirect(`/${projectPath(project)}/${mode}`);
  }

  // Backend-only entries redirect to /api-client. The `href` field is the
  // project's preferred entry point — the Globe already uses it as the link
  // target so most visitors never hit this fallback.
  if (project.href && tier === "original") {
    redirect(project.href);
  }

  // Compute the body for whichever tier, then wrap once at the bottom so
  // page-content (and its keyframed fade+blur+slide from globals.css) gets
  // applied uniformly. See CONTEXT/internal_docs/view-transitions.md (zcanon).
  let body: React.ReactNode;
  if (tier === "enhanced") {
    body = project.enhancedExternal ? (
      <ExternalTierCard
        tier="enhanced"
        title={project.title}
        href={project.enhancedExternal}
      />
    ) : (
      (project.enhanced ?? <UnavailableSlot tier="enhanced" />)
    );
  } else if (tier === "reimagined") {
    body = project.reimaginedExternal ? (
      <ExternalTierCard
        tier="reimagined"
        title={project.title}
        href={project.reimaginedExternal}
      />
    ) : (
      (project.reimagined ?? <UnavailableSlot tier="reimagined" />)
    );
  } else {
    body = project.original ?? <UnavailableSlot tier="original" />;
  }

  return <ViewTransition name="page-content">{body}</ViewTransition>;
}
