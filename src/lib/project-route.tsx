/**
 * Server-side helpers shared by every museum project route.
 *
 * Two route shapes call into these:
 *   1. Per-container leaf routes — `app/(museum)/<container>/[slug]/...`.
 *      Each container has a persistent layout that owns SiblingRail,
 *      which is what makes the rail's Collapsible animations actually
 *      fire on cross-leaf navigation (the layout stays mounted; React
 *      keeps the rail's DOM stable).
 *   2. The catch-all `app/(museum)/[...path]/...` — handles flat slugs
 *      (projects without a container). It does its own tier-segment
 *      peeling because path-segment count is variable for flat slugs.
 *
 * The work shared between them:
 *   - resolving a Project by path (cached so layout + page calls in the
 *     same request don't re-walk the array),
 *   - listing a container's leaves (cached for the same reason),
 *   - the tier-dispatch + ?page= normalization that decides what the
 *     viewport renders.
 *
 * Why `cache()`: Next.js renders the layout AND the page server-side
 * for the same request. Both need the same Project. Without `cache()`
 * each would re-run `findByPath` independently. With `cache()` the
 * second call inside one render returns the memoized result. This is
 * the canonical Next.js shape for "data both layout and page need."
 */

import { cache } from "react";
import { ViewTransition } from "react";
import { notFound, redirect } from "next/navigation";
import {
  CONTAINERS,
  PROJECTS,
  findByPath,
  pageSlug,
  projectPath,
  type ContainerId,
  type Project,
  type ViewMode,
} from "@/lib/projects";
import { MultiPageOriginal } from "@/components/ui/MultiPageOriginal";
import {
  ExternalTierCard,
  UnavailableSlot,
} from "@/components/ui/TierFallback";

/**
 * Memoized project lookup. Identical args across a single server
 * render share one result, so a layout and its child page don't both
 * walk PROJECTS.
 */
export const findProject = cache((path: string): Project | undefined =>
  findByPath(path),
);

/**
 * Memoized leaves of a container, in array order. The Globe graph
 * layout (curriculum-curve, future) reads leaf order from this array
 * — see CONTAINERS comments in projects.tsx.
 */
export const containerLeaves = cache((containerId: ContainerId): Project[] =>
  PROJECTS.filter((p) => p.container === containerId),
);

/**
 * The "default leaf" for a container — the first entry in array order.
 * Used by `<container>/page.tsx` to redirect bare /<container> to a
 * concrete leaf.
 */
export function firstLeafSlug(containerId: ContainerId): string {
  const leaves = containerLeaves(containerId);
  const first = leaves[0];
  if (!first) {
    throw new Error(
      `Container "${containerId}" has no leaves. Add at least one Project with this container ID, or remove the container from CONTAINERS in projects.tsx.`,
    );
  }
  return first.slug;
}

/**
 * Resolve a container leaf or 404. Used by container layouts and
 * leaf pages — both need the Project, both call this, the cache
 * collapses the duplicate work.
 */
export function resolveContainerLeaf(
  containerId: ContainerId,
  slug: string,
): Project {
  const project = findProject(`${containerId}/${slug}`);
  if (!project || project.container !== containerId) notFound();
  return project;
}

/**
 * Render the project body for a given tier + ?page= query value.
 * Returns a <ViewTransition> wrapper around the appropriate tier UI.
 *
 * May throw via redirect() when:
 *   - the project's an `href`-only entry (backend-only — redirect to
 *     the viewer route, e.g. /api-client?api=<id>),
 *   - ?page= is missing/unknown for a multi-page original (normalize
 *     to the first page's slug).
 */
export function renderProjectBody({
  project,
  tier,
  page,
}: {
  project: Project;
  tier: ViewMode;
  page: string | undefined;
}): React.ReactNode {
  if (project.href && tier === "original") {
    redirect(project.href);
  }

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
  } else if (project.pages && project.pages.length > 0) {
    const knownSlugs = new Set(project.pages.map((p) => pageSlug(p.label)));
    if (!page || !knownSlugs.has(page)) {
      const first = pageSlug(project.pages[0]!.label);
      redirect(`/${projectPath(project)}?page=${first}`);
    }
    body = <MultiPageOriginal pages={project.pages} />;
  } else {
    body = project.original ?? <UnavailableSlot tier="original" />;
  }

  return <ViewTransition name="page-content">{body}</ViewTransition>;
}

/**
 * Container ID list, derived from CONTAINERS. Used by static-route
 * scaffolding to enumerate the canonical containers — never type a
 * container ID as a literal at a call site; pull from here.
 */
export const CONTAINER_IDS = Object.keys(CONTAINERS) as ContainerId[];
