"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SignInChip } from "@/components/auth/SignInChip";
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
  /** Back-link destination. Defaults to museum landing. */
  backHref?: string;
  /** Accessible label for the back link. */
  backLabel?: string;
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
 * and the api-client. Both consumers used to ship parallel
 * implementations; this primitive unifies them. Lays out the back
 * arrow + title block on the lead, the tier picker + sign-in chip
 * on the trail, with `flex-wrap` so narrow viewports drop the trail
 * group to a new line rather than compressing the lead group to
 * nothing.
 *
 * View-transition names preserved from the legacy implementations:
 * `site-header` on the <header>, `site-back-link` on the back arrow,
 * `tier-pill-bg` on the current tier's pill — so the highlight
 * slides between tier links and the chrome morphs across routes.
 */
export function MuseumChrome({
  backHref = "/",
  backLabel = "Back to museum",
  title,
  subtitle,
  titleExtra,
  tiers,
  belowRow,
}: MuseumChromeProps) {
  return (
    <header className={styles.header}>
      <div className={styles.row}>
        <div className={styles.leadGroup}>
          <Link
            href={backHref}
            className={styles.backLink}
            aria-label={backLabel}
          >
            <ArrowLeft size={18} />
          </Link>
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
                  >
                    {t.label}
                  </Link>
                );
              })}
            </nav>
          )}
          <SignInChip />
        </div>
      </div>
      {belowRow}
    </header>
  );
}
