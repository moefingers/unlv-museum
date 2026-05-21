import styles from "./MuseumPageShell.module.css";

/**
 * Layout primitive shared by every museum project route.
 *
 * Owns:
 *   - the fixed-viewport flex column (no body-level scroll),
 *   - a left-rail slot (`rail` prop) — container layouts inject a
 *     SiblingRail here; the catch-all (flat slugs, no siblings)
 *     passes nothing,
 *   - the viewport slot (`children`) that holds the leaf page,
 *     which itself contains the ProjectChrome + tier body.
 *
 * Why the chrome is NOT here: the chrome is per-leaf data
 * (project-specific title, notes, GH source link), so it has to live
 * in the leaf page, not the container layout. The chrome visually
 * persists across leaf navigations via its own view-transition
 * naming (`view-transition-name: site-header`) — the browser holds
 * the named element's position across the route swap, so visitors
 * see one continuous chrome bar even though React rebuilds it on
 * each navigation.
 *
 * The shell is intentionally dumb: no project lookup, no pathname
 * read, no knowledge of containers vs flat slugs. All routing
 * context comes from above; the shell just paints the grid.
 */
export function MuseumPageShell({
  rail,
  children,
}: {
  rail?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <div className={styles.viewportRow}>
        {rail}
        <div className={styles.viewport}>{children}</div>
      </div>
    </div>
  );
}
