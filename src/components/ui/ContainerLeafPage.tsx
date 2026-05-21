import { ProjectChrome } from "@/components/ui/ProjectChrome";
import { renderProjectBody, resolveContainerLeaf } from "@/lib/project-route";
import type { ContainerId, ViewMode } from "@/lib/projects";

/**
 * Body of `app/(museum)/<container>/[slug]/<tier?>/page.tsx`.
 *
 * Each container has three (or fewer) leaf pages — one per tier
 * (original / enhanced / reimagined). Every one of them just calls
 * this primitive with its container ID + tier. Centralizing the
 * page body here means every container × tier route renders with
 * identical structure: resolve the leaf, render its chrome, dispatch
 * to the tier body.
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
    <>
      <ProjectChrome project={project} />
      {renderProjectBody({ project, tier, page })}
    </>
  );
}
