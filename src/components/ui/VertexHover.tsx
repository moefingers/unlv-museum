"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./HoverDot.module.css";

/**
 * VertexHover — the museum-side counterpart to HoverDot.
 *
 * Difference from HoverDot: this component is FULLY CONTROLLED.
 * The parent (PolyhedronGlobe) owns the engagement state. The dot
 * itself just exposes hit-target callbacks and renders the visual
 * (glow + typed title + dismissal animation) based on whether
 * `engaged` is true or false.
 *
 * Why split: in the museum the sphere rotates and dots move under
 * the cursor. The "engagement" of a project is a sticky concept —
 * once you've hovered a dot, that project is engaged until you
 * either move to a different dot or away from all dots entirely.
 * The browser's mouseleave on the current dot (caused by rotation
 * drifting the hit target away) shouldn't end engagement. So the
 * engagement state lives in the parent, which observes BOTH the
 * cursor's behavior AND the geometry-driven motion to decide.
 *
 * HoverDot is the sandbox version where dots stand still and the
 * browser's hover signal is reliable. VertexHover is the museum
 * version where it isn't.
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
}

const DEFAULT_TEXT_SHADOW = [
  "0 0 4px rgba(180, 200, 255, 0.95)",
  "0 0 10px rgba(140, 180, 255, 0.7)",
  "0 0 24px rgba(100, 160, 240, 0.45)",
  "0 0 48px rgba(80, 140, 220, 0.25)",
].join(", ");

export function VertexHover({
  title,
  x,
  y,
  engaged,
  onHitTargetEnter,
  onHitTargetLeave,
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
    <g>
      <circle
        cx={x}
        cy={y}
        r={currentGlowRadius}
        fill="url(#hover-dot-glow)"
        className={blinking ? styles.blinking : ""}
        pointerEvents="none"
      />
      <circle
        cx={x}
        cy={y}
        r={2.2}
        fill="rgba(255, 255, 255, 0.95)"
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
