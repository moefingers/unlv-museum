import { MuseumPageShell } from "@/components/ui/MuseumPageShell";

/**
 * Catch-all layout for FLAT museum slugs (projects without a container).
 *
 * Containerized leaves use their own `<container>/layout.tsx`, which
 * gives them a persistent layout across leaf navigations (SiblingRail
 * stays mounted, Collapsibles animate). The catch-all still handles
 * flat slugs, and flat slugs have no siblings — no rail to render
 * here.
 *
 * The chrome (ProjectChrome) lives in the page now, not the layout —
 * see [...path]/page.tsx. ProjectChrome holds its own position
 * across route changes via `view-transition-name: site-header`, so
 * visitors see one continuous chrome bar even though React rebuilds
 * it on each navigation.
 */
export default function FlatProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MuseumPageShell>{children}</MuseumPageShell>;
}
