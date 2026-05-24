import { ProjectChrome } from "@/components/ui/ProjectChrome";
import {
  NotesProvider,
  ProjectNotes,
} from "@/components/ui/ProjectChromeNotes";
import museumPageShellStyles from "@/components/ui/MuseumPageShell.module.css";
import { renderProjectBody, resolveContainerLeaf } from "@/lib/project-route";
import type { ContainerId, ViewMode } from "@/lib/projects";

/**
 * Body of `app/(museum)/<container>/[slug]/<tier?>/page.tsx`.
 *
 * Each container has three (or fewer) leaf pages — one per tier
 * (original / enhanced / reimagined). Every one of them just calls
 * this primitive with its container ID + tier. Centralizing the
 * page body here means every container × tier route renders with
 * identical structure: resolve the leaf, render its chrome, the
 * sticky notes panel (inside <main>), and the tier body.
 *
 * The <NotesProvider> wraps both the chrome (which renders the
 * toggle button) and <main> (which contains <ProjectNotes/>) so the
 * two pieces share open/closed state. The chrome's toggle flips the
 * panel inside <main>, even though they're physically separated in
 * the DOM by the shell's grid.
 *
 * Why ProjectChrome is here (not in the container layout): the
 * layout doesn't have visibility into the `[slug]` param (it lives
 * one segment below), so the leaf-specific chrome has to be built
 * at the page level. The chrome's view-transition-naming keeps it
 * visually in place across leaf navigations even though React
 * rebuilds it.
 */
export async function ContainerLeafPage({
  containerId,
  tier,
  params,
  searchParams,
}: {
  containerId: ContainerId;
  tier: ViewMode;
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page } = await searchParams;
  const project = resolveContainerLeaf(containerId, slug);

  return (
    <NotesProvider>
      <ProjectChrome project={project} />
      {/* ProjectNotes is a fixed-position overlay; it lives outside
          <main> so leafBody's width and scroll are unconstrained by
          notes' presence. The chromeSpacer inside <main> reserves
          flow space matching both chrome-h and notes-h. */}
      <ProjectNotes project={project} tier={tier} />
      <main className={museumPageShellStyles.leafBody}>
        <div className={museumPageShellStyles.chromeSpacer} aria-hidden="true" />
        {renderProjectBody({ project, tier, page })}
      </main>
    </NotesProvider>
  );
}
