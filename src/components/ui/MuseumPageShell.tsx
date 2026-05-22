import styles from "./MuseumPageShell.module.css";

/**
 * Layout primitive shared by every museum project route.
 *
 * Owns:
 *   - the fixed-viewport CSS grid (chrome row above, rail-and-body row
 *     below — see MuseumPageShell.module.css for the grid sketch),
 *   - a left-rail slot (`rail` prop) — container layouts inject a
 *     SiblingRail here; the catch-all (flat slugs, no siblings)
 *     passes nothing,
 *   - the viewport slot (`children`) that holds the leaf page output.
 *
 * The leaf is expected to emit exactly two siblings:
 *   1. <ProjectChrome /> (rendered as a <header> via MuseumChrome)
 *   2. <main className={museumPageShellStyles.leafBody}>{tierBody}</main>
 *
 * The viewport wrapper uses `display: contents` so those two siblings
 * participate in the shell's grid directly, the chrome landing across
 * the top row and the body landing in the bottom-right cell.
 *
 * Why the chrome is NOT here: the chrome is per-leaf data
 * (project-specific title, notes, GH source link), so it has to live
 * in the leaf page, not the container layout. The chrome visually
 * persists across leaf navigations via its own view-transition
 * naming (`view-transition-name: site-header`).
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
    <div className={`${styles.shell} ${rail ? styles.withRail : ""}`}>
      {rail && <div className={styles.rail}>{rail}</div>}
      <div className={styles.viewport}>{children}</div>
    </div>
  );
}

export { styles as museumPageShellStyles };
