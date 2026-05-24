"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./VertexHover.module.css";

/**
 * VertexHover — the per-vertex glow + typed-title element on the
 * museum sphere.
 *
 * FULLY CONTROLLED: the parent (PolyhedronGlobe) owns the
 * engagement state. This component just exposes hit-target
 * callbacks and renders the visual (glow + typed title +
 * dismissal animation) based on whether `engaged` is true or
 * false. The component does NOT decide whether engagement should
 * stick — it just reflects it.
 *
 * Why parent-controlled (vs. self-managing like the sandbox dots
 * in svg-experiments): in the museum the sphere rotates and dots
 * move under the cursor. "Engagement" of a project is sticky —
 * once you've hovered a dot, that project is engaged until you
 * either move to a different dot or off the sphere entirely. The
 * browser's mouseleave on the current dot (caused by rotation
 * drifting the hit-target away from a motionless cursor) is
 * GEOMETRY drift, not user intent — it shouldn't end engagement.
 * The parent observes both cursor behavior AND geometry-driven
 * motion to decide.
 *
 * Animation lifecycle on engaged state change:
 *   engaged false → true: glow expands, title types in
 *   engaged true → false: blink-flash (80ms), then title untypes
 *     at 3× speed and glow shrinks back
 */
export interface VertexHoverProps {
  title: string;
  x: number;
  y: number;
  /** Controlled engagement. Parent flips this to drive the animation. */
  engaged: boolean;
  /** Mouse landed on the hit target — fired raw, parent decides what to do. */
  onHitTargetEnter?: () => void;
  /** Mouse left the hit target. */
  onHitTargetLeave?: () => void;
  /** Click on the hit target — used by the parent to trigger anchor-to-vertex. */
  onHitTargetClick?: () => void;

  // ─── Visual tuning ───────────────────────────────────────
  typeDuration?: number;
  contractSpeedRatio?: number;
  idleGlowRadius?: number;
  expandedGlowRadius?: number;
  hitTargetRadius?: number;
  titleOffsetY?: number;
  textShadow?: string;
  titleFontSize?: number;
  titleFontFamily?: string;
  showCaret?: boolean;
  flickerStyle?: "none" | "subtle" | "medium" | "glitchy";
  /**
   * Override the SVG radial-gradient ID used for the glow fill.
   * Defaults to `hover-dot-glow` (the generic blue-tinted gradient
   * defined in PolyhedronGlobe's <defs>; the ID name is a legacy
   * from the removed standalone HoverDot sandbox component). The
   * museum passes per-category gradient IDs (e.g.
   * `hover-dot-glow-games`) so each vertex glows in its project's
   * category color.
   */
  glowGradientId?: string;
  /**
   * Project category for the vertex, if any. When set, applies
   * `data-glass-category={category}` to the rendered group — the
   * CSS [data-glass-category=...] overrides cascade through the
   * typed title's text fill + text-shadow tokens, so hovering a
   * vertex previews the project's identity in the same color
   * vocabulary the anchored hex card uses.
   *
   * Omitted (e.g. unassigned vertices) → no override, neutral tint.
   */
  category?: string;
}

/**
 * Default text shadow for the typed-title. Tracks --glass-text-shadow
 * (which is mode-aware) plus two additional softer halos for the
 * deeper background fade — those use --glow-mid which is already
 * the right tint per mode. Per-instance overrides via the
 * `textShadow` prop still work as before.
 */
const DEFAULT_TEXT_SHADOW = [
  "var(--glass-text-shadow)",
  "0 0 24px var(--glow-mid)",
  "0 0 48px var(--glow-far)",
].join(", ");

export function VertexHover({
  title,
  x,
  y,
  engaged,
  onHitTargetEnter,
  onHitTargetLeave,
  onHitTargetClick,
  typeDuration = 800,
  contractSpeedRatio = 3,
  idleGlowRadius = 8,
  expandedGlowRadius = 10,
  hitTargetRadius = 24,
  titleOffsetY = 28,
  textShadow = DEFAULT_TEXT_SHADOW,
  titleFontSize = 17,
  titleFontFamily,
  showCaret = false,
  flickerStyle = "none",
  glowGradientId = "hover-dot-glow",
  category,
}: VertexHoverProps) {
  // typedChars animates 0 → title.length when engaged flips true,
  // back to 0 (faster) when engaged flips false.
  const [typedChars, setTypedChars] = useState(0);
  // blinking flashes for 80ms at the start of an untype (dismissal).
  // CSS animation handles the brightness pulse.
  const [blinking, setBlinking] = useState(false);

  // Track previous engaged to detect transitions (for dismissal flash).
  const prevEngagedRef = useRef(engaged);
  useEffect(() => {
    const prev = prevEngagedRef.current;
    if (prev === true && engaged === false) {
      // Dismissal transition — fire the 80ms flash before untype.
      setBlinking(true);
      const t = setTimeout(() => setBlinking(false), 80);
      return () => clearTimeout(t);
    }
    prevEngagedRef.current = engaged;
  }, [engaged]);

  // Type/untype animation. Linear interpolation over typeDuration for
  // engage, typeDuration/contractSpeedRatio for dismiss.
  useEffect(() => {
    let frame: number;
    const startedAt = performance.now();
    const startCharCount = typedChars;
    const targetCharCount = engaged ? title.length : 0;
    if (startCharCount === targetCharCount) return;
    const effectiveDuration = engaged
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
  }, [engaged, title.length, typeDuration]);

  // Glow radius interpolates with typing progress.
  const typeProgress = title.length === 0 ? 0 : typedChars / title.length;
  const currentGlowRadius =
    idleGlowRadius + (expandedGlowRadius - idleGlowRadius) * typeProgress;

  // Flicker only while engaged AND typing has begun.
  const flickerClass =
    !blinking && engaged && typedChars > 0 && flickerStyle !== "none"
      ? (styles as Record<string, string>)[`flicker-${flickerStyle}`]
      : "";

  return (
    <g data-glass-category={category}>
      <circle
        cx={x}
        cy={y}
        r={currentGlowRadius}
        fill={`url(#${glowGradientId})`}
        className={blinking ? styles.blinking : ""}
        pointerEvents="none"
      />
      <circle
        cx={x}
        cy={y}
        r={2.2}
        fill="var(--glow-pinpoint)"
        pointerEvents="none"
      />
      <circle
        cx={x}
        cy={y}
        r={hitTargetRadius}
        fill="transparent"
        pointerEvents="all"
        onMouseEnter={onHitTargetEnter}
        onMouseLeave={onHitTargetLeave}
        // Pointerdown intentionally bubbles up to the surface so a
        // press+drag starting on top of a vertex still initiates a
        // sphere drag. The didDrag classifier (3px per-move
        // threshold) suppresses the click when the gesture turned
        // out to be a drag, so a brief jiggle-then-release still
        // opens the card.
        //
        // onClick still stops propagation so a tap-to-open doesn't
        // ALSO fire the surface's background-dismiss handler when
        // an anchor is currently open.
        onClick={(e) => {
          e.stopPropagation();
          onHitTargetClick?.();
        }}
        style={{ cursor: "pointer" }}
      />
      <text
        x={x}
        y={y + titleOffsetY}
        textAnchor="middle"
        dominantBaseline="hanging"
        className={[
          styles.title,
          blinking ? styles.titleBlinking : "",
          flickerClass,
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
        {showCaret && engaged && <tspan className={styles.caret}>|</tspan>}
      </text>
    </g>
  );
}
