"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./HoverDot.module.css";

/**
 * A glowing dot that types its title on hover.
 *
 * - On hover-enter (mouseenter on the invisible hit-target circle), the
 *   title types in character-by-character. The dot's glow grows softly
 *   underneath the text as it types.
 * - As long as the browser considers the cursor "still hovering" (no
 *   leave event), the title stays open — even if the user is motionless
 *   for minutes. The browser's hover signal is the engagement contract.
 * - On hover-leave, a grace-period timer fires (default 800ms). During
 *   grace the title is still visible. If the user re-enters before grace
 *   expires, the timer is cancelled and the title stays.
 * - When grace expires, the title performs a quick "blink" (brightness
 *   flash) then rapidly contracts (un-types 3× faster than typed in)
 *   and the glow shrinks back to its idle size.
 *
 * The component is fully self-contained — drop one anywhere with `x`,
 * `y`, and `title` props. For the museum integration, multiple dots
 * sharing a global "only one hovered at a time" rule live in a wrapper
 * that coordinates them; this component handles its own state.
 *
 * Typing speed: total duration is FIXED at `typeDuration` ms regardless
 * of title length — short titles type at a slower per-char rate,
 * long titles faster. Keeps the hover-to-readable time consistent.
 */
export interface HoverDotProps {
  title: string;
  /** Center position in stage coords (px). */
  x: number;
  /** Center position in stage coords (px). */
  y: number;
  /** Total duration of the typing animation. */
  typeDuration?: number;
  /** Untype is 3× faster (this multiplier applied to typeDuration). */
  contractSpeedRatio?: number;
  /** Grace period after mouse-leave before contraction starts. */
  graceMs?: number;
  /** Idle dot glow radius (px). */
  idleGlowRadius?: number;
  /** Expanded dot glow radius when fully typed (px). */
  expandedGlowRadius?: number;
  /** Hit-target radius — invisible larger circle that catches hover. */
  hitTargetRadius?: number;
  /** Vertical offset of the title from the dot center (px, positive = below). */
  titleOffsetY?: number;
  /**
   * Text-shadow stack for the title. Multiple shadows give a layered
   * halo — tighter shadows for sharp definition, wider shadows for
   * atmospheric glow.
   */
  textShadow?: string;
  /**
   * Delay before typing begins after hover-enter (ms). The dot stays
   * idle during this delay — no glow expansion, no characters. After
   * the delay, typing begins as normal. Use to give the interaction a
   * "settle, then introduce" rhythm.
   */
  startDelay?: number;
  /** Font size for the typed title (px). Default 13. */
  titleFontSize?: number;
  /**
   * Render a blinking caret (|) at the end of the typed text while
   * active. Reinforces the "is being typed" metaphor.
   */
  showCaret?: boolean;
  /** Font family for the title. Default uses Geist sans. */
  titleFontFamily?: string;
  /**
   * Hologram-style flicker on the title while it's open. The flicker
   * loop only runs while typing has begun and active is true.
   *   - "none"    no flicker
   *   - "subtle"  gentle brightness oscillation, no jitter
   *   - "medium"  brightness + text-shadow blur oscillation
   *   - "glitchy" wider brightness range + occasional drop ("blip")
   */
  flickerStyle?: "none" | "subtle" | "medium" | "glitchy";
  /**
   * Callback fired when the dot's `active` state transitions. Used by
   * parent components to track which dot is currently engaged — e.g.,
   * the museum's PolyhedronGlobe pauses sphere rotation while any dot
   * reports active=true. Fires on both true→false and false→true.
   */
  onActiveChange?: (active: boolean) => void;
  /**
   * External force-dismiss trigger. When this flips to true while the
   * dot is active, the dot immediately runs its dismissal sequence
   * (flash + untype) without waiting for the hover-grace timer.
   *
   * Used by parent components to enforce "only one dot active at a
   * time" — when a new dot's mouseenter fires, the parent sets
   * forceClose=true on every OTHER dot. This handles the case where
   * the browser doesn't fire mouseleave on the previous dot because
   * its hit target was already moved by sphere rotation.
   */
  forceClose?: boolean;
}

const DEFAULT_TEXT_SHADOW = [
  "0 0 4px rgba(180, 200, 255, 0.95)",
  "0 0 10px rgba(140, 180, 255, 0.7)",
  "0 0 24px rgba(100, 160, 240, 0.45)",
  "0 0 48px rgba(80, 140, 220, 0.25)",
].join(", ");

export function HoverDot({
  title,
  x,
  y,
  typeDuration = 400,
  contractSpeedRatio = 3,
  graceMs = 800,
  idleGlowRadius = 6,
  expandedGlowRadius = 14,
  hitTargetRadius = 24,
  titleOffsetY = 28,
  textShadow = DEFAULT_TEXT_SHADOW,
  startDelay = 0,
  titleFontSize = 13,
  showCaret = false,
  titleFontFamily,
  flickerStyle = "none",
  onActiveChange,
  forceClose = false,
}: HoverDotProps) {
  // active = browser currently considers cursor hovering (between
  // onMouseEnter and onMouseLeave). Sphere pauses + typing kicks off
  // when active flips true (after startDelay if any).
  const [active, setActive] = useState(false);
  // Notify parent on active changes — used by PolyhedronGlobe (museum
  // integration) to pause auto-rotation while any dot is engaged.
  useEffect(() => {
    onActiveChange?.(active);
    // We only want to notify on the active value changing; if the
    // callback identity changes the parent re-renders us with a new
    // identity but the active value didn't change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  // typedChars = 0..title.length. Animates between 0 and full length
  // via the rAF loop below.
  const [typedChars, setTypedChars] = useState(0);
  // blinking = brief brightness flash applied at the moment grace
  // expires and contraction begins. Pure CSS class toggle.
  const [blinking, setBlinking] = useState(false);

  // Grace timer fires after onMouseLeave — until it fires, the title
  // stays open. Cancelled by a re-entry.
  const graceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Start-delay timer fires startDelay ms after onMouseEnter to begin
  // typing. Cancelled if the user leaves before it fires.
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = () => {
    if (graceTimer.current) {
      clearTimeout(graceTimer.current);
      graceTimer.current = null;
    }
    // If startDelay is zero, kick off immediately. Otherwise wait — the
    // dot stays idle until the delay elapses, then we flip active.
    if (startDelay <= 0) {
      setActive(true);
    } else if (!startTimer.current) {
      startTimer.current = setTimeout(() => {
        setActive(true);
        startTimer.current = null;
      }, startDelay);
    }
  };
  const handleLeave = () => {
    // If we're still in the start-delay window (typing hasn't begun),
    // just cancel the start timer — no need for a grace period because
    // there's nothing visible to dismiss yet.
    if (startTimer.current) {
      clearTimeout(startTimer.current);
      startTimer.current = null;
      return;
    }
    if (graceTimer.current) clearTimeout(graceTimer.current);
    graceTimer.current = setTimeout(() => {
      runDismissalSequence();
      graceTimer.current = null;
    }, graceMs);
  };

  // The blink-then-untype dismissal sequence, used by both the grace
  // timer (normal mouseleave) and by forceClose (parent-triggered
  // dismiss when a different dot was engaged).
  const runDismissalSequence = () => {
    // Cancel any pending grace timer first — we're dismissing now,
    // not waiting for grace.
    if (graceTimer.current) {
      clearTimeout(graceTimer.current);
      graceTimer.current = null;
    }
    setBlinking(true);
    setTimeout(() => {
      setBlinking(false);
      setActive(false);
    }, 80);
  };

  // Force-close trigger from the parent. When forceClose flips to true
  // while the dot is currently engaged, run the dismissal immediately.
  // This handles the "user moused to another dot but our mouseleave
  // never fired" case — the parent knows because the other dot's
  // mouseenter fired, and tells us to clean up.
  useEffect(() => {
    if (forceClose && active) {
      runDismissalSequence();
    }
    // We only want to act on forceClose changes; active is a downstream
    // state we already manage internally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceClose]);

  // rAF-driven typing animation.
  //
  // We don't use a spring here — the typed-character count needs to
  // land on integer values (you can't type half a character). Linear
  // interpolation over the fixed duration is the right tool.
  useEffect(() => {
    let frame: number;
    const startedAt = performance.now();
    const startCharCount = typedChars;
    const targetCharCount = active ? title.length : 0;
    if (startCharCount === targetCharCount) return; // already there
    // Untype runs faster than typing.
    const effectiveDuration = active
      ? typeDuration
      : typeDuration / contractSpeedRatio;

    function tick(now: number) {
      const t = Math.min(1, (now - startedAt) / effectiveDuration);
      const next = Math.round(
        startCharCount + (targetCharCount - startCharCount) * t,
      );
      setTypedChars(next);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      }
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, title.length, typeDuration]);

  // Clean up dangling timers on unmount.
  useEffect(() => {
    return () => {
      if (graceTimer.current) clearTimeout(graceTimer.current);
      if (startTimer.current) clearTimeout(startTimer.current);
    };
  }, []);

  // Glow radius interpolates linearly with typing progress.
  const typeProgress = title.length === 0 ? 0 : typedChars / title.length;
  const currentGlowRadius =
    idleGlowRadius + (expandedGlowRadius - idleGlowRadius) * typeProgress;

  // Inline glow style — radius animates per render. Using transform:
  // scale would be cheaper but the radial gradient's apparent size
  // would scale uniformly, which clips the falloff at the edges. We
  // re-emit the SVG circle radius each frame instead.
  return (
    <g>
      {/* Visible glow — radial gradient circle, soft falloff. Radius
          scales with typing progress so the dot "breathes outward" as
          the title types. */}
      <circle
        cx={x}
        cy={y}
        r={currentGlowRadius}
        fill="url(#hover-dot-glow)"
        className={blinking ? styles.blinking : ""}
        pointerEvents="none"
      />

      {/* Crisp center pinpoint — always at idle radius so the dot has
          a stable visual anchor regardless of how big the glow gets. */}
      <circle
        cx={x}
        cy={y}
        r={2.2}
        fill="rgba(255, 255, 255, 0.95)"
        pointerEvents="none"
      />

      {/* Invisible hit target — much larger than the visible dot so
          tiny cursors can find it forgivingly. */}
      <circle
        cx={x}
        cy={y}
        r={hitTargetRadius}
        fill="transparent"
        pointerEvents="all"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        style={{ cursor: "pointer" }}
      />

      {/* Typed title — SVG <text> with optional blinking caret + flicker.
          Class composition: base .title, plus .titleBlinking for the
          grace-expire flash, plus a flicker-* class for the hologram
          flicker (only while active + typing has begun + flickerStyle
          isn't "none"). The blinking flash takes precedence — when
          present, the flicker class isn't applied. */}
      <text
        x={x}
        y={y + titleOffsetY}
        textAnchor="middle"
        dominantBaseline="hanging"
        className={[
          styles.title,
          blinking ? styles.titleBlinking : "",
          !blinking && active && typedChars > 0 && flickerStyle !== "none"
            ? (styles as Record<string, string>)[`flicker-${flickerStyle}`]
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          textShadow,
          fontSize: titleFontSize,
          ...(titleFontFamily ? { fontFamily: titleFontFamily } : {}),
        }}
        pointerEvents="none"
      >
        <tspan>{title.slice(0, typedChars)}</tspan>
        {showCaret && active && <tspan className={styles.caret}>|</tspan>}
      </text>
    </g>
  );
}
