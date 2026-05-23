"use client";

import { useEffect, useRef, useState } from "react";

/*
 * Two-line chevron that folds through a vertical-line midpoint
 * when toggled. Pattern adapted from svg-experiments/ShapeMorph:
 * `current` tracks the resting state; `target` is set when the
 * caller's `open` prop changes, kicking off an rAF interpolation;
 * once progress reaches 1 the target collapses into current and
 * the animation rests.
 *
 * Why that pattern instead of "animate every time `open` changes":
 * the parent often defaults `open` to one value during SSR/initial
 * render, then flips it once a matchMedia or localStorage probe
 * resolves in a useEffect. Treating EVERY change as an animation
 * trigger means the chevron flickers through a fold on first paint.
 * The current/target distinction lets the chevron snap to the
 * initial `open` value silently (mount-time sync) and only animate
 * when `open` changes AFTER that.
 *
 * Geometric model (Y never changes, only X):
 *
 *   Each line has ONE endpoint anchored at the TOP and ONE
 *   endpoint anchored at the BOTTOM of the viewBox. The
 *   animation walks the X of each endpoint between three
 *   positions: left, middle, right. y stays put.
 *
 *   Phase 1 (the "fold in"):
 *     The outer-x endpoints (line A's bottom, line B's bottom for
 *     a chevron-up start) slide INWARD toward x=center. The other
 *     endpoint of each line — the one already at x=center, y=top —
 *     stays put. At t=0.5 all four endpoints are on the center
 *     vertical line; the two strokes overlap and read as `|`.
 *
 *   Phase 2 (the "fold out"):
 *     The top endpoint of each line, which sat at x=center the
 *     whole time, slides OUTWARD. Line A's top goes to x=left,
 *     line B's top goes to x=right. The bottom endpoints stay at
 *     x=center. End: `v` (or `^` if we were animating the other
 *     direction).
 *
 *   Net effect: ends of one chevron pinch together to form a
 *   vertical line, then the opposite vertex of the original
 *   chevron expands outward to form an inverted chevron.
 */

const ANIM_DURATION_MS = 360;

// SVG viewBox + geometry constants. Tuned for a 16x16 chevron.
const CX = 8;
const CY = 8;
const HALF_SPREAD = 4;
const HALF_RISE = 2;

interface ChevronPoints {
  leftX1: number;
  leftY1: number;
  leftX2: number;
  leftY2: number;
  rightX1: number;
  rightY1: number;
  rightX2: number;
  rightY2: number;
}

/*
 * Compute the chevron's stroke coordinates for a given progress t
 * and target orientation. `targetUp` = true → animating toward `^`.
 *
 * At t=0 the chevron is in the "from" orientation (inverse of target),
 * at t=1 it's in the target orientation, at t=0.5 it's the vertical-
 * line midpoint.
 */
function computePoints(t: number, targetUp: boolean): ChevronPoints {
  const clamped = Math.max(0, Math.min(1, t));
  // Cubic ease-in-out: deliberate at midpoint, smooth at endpoints.
  const eased =
    clamped < 0.5
      ? 4 * clamped * clamped * clamped
      : 1 - Math.pow(-2 * clamped + 2, 3) / 2;

  // The math below was written assuming we're animating `^` → `v`
  // (i.e. targetUp=false). If targetUp=true, invert progress so the
  // SAME path plays in reverse — t=0 produces `v`, t=1 produces `^`.
  const e = targetUp ? 1 - eased : eased;

  // Two phases:
  //   Phase 1 (e: 0→0.5): bottom endpoints slide INWARD (x → 0).
  //                        Top endpoints stay at x=0.
  //   Phase 2 (e: 0.5→1): top endpoints slide OUTWARD (x → ±HALF_SPREAD).
  //                        Bottom endpoints stay at x=0.
  let topOffsetMag: number;
  let bottomOffsetMag: number;
  if (e <= 0.5) {
    const phaseT = e * 2;
    topOffsetMag = 0;
    bottomOffsetMag = HALF_SPREAD * (1 - phaseT);
  } else {
    const phaseT = (e - 0.5) * 2;
    topOffsetMag = HALF_SPREAD * phaseT;
    bottomOffsetMag = 0;
  }

  const topY = CY - HALF_RISE;
  const bottomY = CY + HALF_RISE;

  return {
    leftX1: CX - topOffsetMag,
    leftY1: topY,
    leftX2: CX - bottomOffsetMag,
    leftY2: bottomY,
    rightX1: CX + topOffsetMag,
    rightY1: topY,
    rightX2: CX + bottomOffsetMag,
    rightY2: bottomY,
  };
}

export interface FoldingChevronProps {
  /**
   * Target orientation. true = points up `^`, false = points down `v`.
   * When this changes, kicks off a fold-through animation; once
   * settled the chevron rests in the new orientation.
   *
   * If the value changes during the animation (rapid double-click,
   * etc.), the current animation is canceled and a fresh one starts
   * from the current visual state toward the new target.
   */
  open: boolean;
  /** Pixel size of the rendered SVG. Default 16. */
  size?: number;
  /** Stroke width in viewBox units. Default 2 (matches lucide). */
  strokeWidth?: number;
}

export function FoldingChevron({
  open,
  size = 16,
  strokeWidth = 2,
}: FoldingChevronProps) {
  // Hydration: the chevron's <line> coords depend on `open`, which
  // often differs between SSR (safe default) and client (parent's
  // matchMedia/localStorage probe via useState lazy init). Each
  // <line> element gets suppressHydrationWarning below so React
  // patches the values up to match the client render without
  // logging a per-attribute warning. The earlier mount-gate
  // (render-null-then-flip-on-effect) was a workaround that
  // triggered React 19's set-state-in-effect lint AND introduced
  // a one-paint pop-in — suppress is the correct tool here.

  // Animation state machine, adapted from svg-experiments/ShapeMorph:
  //   `current` = the orientation we're resting in.
  //   `target`  = the orientation we're animating TOWARD; null at rest.
  //   `progress` = 0..1 within the current animation.
  //
  // We use the controlled-component pattern where `open` is the
  // source of truth; internal state mirrors it with animation.
  // When `open` differs from our "effective" orientation (the one
  // we're either resting at or animating toward), kick off a new
  // animation. The effect below is the React-idiomatic way to
  // bridge an external prop change into an internal state machine.
  const [current, setCurrent] = useState(open);
  const [target, setTarget] = useState<boolean | null>(null);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  // Reconcile external `open` with internal state. The effective
  // orientation is `target ?? current` — what we'd land on if no
  // new input arrived. If `open` differs from that, we have a new
  // animation to kick off. The settle path (rAF loop) updates
  // `current` and clears `target` synchronously, so this effect
  // doesn't re-fire on its own internal updates — it only fires
  // when `open` actually changes from outside.
  //
  // The eslint-disable on set-state-in-effect is intentional: this
  // is the canonical "synchronize internal state with a changing
  // prop" pattern that effects exist for. Computing it during
  // render would require mid-render ref mutation (forbidden by
  // React 19) or a useReducer rewrite that doesn't simplify the
  // code.
  useEffect(() => {
    const effective = target ?? current;
    if (open === effective) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTarget(open);
    setProgress(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // rAF loop: drives `progress` from 0 → 1 over ANIM_DURATION_MS
  // whenever `target` is non-null. When progress reaches 1, commit
  // target into current and reset.
  useEffect(() => {
    if (target === null) return;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const t = Math.min(1, elapsed / ANIM_DURATION_MS);
      setProgress(t);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setCurrent(target);
        setTarget(null);
        setProgress(0);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  // What's actually displayed: if animating, interpolate from
  // current to target with `progress`. If at rest, just current.
  // computePoints' `targetUp` tells it which orientation to produce
  // at t=1; at rest we pretend we just finished animating toward
  // `current`, so points are computed at t=1 with targetUp=current.
  const orientation = target !== null ? target : current;
  const t = target !== null ? progress : 1;
  const points = computePoints(t, orientation);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line
        x1={points.leftX1}
        y1={points.leftY1}
        x2={points.leftX2}
        y2={points.leftY2}
        suppressHydrationWarning
      />
      <line
        x1={points.rightX1}
        y1={points.rightY1}
        x2={points.rightX2}
        y2={points.rightY2}
        suppressHydrationWarning
      />
    </svg>
  );
}
