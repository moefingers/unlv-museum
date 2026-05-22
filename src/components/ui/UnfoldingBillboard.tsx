"use client";

import { useEffect, useRef, useState } from "react";
import {
  isSpringSettled,
  makeSpring,
  stepSpring,
  type Spring,
  type SpringConfig,
} from "@/lib/spring";
import {
  FINAL_STAGE,
  STAGE_LABELS,
  unfoldStageVertices,
} from "@/lib/polygon-vertices";
import styles from "./UnfoldingBillboard.module.css";

/**
 * Animates a dot → hexagon unfold via cascaded spring-bounce per stage.
 *
 * Stages (each is a regular n-gon):
 *   0  dot       (n=1, all 6 topology vertices collapsed at centroid)
 *   1  line      (n=2)
 *   2  triangle  (n=3)
 *   3  square    (n=4)
 *   4  pentagon  (n=5)
 *   5  hexagon   (n=6, final)
 *
 * All shapes share a uniform topology of 6 vertices. At each stage,
 * the target positions are the regular n-gon's perimeter (with mid-
 * edge synthesized slots for n < 6). The vertex positions are driven
 * by per-vertex (x, y) springs that lerp toward the stage's target.
 *
 * The cascade: stage transitions fire on a stagger — stage k starts
 * `stageDelay * k` ms after open. Each transition is a target-update
 * on the springs; the spring physics handle the actual motion (with
 * overshoot proportional to the damping ratio).
 *
 * `open` is the externally-controlled state:
 *   - false → all springs target stage 0 (collapse back to dot)
 *   - true  → springs cascade through stages 0..5 over (stageDelay × 5) ms
 *
 * The rAF loop runs whenever any spring isn't settled, and stops
 * once everything is at rest.
 */
export interface UnfoldingBillboardProps {
  /** External open/close trigger. */
  open: boolean;
  /** Size of the final hexagon (radius in pixels). */
  radius?: number;
  /** Spring config — controls bounce. */
  spring?: SpringConfig;
  /** Milliseconds between consecutive stage kickoffs. */
  stageDelay?: number;
  /** Rotation in degrees applied to all stages (cosmetic). */
  rotation?: number;
  /** Optional inner content (rendered inside the final hexagon). */
  children?: React.ReactNode;
  /** Inline style for the host element (e.g. positioning). */
  style?: React.CSSProperties;
  /** Show a stage-progress label for debugging. */
  showDebug?: boolean;
}

const TOPOLOGY_COUNT = 6;
const FRAME_TIMESTEP_CAP = 0.05;

export function UnfoldingBillboard({
  open,
  radius = 100,
  spring = { stiffness: 280, damping: 16 },
  stageDelay = 80,
  rotation = 0,
  children,
  style,
  showDebug = false,
}: UnfoldingBillboardProps) {
  // Stage state — which stage the cascade is currently *targeting*.
  // On open, this cascades 0 → 1 → 2 → ... → FINAL_STAGE staggered by
  // stageDelay ms. On close, it cascades back to 0 in reverse.
  //
  // Each stage update fires a target-position update on the springs;
  // the springs handle the motion with bounce.
  const [stage, setStage] = useState(open ? FINAL_STAGE : 0);

  // Per-vertex (x, y) springs. Initialized at stage 0 (all at origin).
  const xSprings = useRef<Spring[]>(
    Array.from({ length: TOPOLOGY_COUNT }, () => makeSpring(spring, 0)),
  );
  const ySprings = useRef<Spring[]>(
    Array.from({ length: TOPOLOGY_COUNT }, () => makeSpring(spring, 0)),
  );

  // [x, y] arrays for render. Updated on every animation tick.
  // Initialized to TOPOLOGY_COUNT origin points (matches the springs'
  // initial position 0). Static initializer — don't read the ref
  // during render (React 19 lint complains).
  const [positions, setPositions] = useState<{ x: number; y: number }[]>(() =>
    Array.from({ length: TOPOLOGY_COUNT }, () => ({ x: 0, y: 0 })),
  );

  // Drive the stage cascade. On open, schedule timeouts to advance
  // the stage one at a time. On close, do the same in reverse.
  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    if (open) {
      // Cascade forward: 0 → 1 → 2 → ... → FINAL_STAGE. Kickoff
      // happens immediately for stage 1; later stages staggered.
      for (let s = 1; s <= FINAL_STAGE; s++) {
        timeouts.push(setTimeout(() => setStage(s), stageDelay * (s - 1)));
      }
    } else {
      // Cascade back: stage → stage - 1 → ... → 0. Faster than open:
      // half the stageDelay to feel snappier on exit.
      const reverseDelay = Math.max(stageDelay * 0.5, 30);
      // Snapshot the current stage at the moment open becomes false;
      // walk it backward.
      const startStage = stage;
      for (let i = 1; i <= startStage; i++) {
        const targetStage = startStage - i;
        timeouts.push(
          setTimeout(() => setStage(targetStage), reverseDelay * i),
        );
      }
    }
    return () => {
      for (const t of timeouts) clearTimeout(t);
    };
    // We intentionally don't depend on `stage` — when open toggles,
    // we schedule from the current stage. Stage changes alone
    // shouldn't re-fire the schedule.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stageDelay]);

  // When `stage` changes, update each spring's TARGET to the new
  // stage's vertex positions. The springs interpolate from their
  // current values.
  useEffect(() => {
    const targets = unfoldStageVertices(
      stage,
      TOPOLOGY_COUNT,
      radius,
      rotation,
    );
    for (let i = 0; i < TOPOLOGY_COUNT; i++) {
      xSprings.current[i]!.target = targets[i]!.x;
      ySprings.current[i]!.target = targets[i]!.y;
    }
  }, [stage, radius, rotation]);

  // rAF loop: step every spring each frame, update positions state.
  // The loop runs whenever any spring is unsettled; once all are at
  // rest, we cancel the loop until the next state change kicks it
  // back on.
  useEffect(() => {
    let last = performance.now();
    let frame: number;

    function tick(now: number) {
      const dt = Math.min((now - last) / 1000, FRAME_TIMESTEP_CAP);
      last = now;
      const next: { x: number; y: number }[] = [];
      let anyMoving = false;
      for (let i = 0; i < TOPOLOGY_COUNT; i++) {
        const xs = xSprings.current[i]!;
        const ys = ySprings.current[i]!;
        stepSpring(xs, dt);
        stepSpring(ys, dt);
        next.push({ x: xs.position, y: ys.position });
        if (!isSpringSettled(xs) || !isSpringSettled(ys)) anyMoving = true;
      }
      setPositions(next);
      if (anyMoving) {
        frame = requestAnimationFrame(tick);
      }
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [stage]);

  // Build the SVG path string for the current positions.
  const pathStr =
    positions
      .map(
        (p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`,
      )
      .join(" ") + " Z";

  // Viewbox sized for the final hexagon with breathing room.
  const viewbox = radius * 2.4;

  return (
    <div className={styles.host} style={style}>
      <svg
        viewBox={`${-viewbox / 2} ${-viewbox / 2} ${viewbox} ${viewbox}`}
        className={styles.svg}
        style={{ width: viewbox, height: viewbox }}
      >
        <defs>
          {/* Glass inner-glow gradient — bright at the edge, fades to
              fully-transparent toward the center so the shape's border
              picks up light without occluding interior content.
              Uses --glass-stroke at the rim so the inner-glow tracks
              whatever the glass treatment is for the current mode. */}
          <radialGradient id="ub-inner-glow" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="80%" stopColor="transparent" />
            <stop
              offset="100%"
              stopColor="var(--glass-stroke)"
              stopOpacity="0.3"
            />
          </radialGradient>
        </defs>

        {/* The morphing shape itself. Glass body (fill) + rim (stroke);
            both track --glass-* tokens so they invert cleanly between
            modes. */}
        <path
          d={pathStr}
          className={styles.shape}
          fill="var(--glass-fill)"
          stroke="var(--glass-stroke)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* Inner-glow overlay — only shows once we're past stage 0. */}
        {stage > 0 && (
          <path d={pathStr} fill="url(#ub-inner-glow)" pointerEvents="none" />
        )}

        {/* Vertex pinpoints — small dots at each topology vertex.
            Visible during the unfold cascade, fade out once the
            shape settles (the rim stroke covers them). */}
        {positions.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={2.5}
            fill="var(--glass-stroke)"
          />
        ))}
      </svg>

      {/* Content overlay — rendered as HTML on top of the SVG, fading
          in once the shape is past stage 3 (square) so content
          doesn't appear before there's room for it. */}
      <div
        className={styles.contentLayer}
        data-visible={stage >= 4}
        style={{ width: radius * 1.4, height: radius * 1.4 }}
      >
        {children}
      </div>

      {showDebug && (
        <div className={styles.debug}>
          stage {stage} / {FINAL_STAGE} ({STAGE_LABELS[stage]})
        </div>
      )}
    </div>
  );
}
