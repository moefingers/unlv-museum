"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, List } from "lucide-react";
import { SignInChip } from "@/components/auth/SignInChip";
import { MuseumMark } from "./MuseumMark";
import { ThemeToggle } from "./ThemeToggle";
import { useNavTrail, markTrailNavigation } from "@/hooks/use-nav-trail";
import { findByPath } from "@/lib/projects";
import styles from "./MuseumChrome.module.css";

/**
 * Per-tier descriptor for the tier picker.
 *
 * - `href` omitted → tier is rendered as a disabled <span> (not a link).
 *   ProjectChrome uses this for tiers that don't exist on a given project.
 * - `current` true → tier gets the filled `card`-surface highlight and
 *   `aria-current="page"`. The CURRENT tier's pill background carries
 *   `view-transition-name: tier-pill-bg` so the highlight morphs across
 *   tier navigations.
 */
export interface TierSpec {
  label: string;
  href?: string;
  current?: boolean;
}

interface MuseumChromeProps {
  /** Title (rendered as <h1>). */
  title: ReactNode;
  /**
   * Secondary line under the title. ProjectChrome uses this for
   * year + tech; ApiClient uses it for a descriptive subtitle.
   */
  subtitle?: ReactNode;
  /**
   * Optional inline-with-subtitle slot. ProjectChrome uses this to
   * render the notes toggle button next to the year/tech line.
   */
  titleExtra?: ReactNode;
  /**
   * Tier picker descriptors. Omitted → no picker renders. 2 or 3
   * tiers depending on caller (api-client skips Enhanced).
   */
  tiers?: TierSpec[];
  /**
   * Optional content rendered INSIDE the sticky <header> but BELOW
   * the main row. ProjectChrome uses this for the per-tier notes
   * collapsible panel.
   */
  belowRow?: ReactNode;
}

/**
 * Shared museum chrome — the sticky top header used by ProjectChrome
 * and the api-client.
 *
 * Lead-group layout: four controls in a fixed order so the visual
 * grammar is "history nav (back/forward) → trail nav (list) → home":
 *
 *   1. Back button → browser `history.back()` with fallback to `/`
 *      when there's no entry to pop (e.g. the visitor landed directly
 *      via a shared link or fresh tab). Keeps the `site-back-link`
 *      view-transition name so the arrow holds position across
 *      chrome-bearing route navigations.
 *
 *   2. Forward button → `router.forward()`. The browser doesn't
 *      expose whether a forward entry exists, so the button is
 *      always enabled; clicking it when there's nothing to forward
 *      to is a silent no-op (matches how browsers' own forward
 *      buttons behave at the end of history). Pairing it with back
 *      is the honest browser-history idiom — the recents dropdown
 *      is a different mental model (a list of pages I've touched)
 *      and doesn't subsume "redo my last back."
 *
 *   3. List button → popover dropdown of pages the visitor has
 *      recently visited in this tab. Backed by `useRecentPages`
 *      (sessionStorage). Resolves each path's project title via
 *      `findByPath` so the labels read as project names rather
 *      than slugs. The popover opens with a scale+opacity transform
 *      anchored at top-left so it feels like it unfolds from the
 *      list button itself rather than appearing whole-cloth.
 *
 *   4. Museum mark → `<Link href="/">`. The canonical "home" affordance.
 *      Used to be conflated with the back arrow (the previous chrome
 *      had a single back link defaulting to `/`); separating the two
 *      lets each control mean exactly one thing.
 */
export function MuseumChrome({
  title,
  subtitle,
  titleExtra,
  tiers,
  belowRow,
}: MuseumChromeProps) {
  return (
    <header
      className={styles.header}
      // Inline style so the literal identifier survives CSS Modules
      // scoping — the browser identifies old↔new participants by
      // exact-name match, and the global ::view-transition-*
      // (site-header) rules in globals.css also bind to the literal.
      // Same rationale (literal preservation for participant pairing)
      // applies to site-back-link, tier-pill-bg, site-signin,
      // sibling-rail-host, sibling-current — those don't have custom
      // animation rules but still need the literal name so the
      // browser can pair their snapshots across routes.
      style={{
        viewTransitionName: "site-header",
        // PostCSS / Lightning CSS strips the unprefixed
        // `backdrop-filter` when an adjacent `-webkit-backdrop-filter`
        // exists, leaving only the WebKit-prefixed property. Modern
        // Chrome/Firefox want the UNPREFIXED form, so the blur was
        // silently dropped on every non-Safari browser. Inline style
        // bypasses the CSS pipeline and reaches the DOM unmodified.
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div className={styles.row}>
        <div className={styles.leadGroup}>
          <LeadControls />
          <div className={styles.titleBlock}>
            <h1 className="text-lg font-semibold">{title}</h1>
            {(subtitle || titleExtra) && (
              <p className={`text-sm ${styles.meta}`}>
                {subtitle && <span>{subtitle}</span>}
                {titleExtra}
              </p>
            )}
          </div>
        </div>

        <div className={styles.trailGroup}>
          {tiers && tiers.length > 0 && (
            <nav className={styles.tierPicker} aria-label="Tier">
              {tiers.map((t, i) => {
                const stateClass = t.current
                  ? styles.tierCurrent
                  : t.href
                    ? styles.tierAvailable
                    : styles.tierDisabled;
                if (!t.href) {
                  return (
                    <span
                      key={i}
                      className={`${styles.tier} ${stateClass}`}
                      aria-disabled="true"
                      title={`${t.label} not available`}
                    >
                      {t.label}
                    </span>
                  );
                }
                return (
                  <Link
                    key={i}
                    href={t.href}
                    className={`${styles.tier} ${stateClass}`}
                    aria-current={t.current ? "page" : undefined}
                    // Inline view-transition-name on the active pill so
                    // its background morphs across tier nav — see the
                    // header's inline-style comment for why.
                    style={
                      t.current
                        ? { viewTransitionName: "tier-pill-bg" }
                        : undefined
                    }
                  >
                    {t.label}
                  </Link>
                );
              })}
            </nav>
          )}
          <ThemeToggle variant="chrome" />
          <SignInChip />
        </div>
      </div>
      {belowRow}
    </header>
  );
}

/**
 * Two-phase dismiss timing for the recents popover. Must match the
 * .recentPopoverLeaving animation duration in MuseumChrome.module.css
 * — the popover stays mounted for this long after the open flag flips
 * off so the exit transform/opacity can play to completion. Same
 * pattern as MuseumToastLayer.
 */
const RECENT_POPOVER_EXIT_MS = 160;

/**
 * The four lead-group controls. Extracted so the trail-recording
 * effect and the popover open-state both have a stable home —
 * keeping them in the top-level MuseumChrome would bloat it and
 * force every caller's render cycle through the trail state.
 *
 * Back + forward are rendered as `<Link>` elements (not buttons
 * driving `router.back()` / `router.forward()`) so they go through
 * Next 16's `experimental.viewTransition` wrapper — that's the
 * machinery that fires page morphs reliably. The router's history
 * methods route through popstate, which Next animates only when
 * the router cache has the target ready, producing spotty
 * transitions in practice.
 *
 * The trail's destinations come from `useNavTrail`: backHref is
 * stack[cursor + 1]?.url, forwardHref is stack[cursor - 1]?.url.
 * When there's nothing behind (e.g. visitor entered via a shared
 * link), back falls back to "/" — the museum sphere — so the
 * affordance is always live. When there's nothing ahead, forward
 * renders as aria-disabled with no href.
 */
function LeadControls() {
  const { recents, backHref, forwardHref } = useNavTrail();

  // Two-phase open/close: `open` drives the .recentPopoverOpen class
  // (entry animation) and `mounted` keeps the DOM node alive long
  // enough for the exit animation to finish before unmounting.
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const recentWrapRef = useRef<HTMLDivElement>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openPopover = () => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    setMounted(true);
    setOpen(true);
  };

  const closePopover = () => {
    setOpen(false);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    exitTimerRef.current = setTimeout(() => {
      setMounted(false);
      exitTimerRef.current = null;
    }, RECENT_POPOVER_EXIT_MS);
  };

  // Click-outside + Escape to close the recents popover. Mirrors the
  // SignInChip pattern so both popovers feel the same.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        recentWrapRef.current &&
        !recentWrapRef.current.contains(e.target as Node)
      ) {
        closePopover();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePopover();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Clean up any pending exit timer on unmount so we don't setState
  // on a torn-down component.
  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, []);

  // Back falls back to "/" so the affordance is always live, even
  // for visitors who entered via a shared link (empty trail).
  const resolvedBackHref = backHref ?? "/";
  const recentsAvailable = recents.length > 0;

  return (
    <div className={styles.leadControls}>
      <Link
        href={resolvedBackHref}
        className={styles.iconButton}
        aria-label="Back"
        // Mark intent BEFORE the Link's click event triggers the
        // navigation. The trail hook's recordVisit picks up this
        // flag and moves the cursor instead of pushing a fresh
        // entry — without it, a back-Link to project X looks
        // identical to a fresh see-also Link to project X, and
        // the trail would silently swap "back" for "fresh nav."
        //
        // Only marked when backHref is a real trail entry; the
        // fallback "/" case is a fresh navigation and shouldn't
        // be treated as trail-back.
        onClick={backHref ? () => markTrailNavigation("back") : undefined}
        // The site-back-link view-transition name still points at the
        // back affordance — its position is what the morph animates.
        // The identifier survives across chrome-bearing routes so the
        // arrow holds position even as the title block changes.
        style={{ viewTransitionName: "site-back-link" }}
      >
        <ArrowLeft size={18} />
      </Link>

      {forwardHref ? (
        <Link
          href={forwardHref}
          className={styles.iconButton}
          aria-label="Forward"
          onClick={() => markTrailNavigation("forward")}
        >
          <ArrowRight size={18} />
        </Link>
      ) : (
        // No forward entry — render a non-link with aria-disabled so
        // assistive tech sees the state. Plain <span> avoids the
        // <button disabled> hydration-attribute mismatch and looks
        // identical via the .iconButton[aria-disabled] CSS hook.
        <span
          className={styles.iconButton}
          aria-label="Forward"
          aria-disabled="true"
          role="link"
        >
          <ArrowRight size={18} />
        </span>
      )}

      <div ref={recentWrapRef} className={styles.recentWrap}>
        {recentsAvailable ? (
          <button
            type="button"
            onClick={() => (open ? closePopover() : openPopover())}
            className={styles.iconButton}
            aria-label="Recent pages"
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <List size={18} />
          </button>
        ) : (
          // Same aria-disabled treatment as forward above — render a
          // span instead of <button disabled> so the SSR/CSR attribute
          // shape matches (the `false` → `""` mismatch React 19 warns
          // about doesn't fire for spans).
          <span
            className={styles.iconButton}
            aria-label="Recent pages"
            aria-disabled="true"
            role="button"
          >
            <List size={18} />
          </span>
        )}
        {mounted && recentsAvailable && (
          <div
            role="menu"
            className={`${styles.recentPopover} ${
              open ? styles.recentPopoverOpen : styles.recentPopoverLeaving
            }`}
          >
            {recents.map((page) => {
              const project = findByPath(page.pathname);
              const label = project?.title ?? page.pathname;
              const subtitle = project ? page.pathname : undefined;
              return (
                <Link
                  // `recents` is deduped by pathname in the trail
                  // snapshot, so each entry's pathname (and hence its
                  // url) appears at most once — safe to key on.
                  key={page.pathname}
                  href={page.url}
                  role="menuitem"
                  className={styles.recentItem}
                  onClick={closePopover}
                >
                  <span className={styles.recentLabel}>{label}</span>
                  {subtitle && (
                    <span className={styles.recentPath}>{subtitle}</span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Link
        href="/"
        className={styles.markLink}
        aria-label="Back to the museum sphere"
      >
        <MuseumMark size={22} gradientId="museum-chrome-mark" />
      </Link>
    </div>
  );
}
