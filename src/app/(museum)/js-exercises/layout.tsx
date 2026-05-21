import { ContainerLayout } from "@/components/ui/ContainerLayout";

/**
 * Persistent layout for /js-exercises/<slug>(/<tier>)? routes.
 *
 * The layout exists at this depth (not deeper at [slug]/layout.tsx,
 * not shallower at the catch-all) so SiblingRail stays mounted across
 * cross-leaf navigations — Next.js reuses the layout instance when
 * only the path below changes. With the layout mounted, the rail's
 * Collapsibles get to fire their open/close height transitions
 * naturally on `current`-prop changes. The catch-all variant
 * remounted on every leaf swap, which is why animations didn't fire.
 *
 * All structural logic lives in <ContainerLayout>. This file's only
 * job is to thread `js-exercises` into the container prop. The
 * folder name is the container ID by Next.js convention, and
 * `CONTAINERS["js-exercises"]` in `src/lib/projects.tsx` must match
 * exactly.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ContainerLayout containerId="js-exercises">{children}</ContainerLayout>
  );
}
