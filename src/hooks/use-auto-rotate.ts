"use client";

import { useCallback } from "react";
import {
  fromAxisAngle,
  multiply as quatMultiply,
  type Quat,
} from "@/lib/quaternion";
import type { AnchorPhase } from "@/hooks/use-anchor-phase";

/*
 * Per-frame auto-rotate driver for the museum sphere.
 *
 * The sphere spins slowly on its own when idle. The rotation:
 *   - is gated by the anchor phase: only the `idle`, `unswinging`,
 *     and `open` phases auto-rotate. In-flight phases
 *     (coneRising/widening/collapsing/coneFalling) pause rotation
 *     so the cone + hex choreography plays against a still backdrop.
 *   - spins around `autoRotateAxisRef.current` — world-Y while
 *     unanchored, around the anchored vertex while open.
 *   - is modulated by a hover-cycle speed multiplier when idle: a
 *     hover over a vertex triggers a decelerate → hold → resume
 *     ramp via the consumer's computeSpeedMul callback.
 *   - runs at ANCHOR_AUTO_SPEED_MUL × full speed while anchored
 *     (the anchored point feels still while the surrounding geometry
 *     drifts past).
 *
 * Extracted from PolyhedronGlobe's rAF loop in the 2026-05 cleanup
 * pass. Composes with useAnchorPhase.tickSwing + useDragMomentum.tick
 * as one of three rotation drivers, priority-ordered:
 *   1. anchor swing slerp (claims the frame entirely)
 *   2. drag momentum decay (claims the frame if active)
 *   3. auto-rotate (the default; this hook)
 */

// Auto-rotation angular speed in radians/second. Equivalent to the
// prior Euler AUTO_SPEED of 0.08 deg/frame at 60fps (~4.8 deg/sec).
const AUTO_ANGULAR_SPEED = (0.08 / 16) * 1000 * (Math.PI / 180);

export interface UseAutoRotateConfig {
  /** Live anchor phase. Auto-rotation is gated on its `kind`. */
  phaseRef: React.RefObject<AnchorPhase>;
  /** Current rotation; the driver multiplies a delta onto it. */
  latestQRef: React.RefObject<Quat>;
  /** Axis to rotate around (world-Y idle, anchored-vertex world-pos
   *  when anchored). The anchor hook writes this on swing-settle. */
  autoRotateAxisRef: React.RefObject<{ x: number; y: number; z: number }>;
  /** Wrapped quaternion setter (writes both ref and React state). */
  applyQ: (next: Quat) => void;
  /**
   * Speed multiplier in [0, 1] driving the hover-cycle ramp:
   * 1 = full speed, 0 = halted, intermediate = decelerating/resuming.
   * The consumer computes this from its hover-cycle bookkeeping
   * (decel → hold → resume) and the current timestamp.
   *
   * The hook calls this only when phase is not `open` (anchored
   * rotation runs at a steady reduced rate without hover modulation).
   */
  computeSpeedMul: (now: number) => number;
  /**
   * Called when the speed multiplier has ramped back to 1 (i.e. the
   * hover cycle finished). The consumer uses this signal to clear
   * its cycleStart bookkeeping so the next hover restarts a fresh
   * cycle instead of resuming a stale one. Only fired when phase
   * is not `open`.
   */
  notifyHoverCycleSettled?: () => void;
  /**
   * Auto-rotation speed multiplier while anchored. Typically <1 so
   * the sphere feels almost-still around the anchored vertex while
   * the surrounding geometry drifts. Defaults to 0.6.
   */
  anchorSpeedMul?: number;
}

export interface AutoRotateApi {
  /**
   * rAF tick. Applies a frame of auto-rotation when:
   *   - the anchor phase allows it (idle / unswinging / open), AND
   *   - the speed multiplier is non-zero.
   * Returns true if a rotation was applied this frame (informational —
   * the caller doesn't need to gate on it since this is the lowest-
   * priority rotation driver).
   */
  tick(now: number, dtSec: number): boolean;
}

export function useAutoRotate(config: UseAutoRotateConfig): AutoRotateApi {
  const {
    phaseRef,
    latestQRef,
    autoRotateAxisRef,
    applyQ,
    computeSpeedMul,
    notifyHoverCycleSettled,
    anchorSpeedMul = 0.6,
  } = config;

  const tick = useCallback(
    (now: number, dtSec: number): boolean => {
      const p = phaseRef.current.kind;
      const rotationActive =
        p === "idle" || p === "unswinging" || p === "open";
      if (!rotationActive) return false;

      // Anchored rotation: steady reduced rate, no hover modulation.
      // Idle/unswinging: full rate × hover-cycle multiplier.
      const speedMul = p === "open" ? 1 : computeSpeedMul(now);
      if (p !== "open" && speedMul >= 1) {
        // Hover cycle has fully ramped back to 1 — let the consumer
        // know so it can clear its cycleStart bookkeeping.
        notifyHoverCycleSettled?.();
      }
      if (speedMul <= 0) return false;

      const phaseMul = p === "open" ? anchorSpeedMul : 1;
      const angle = AUTO_ANGULAR_SPEED * speedMul * phaseMul * dtSec;
      const axis = autoRotateAxisRef.current;
      const delta = fromAxisAngle(axis.x, axis.y, axis.z, angle);
      applyQ(quatMultiply(delta, latestQRef.current));
      return true;
    },
    [
      anchorSpeedMul,
      applyQ,
      autoRotateAxisRef,
      computeSpeedMul,
      latestQRef,
      notifyHoverCycleSettled,
      phaseRef,
    ],
  );

  return { tick };
}
