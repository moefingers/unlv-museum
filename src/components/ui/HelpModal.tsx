"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  HelpCircle,
  MousePointer2,
  Eye,
  MousePointerClick,
  Compass,
  Mouse,
  Hand,
  Move,
  Pointer,
  Smartphone,
} from "lucide-react";
import styles from "./HelpModal.module.css";

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

// Placeholder copy — structure is what matters here. Replace each
// `body` string with the final wording once the touch interaction
// model is settled (see polyhedron globe touch design).
const STEPS_MOUSE: Step[] = [
  {
    icon: <MousePointer2 size={18} />,
    body: (
      <>
        <strong>Click and drag</strong> the globe to rotate it.
      </>
    ),
  },
  {
    icon: <Eye size={18} />,
    body: (
      <>
        <strong>Hover</strong> on a point to preview a project.
      </>
    ),
  },
  {
    icon: <MousePointerClick size={18} />,
    body: (
      <>
        <strong>Click</strong> a title to open the preview.
      </>
    ),
  },
  {
    icon: <Compass size={18} />,
    body: (
      <>
        <strong>Navigate</strong> between projects from inside.
      </>
    ),
  },
];

const STEPS_TOUCH: Step[] = [
  {
    icon: <Hand size={18} />,
    body: (
      <>
        <strong>One finger</strong> to drag the globe.
      </>
    ),
  },
  {
    icon: <Move size={18} />,
    body: (
      <>
        <strong>Two fingers</strong> to scroll the page.
      </>
    ),
  },
  {
    icon: <Pointer size={18} />,
    body: (
      <>
        <strong>Tap</strong> a project to open it.
      </>
    ),
  },
  {
    icon: <Compass size={18} />,
    body: (
      <>
        <strong>Navigate</strong> between projects from inside.
      </>
    ),
  },
];

const TOUCH_QUERY = "(pointer: coarse) and (hover: none)";

function detectInputMode(): InputMode {
  if (typeof window === "undefined") return "mouse";
  return window.matchMedia(TOUCH_QUERY).matches ? "touch" : "mouse";
}

export function HelpModal({
  open,
  onOpen,
  onClose,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
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
            Projects from UNLV&apos;s software development course, rebuilt
            across three tiers: original, enhanced, and reimagined.
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

          <p className={styles.howTo}>A few things to try:</p>

          <ul className={styles.steps}>
            {steps.map((step, i) => (
              <li key={i}>
                <span className={styles.stepIcon}>{step.icon}</span>
                <div>{step.body}</div>
              </li>
            ))}
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
