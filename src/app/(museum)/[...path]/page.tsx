import { notFound } from "next/navigation";
import { ProjectChrome } from "@/components/ui/ProjectChrome";
import {
  NotesProvider,
  ProjectNotes,
} from "@/components/ui/ProjectChromeNotes";
import { LeafBodyScroll } from "@/components/ui/LeafBodyScroll";
import museumPageShellStyles from "@/components/ui/MuseumPageShell.module.css";
import { findProject, renderProjectBody } from "@/lib/project-route";
import type { ViewMode } from "@/lib/projects";

/**
 * Catch-all page for FLAT slugs and their tier sub-routes.
 *
 * Accepts:
 *   /<slug>                  → flat project, original tier
 *   /<slug>/<tier>           → flat project, named tier (enhanced/reimagined)
 *
 * Containerized URLs (/<container>/<slug>(/<tier>)?) are matched by
 * the container's explicit routes before this catch-all fires, per
 * Next.js's specificity ordering.
 *
 * No backward-compat shims: the legacy `?mode=<tier>` query-param URL
 * is gone, per the smash-and-update directive. Old URLs that relied
 * on `?mode=` 404 cleanly.
 *
 * ProjectChrome renders here (not in the catch-all layout) because
 * the catch-all layout doesn't have visibility into which slug the
 * page is rendering — `params.path` lives at the page level. The
 * chrome holds visual position across navigations via its named
 * view-transition, so the per-page rebuild is invisible to visitors.
 */
export default async function FlatProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { path } = await params;
  const { page } = await searchParams;

  // Last segment may be a tier ("enhanced" or "reimagined"); peel it
  // off so findProject can match against the project path alone.
  let tier: ViewMode = "original";
  let projectSegments = [...path];
  const last = projectSegments[projectSegments.length - 1];
  if (last === "enhanced" || last === "reimagined") {
    tier = last;
    projectSegments = projectSegments.slice(0, -1);
  }

  const project = findProject(projectSegments.join("/"));
  if (!project) notFound();

  return (
    <NotesProvider>
      <ProjectChrome project={project} />
      {/* ProjectNotes is a fixed-position overlay; it lives outside
          <main> so leafBody's width and scroll are unconstrained by
          notes' presence. The chromeSpacer inside <main> reserves
          flow space matching both chrome-h and notes-h. */}
      <ProjectNotes project={project} tier={tier} />
      <LeafBodyScroll>
        <div className={museumPageShellStyles.chromeSpacer} aria-hidden="true" />
        {renderProjectBody({ project, tier, page })}
      </LeafBodyScroll>
    </NotesProvider>
  );
}
