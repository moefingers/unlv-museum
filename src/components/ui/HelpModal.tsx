"use client";

import { useEffect } from "react";
import {
  HelpCircle,
  MousePointer2,
  Eye,
  MousePointerClick,
  Compass,
} from "lucide-react";
import styles from "./HelpModal.module.css";

/**
 * Help "modal" that morphs from a circular help button (top-right of
 * the viewport) into a centered rounded card. The button AND the
 * panel are the same DOM element — only its dimensions, position,
 * and border-radius change. Content fades in once the morph completes;
 * the help icon fades out at the same time.
 *
 * No native <dialog>. The dialog element's top-layer / display:none
 * dance fights smooth dimension transitions. A plain <div> with
 * a data-open attribute morphs cleanly under standard CSS transitions
 * — at the cost of hand-rolling ESC + backdrop + inert behavior,
 * which the parent of this component (or this file) provides via
 * a sibling backdrop and a keydown listener.
 *
 * Accessibility: when open, the help element has role="dialog"
 * and aria-modal="true"; otherwise it's role="button". Focus is
 * not trapped here — the backdrop is click-to-close and Tab cycles
 * normally; for a single-button informational modal this is fine
 * (no surrounding form fields to confuse focus order).
 */
export function HelpModal({
  open,
  onOpen,
  onClose,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  // ESC closes when open. Bound only while open so we're not adding
  // global keydown handlers for nothing on every page load.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop: only intercepts clicks while open (CSS pointer-events
          toggles based on data-open). Clicking outside the morphing
          panel closes the modal. */}
      <button
        type="button"
        className={styles.backdrop}
        data-open={open}
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
      />

      <div
        className={styles.morph}
        data-open={open}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-labelledby={open ? "help-modal-title" : undefined}
      >
        {/* Icon button. Centered inside the closed circle; migrates
            to the top-right corner when the morph opens. Same element
            across both states: clicking opens (when closed) or
            closes (when open). */}
        <button
          type="button"
          className={styles.iconButton}
          onClick={open ? onClose : onOpen}
          aria-label={open ? "Close help" : "Show help"}
        >
          <HelpCircle size={16} />
        </button>

        {/* Open state: full panel content. Fades in once the morph has
            settled (CSS transition-delay). When closed, this is
            invisible AND non-interactive. */}
        <div className={styles.content} aria-hidden={!open}>
          <h1 id="help-modal-title" className={styles.title}>
            UNLV Museum
          </h1>
          <p className={styles.lede}>
            Projects from UNLV&apos;s software development course, rebuilt
            across three tiers: original, enhanced, and reimagined.
          </p>
          <p className={styles.howTo}>A few things to try:</p>

          <ul className={styles.steps}>
            <li>
              <span className={styles.stepIcon}>
                <MousePointer2 size={18} />
              </span>
              <div>
                <strong>Click and drag</strong> the globe to rotate it.
              </div>
            </li>
            <li>
              <span className={styles.stepIcon}>
                <Eye size={18} />
              </span>
              <div>
                <strong>Hover</strong> on a point to preview a project.
              </div>
            </li>
            <li>
              <span className={styles.stepIcon}>
                <MousePointerClick size={18} />
              </span>
              <div>
                <strong>Click</strong> a title to open the preview.
              </div>
            </li>
            <li>
              <span className={styles.stepIcon}>
                <Compass size={18} />
              </span>
              <div>
                <strong>Navigate</strong> between projects from inside.
              </div>
            </li>
          </ul>

          <p className={styles.note}>More coming soon.</p>

          <button
            type="button"
            className={styles.gotIt}
            onClick={onClose}
            tabIndex={open ? 0 : -1}
          >
            Got it
          </button>
        </div>
      </div>
    </>
  );
}
