"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  HelpCircle,
  MousePointer2,
  MousePointerClick,
  ZoomIn,
  List,
  Keyboard,
  Mouse,
  Hand,
  Pointer,
  Smartphone,
  Settings,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useGraphics } from "@/hooks/use-graphics";
import styles from "./HelpModal.module.css";

/**
 * GitHub octocat mark (the "mark-github" octicon). Inlined as a tiny
 * SVG rather than imported from lucide because lucide dropped the
 * Github brand icon — and an inline single-path matches the brand
 * mark exactly without an external asset fetch.
 *
 * 16×16 native viewBox; size prop scales the rendered element.
 */
function OctocatIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.41.68 1.2 2.69.83 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  );
}

/**
 * Help "modal" that morphs from a circular help button (top-right of
 * the viewport) into a centered rounded card. The button AND the
 * panel are the same DOM element — only its dimensions, position,
 * and border-radius change. Content fades in once the morph completes;
 * the help icon migrates from center to top-right at the same time.
 *
 * Instructions are split into two modes — Mouse and Touch — with a
 * segmented toggle inside the modal. The default is detected via
 * `matchMedia('(pointer: coarse) and (hover: none)')`, which is
 * reliably true for phones / tablets and false for desktops; touch
 * laptops (which have both fine and coarse pointers) keep the mouse
 * default. The detected mode auto-updates if the matchMedia query
 * flips — unless the user has manually toggled, in which case their
 * choice sticks for the rest of the session.
 *
 * Accessibility: when open, the help element has role="dialog"
 * and aria-modal="true"; otherwise it's role="button". Focus is
 * not trapped here — the backdrop is click-to-close and Tab cycles
 * normally; for a single-button informational modal this is fine.
 */

type InputMode = "mouse" | "touch";

interface Step {
  icon: ReactNode;
  body: ReactNode;
}

// Step copy is split by input mode because mouse and touch have
// fundamentally different gesture vocabularies (hover doesn't exist
// on touch; scroll-wheel doesn't exist on touch; etc.). Each list
// is ordered by typical interaction sequence: explore → focus →
// inspect → adjust → escape → alt.
const STEPS_MOUSE: Step[] = [
  {
    icon: <MousePointer2 size={18} />,
    body: (
      <>
        <strong>Drag</strong> the globe to rotate it.
      </>
    ),
  },
  {
    icon: <MousePointerClick size={18} />,
    body: (
      <>
        <strong>Click</strong> a glowing point to open its project card.
      </>
    ),
  },
  {
    icon: <ZoomIn size={18} />,
    body: (
      <>
        <strong>Scroll</strong> to zoom the globe in or out.
      </>
    ),
  },
  {
    icon: <Keyboard size={18} />,
    body: (
      <>
        <strong>Esc</strong> or click away to close a card.
      </>
    ),
  },
  {
    icon: <List size={18} />,
    body: (
      <>
        Prefer a flat catalogue? <strong>Toggle to List view</strong> in the
        header.
      </>
    ),
  },
];

const STEPS_TOUCH: Step[] = [
  {
    icon: <Hand size={18} />,
    body: (
      <>
        In <strong>Tap mode</strong> (default): drag with one finger to rotate,
        tap a glowing point to open its card.
      </>
    ),
  },
  {
    icon: <Pointer size={18} />,
    body: (
      <>
        Switch to <strong>Hover mode</strong> in the header to preview titles: a
        crosshair follows your finger, lift to open whatever it&apos;s near.
      </>
    ),
  },
  {
    icon: <ZoomIn size={18} />,
    body: (
      <>
        <strong>Pinch</strong> to zoom the globe in or out.
      </>
    ),
  },
  {
    icon: <Pointer size={18} />,
    body: (
      <>
        Tap outside the card to <strong>close it</strong>.
      </>
    ),
  },
  {
    icon: <List size={18} />,
    body: (
      <>
        Prefer a flat catalogue? <strong>Toggle to List view</strong> in the
        header.
      </>
    ),
  },
];

const TOUCH_QUERY = "(pointer: coarse) and (hover: none)";

export function HelpModal({
  open,
  onOpen,
  onClose,
  onOpenGraphics,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  /**
   * Open the GraphicsModal. Threaded through so the onboarding pitch
   * line in this modal can act as a direct entry point — clicking the
   * gear icon closes help and opens graphics, mirroring the corner
   * cluster's mutual-exclusion behavior.
   */
  onOpenGraphics: () => void;
}) {
  // Theme + graphics surfaced here as an inline onboarding pitch:
  // the corner cluster is easy to overlook while the help modal is
  // open, so we restate the two appearance controls alongside the
  // welcome lede with the same icons that live in the corner.
  // useGraphics is consulted only for the detected/active tier label
  // — clicking the gear opens the dedicated modal where the real
  // controls live.
  const { resolvedMode, toggleMode } = useTheme();
  const { settings: graphics } = useGraphics();

  // SSR-safe init: default to mouse; the effect below runs on mount
  // and re-derives from matchMedia. Hydration mismatch is avoided
  // because the initial client render also yields "mouse" before the
  // effect bumps it.
  const [inputMode, setInputMode] = useState<InputMode>("mouse");
  // True once the user has clicked the mode toggle. After that, the
  // matchMedia listener stops overriding their choice — they own
  // the mode for the rest of the session.
  const userOverrodeRef = useRef(false);

  // Read the detected mode on mount and subscribe to changes (mouse
  // plugged into a tablet, browser zoom flipping pointer accuracy,
  // etc.). The listener only updates inputMode while the user
  // hasn't manually toggled.
  useEffect(() => {
    const mq = window.matchMedia(TOUCH_QUERY);
    const apply = () => {
      if (userOverrodeRef.current) return;
      setInputMode(mq.matches ? "touch" : "mouse");
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const selectMode = (mode: InputMode) => {
    userOverrodeRef.current = true;
    setInputMode(mode);
  };

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

  const steps = inputMode === "touch" ? STEPS_TOUCH : STEPS_MOUSE;

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
        // Stop wheel events from reaching the globe's wheel-zoom
        // handler underneath. The globe binds its wheel listener on
        // its own stage div (a DOM sibling, not an ancestor) so the
        // bubble path doesn't currently route into it — but capture-
        // phase listeners (or future refactors) could. Stopping here
        // makes the modal a wheel sink whenever it's mounted, which
        // is the right behavior regardless of how the globe wires up.
        onWheel={(e) => e.stopPropagation()}
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

        {/* Open state: full panel content. Fades in alongside the
            morph (CSS transition-delay). When closed, opacity 0
            and pointer-events: none so it doesn't interfere. */}
        <div className={styles.content} aria-hidden={!open}>
          <h1 id="help-modal-title" className={styles.title}>
            UNLV Museum
          </h1>
          <p className={styles.lede}>
            A retrospective of coursework from UNLV&apos;s software development
            program. Each project is preserved in three tiers:{" "}
            <strong>original</strong> (as turned in), <strong>enhanced</strong>{" "}
            (cleaned up), and <strong>reimagined</strong> (rebuilt with what
            I&apos;d know now).
          </p>

          {/*
            Inline appearance pitch. The two corner controls (graphics
            gear + theme toggle) are easy to overlook while the help
            modal is open; this restates both as clickable icons inside
            the prose. The gear opens the dedicated GraphicsModal (with
            mutual-exclusion against this modal); the theme icon flips
            light/dark in place. Showing the auto-detected tier name
            alongside makes the onboarding feel tailored — "we picked
            medium for your device, change anytime."
          */}
          <p className={styles.themePitch}>
            Change your graphics and appearance in the top right
            {/*
              Keep the trailing icon pair (+ period) as one unbreakable
              unit so the line doesn't wrap mid-cluster — without this,
              the two icons split across lines and the period orphans
              onto its own line. The leading non-breaking space pins
              the cluster to the last word of the sentence too.
            */}
            <span className={styles.appearanceIconCluster}>
              {" "}
              <button
                type="button"
                className={styles.appearanceIconButton}
                onClick={onOpenGraphics}
                aria-label={`Open graphics settings (detected: ${graphics.preset})`}
              >
                <Settings size={14} />
              </button>{" "}
              <button
                type="button"
                className={styles.appearanceIconButton}
                onClick={toggleMode}
                aria-label={`Switch to ${
                  resolvedMode === "dark" ? "light" : "dark"
                } mode`}
              >
                {resolvedMode === "dark" ? (
                  <Sun size={14} />
                ) : (
                  <Moon size={14} />
                )}
              </button>
              .
            </span>
          </p>

          {/*
            Input-mode toggle. Defaults to the matchMedia-detected
            mode; once the user clicks here, their choice sticks
            for the session and the matchMedia listener stops
            overriding it. Same segmented-pill visual vocabulary
            as the landing view's view/sort toggles.
          */}
          <div
            className={styles.modeToggle}
            role="tablist"
            aria-label="Input mode for instructions"
          >
            <button
              type="button"
              role="tab"
              aria-selected={inputMode === "mouse"}
              className={`${styles.modeButton} ${
                inputMode === "mouse"
                  ? styles.modeButtonActive
                  : styles.modeButtonIdle
              }`}
              onClick={() => selectMode("mouse")}
            >
              <Mouse size={14} />
              Mouse
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={inputMode === "touch"}
              className={`${styles.modeButton} ${
                inputMode === "touch"
                  ? styles.modeButtonActive
                  : styles.modeButtonIdle
              }`}
              onClick={() => selectMode("touch")}
            >
              <Smartphone size={14} />
              Touch
            </button>
          </div>

          <p className={styles.howTo}>How to explore:</p>

          <ul className={styles.steps}>
            {steps.map((step, i) => (
              <li key={i}>
                <span className={styles.stepIcon}>{step.icon}</span>
                <div>{step.body}</div>
              </li>
            ))}
          </ul>

          <p className={styles.note}>
            Some projects host backends on Render&apos;s free tier and may need
            a moment to wake on the first request.
          </p>

          <div className={styles.footerRow}>
            <a
              href="https://github.com/moefingers/unlv-museum"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.sourceLink}
              tabIndex={open ? 0 : -1}
            >
              <OctocatIcon size={14} />
              Source
            </a>
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
      </div>
    </>
  );
}
