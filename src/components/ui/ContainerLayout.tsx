import { SiblingRail } from "@/components/ui/SiblingRail";
import { MuseumPageShell } from "@/components/ui/MuseumPageShell";
import { containerLeaves } from "@/lib/project-route";
import type { ContainerId } from "@/lib/projects";

/**
 * Body of `app/(museum)/<container>/layout.tsx`.
 *
 * Each container's layout.tsx is a thin wrapper handing its container
 * ID to this primitive — see e.g. `js-exercises/layout.tsx`. Centralizing
 * the body here means every container route renders with identical
 * structure, no per-container duplication of "list leaves, render shell
 * with rail."
 *
 * Why this layout owns the rail (instead of the leaf page): Next.js
 * keeps a layout MOUNTED across child route changes. Navigating between
 * two leaves under the same container reuses this layout's React tree,
 * so SiblingRail's Collapsibles aren't remounted and their open/close
 * height transitions get to fire on `current`-prop changes. Under the
 * old catch-all-layout-everywhere model, every leaf navigation was a
 * fresh layout instance and the Collapsibles couldn't animate.
 *
 * The slug isn't visible at this layout's level (it's a child segment),
 * so this primitive doesn't resolve any specific project. SiblingRail
 * derives the active leaf from `usePathname()` client-side; siblings
 * are container-level data so we can compute them here without knowing
 * the slug.
 */
export function ContainerLayout({
  containerId,
  children,
}: {
  containerId: ContainerId;
  children: React.ReactNode;
}) {
  const siblings = containerLeaves(containerId);

  return (
    <MuseumPageShell
      rail={
        siblings.length > 1 ? (
          <SiblingRail container={containerId} siblings={siblings} />
        ) : undefined
      }
    >
      {children}
    </MuseumPageShell>
  );
}
