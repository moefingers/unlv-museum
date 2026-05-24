"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  fromAxisAngle,
  multiply as quatMultiply,
  type Quat,
} from "@/lib/quaternion";

/*
 * Drag-momentum state machine for the museum sphere.
 *
 * Owns the per-gesture drag bookkeeping AND the post-release
 * exponential-decay rotation that "throws" the sphere when the user
 * flicks-and-releases. PolyhedronGlobe's main rAF loop calls `tick()`
 * each frame; if momentum is still decaying the hook applies the
 * incremental rotation via `applyQ` and returns true, telling the
 * caller to skip auto-rotate this frame.
 *
 * Split out of PolyhedronGlobe.tsx during the 2026-05 cleanup pass
 * to isolate one of four state machines that share its central rAF
 * loop (others: anchor-phase, auto-rotate, hover-cycle). Drag was
 * the cleanest seam because it's:
 *   - sequentially gated (rAF: anchor swing else drag-momentum else
 *     auto-rotate), so the "is this frame mine?" predicate is local
 *   - fully self-contained mathematically (only needs latestQ +
 *     applyQ from outside; the velocity → amplitude → decay pipeline
 *     all lives here)
 *   - read by exactly one place outside this hook: the click-vs-drag
 *     guard in handleSurfaceClick, via `didDrag()`
 *
 * Lifecycle (matches the existing pointer-handler call sites in
 * PolyhedronGlobe):
 *
 *   pointerdown  → begin()
 *   pointermove  → feed({ dx, dy, yawRate, pitchRate })
 *   pointerup    → end(now, lastMoveAt)  (when all pointers lifted)
 *                  + clearVelocity()     (when one of several lifted)
 *
 * The hook does NOT bind to DOM events itself, and does NOT track
 * per-move bookkeeping like "prior centroid" or "last move
 * timestamp" — PolyhedronGlobe's pointer handlers do multi-pointer
 * centroid math, touch-hover-mode detection, and pinch alongside
 * drag, and they already own those refs. The hook just provides the
 * drag-physics primitives those handlers compose with: EMA velocity
 * smoothing, post-release amplitude sealing, and exponential-decay
 * momentum during the rAF settle.
 */

// Exponential decay time constant (ms). Larger = momentum lingers
// longer. 600ms was the value baked into the original Euler model.
const TIME_CONSTANT = 600;
// Angular-velocity threshold (rad/sec) below which momentum is
// considered settled and the rAF tick stops contributing. Matched to
// the original Euler model's 0.5 deg/sec equivalent in radians.
const VELOCITY_THRESHOLD = 0.01;
// Pointer-move distance threshold (in px, per-event delta) above
// which we flip didDrag = true. Used by the click-vs-drag guard so a
// drag-then-release isn't treated as a click.
const DRAG_INTENT_PX = 3;

interface DragGesture {
  /** True between pointerdown and pointerup. */
  dragging: boolean;
  /**
   * Set true once any pointermove distance exceeds DRAG_INTENT_PX.
   * Read in the click-vs-drag guard to suppress accidental dismisses
   * after a drag-release. Reset to false on each begin().
   */
  didDrag: boolean;
  /**
   * EMA-smoothed angular velocities during the active drag (rad/sec).
   * Sealed into amplitude{Yaw,Pitch} when the gesture ends.
   */
  angularVelocityYaw: number;
  angularVelocityPitch: number;
  /** performance.now() at release; the rAF tick uses (now - releaseTime)
   *  to compute exponential decay. */
  releaseTime: number;
  /**
   * Initial momentum amplitudes (rad/sec) sealed at release. Decay
   * each rAF tick until both fall under VELOCITY_THRESHOLD.
   */
  amplitudeYaw: number;
  amplitudePitch: number;
}

function makeInitialGesture(): DragGesture {
  return {
    dragging: false,
    didDrag: false,
    angularVelocityYaw: 0,
    angularVelocityPitch: 0,
    releaseTime: 0,
    amplitudeYaw: 0,
    amplitudePitch: 0,
  };
}

export interface UseDragMomentumConfig {
  /** Live mutable reference to the current rotation quaternion. */
  latestQRef: React.RefObject<Quat>;
  /** Setter that commits a new quaternion (writes both ref and React state). */
  applyQ: (next: Quat) => void;
}

export interface DragMomentumApi {
  /** True between begin() and end(). */
  isDragging(): boolean;
  /**
   * True if any feed() during the current (or most-recent) gesture
   * saw movement above DRAG_INTENT_PX. Reset on each begin().
   */
  didDrag(): boolean;
  /**
   * Mark the start of a new gesture. Clears prior momentum +
   * velocity + didDrag so the next release starts fresh. The caller
   * (which owns per-move bookkeeping like prior-centroid +
   * last-move-timestamp) initializes those alongside this call.
   */
  begin(): void;
  /**
   * Feed a pointermove. The hook updates its EMA-smoothed velocity
   * from yawRate/pitchRate (already computed by the caller from
   * pointer-delta × dragRate) and sets didDrag if movement (dx, dy
   * since the prior move) exceeded DRAG_INTENT_PX in either axis.
   *
   * `yawRate` and `pitchRate` are instantaneous angular velocities
   * (rad/sec) for the current move — the caller computes them as
   * `(1000 * angle) / (1 + dtMs)` to keep dimensional consistency.
   */
  feed(opts: {
    dx: number;
    dy: number;
    yawRate: number;
    pitchRate: number;
  }): void;
  /**
   * End the gesture (all pointers lifted). Seals the current EMA
   * velocities as the post-release amplitude, sets releaseTime,
   * marks dragging=false.
   *
   * `lastMoveAt` is the caller-tracked timestamp of the most recent
   * pointermove. If (now - lastMoveAt) > 50ms — the user held still
   * before lifting — we suppress the amplitude (no fling on a
   * stationary release). The hook doesn't track lastMoveAt itself
   * because the caller already does for its own dt math.
   */
  end(now: number, lastMoveAt: number): void;
  /**
   * Clear the EMA velocity mid-gesture without ending it. Used when
   * the pointer configuration changes (e.g. one of two fingers
   * lifted) — the previous frame's velocity doesn't predict the next
   * frame's, so the EMA must reset.
   */
  clearVelocity(): void;
  /**
   * Cancel any in-flight post-release momentum. Used at anchor
   * transitions where lingering momentum would fight the swing.
   */
  cancelMomentum(): void;
  /**
   * rAF tick. If post-release momentum is still above threshold,
   * applies the incremental decayed rotation via `applyQ` and
   * returns true. Returns false if the gesture is active (caller
   * applies live drag-rotation itself), or if momentum has settled
   * (caller should fall through to auto-rotate).
   */
  tick(now: number, dtSec: number): boolean;
}

export function useDragMomentum(config: UseDragMomentumConfig): DragMomentumApi {
  const { latestQRef, applyQ } = config;

  const gestureRef = useRef<DragGesture>(makeInitialGesture());

  // Mirror the latest applyQ into a ref so the returned API methods
  // capture a stable closure but always call the current setter.
  // applyQ is already useCallback-stable in PolyhedronGlobe, but a
  // ref makes the hook robust to callers that DON'T memoize it.
  const applyQRef = useRef(applyQ);
  useEffect(() => {
    applyQRef.current = applyQ;
  }, [applyQ]);

  const isDragging = useCallback(() => gestureRef.current.dragging, []);
  const didDrag = useCallback(() => gestureRef.current.didDrag, []);

  const begin = useCallback(() => {
    const g = gestureRef.current;
    g.dragging = true;
    g.didDrag = false;
    g.angularVelocityYaw = 0;
    g.angularVelocityPitch = 0;
    g.amplitudeYaw = 0;
    g.amplitudePitch = 0;
  }, []);

  const feed = useCallback<DragMomentumApi["feed"]>((opts) => {
    const g = gestureRef.current;
    if (!g.dragging) return;
    if (
      Math.abs(opts.dx) > DRAG_INTENT_PX ||
      Math.abs(opts.dy) > DRAG_INTENT_PX
    ) {
      g.didDrag = true;
    }
    // EMA blend the new instantaneous rate with the running average.
    // 0.8 fresh / 0.2 prior was the tuning that survived from the
    // Euler-era model; preserve it exactly to keep the feel.
    g.angularVelocityYaw = 0.8 * opts.yawRate + 0.2 * g.angularVelocityYaw;
    g.angularVelocityPitch =
      0.8 * opts.pitchRate + 0.2 * g.angularVelocityPitch;
  }, []);

  const end = useCallback((now: number, lastMoveAt: number) => {
    const g = gestureRef.current;
    if (!g.dragging) return;
    g.dragging = false;
    // Stationary-finger guard: if the user held still for >50ms
    // before lifting, the EMA velocity is stale and shouldn't
    // produce a fling. Clear it so amplitude seals to zero.
    if (now - lastMoveAt > 50) {
      g.angularVelocityYaw = 0;
      g.angularVelocityPitch = 0;
    }
    g.amplitudeYaw = g.angularVelocityYaw;
    g.amplitudePitch = g.angularVelocityPitch;
    g.releaseTime = now;
  }, []);

  const clearVelocity = useCallback(() => {
    const g = gestureRef.current;
    g.angularVelocityYaw = 0;
    g.angularVelocityPitch = 0;
  }, []);

  const cancelMomentum = useCallback(() => {
    const g = gestureRef.current;
    g.amplitudeYaw = 0;
    g.amplitudePitch = 0;
  }, []);

  const tick = useCallback(
    (now: number, dtSec: number): boolean => {
      const g = gestureRef.current;
      // Active gesture: caller drives live rotation directly (we
      // don't double-apply). Return false so caller skips
      // auto-rotate but doesn't expect us to have contributed.
      if (g.dragging) return false;
      const speed = Math.abs(g.amplitudeYaw) + Math.abs(g.amplitudePitch);
      if (speed <= VELOCITY_THRESHOLD) return false;

      const elapsed = now - g.releaseTime;
      const decay = Math.exp(-elapsed / TIME_CONSTANT);
      const yawRate = g.amplitudeYaw * decay;
      const pitchRate = g.amplitudePitch * decay;

      const yawAngle = yawRate * dtSec;
      const pitchAngle = pitchRate * dtSec;

      // Compose yaw (world Y) then pitch (world X) onto the current
      // quaternion. Order matches the prior Euler model: pitch
      // multiplied last in the chain so it ends up on the left.
      let next = latestQRef.current;
      if (yawAngle !== 0) {
        next = quatMultiply(fromAxisAngle(0, 1, 0, yawAngle), next);
      }
      if (pitchAngle !== 0) {
        next = quatMultiply(fromAxisAngle(1, 0, 0, pitchAngle), next);
      }
      applyQRef.current(next);

      // Settle: when the decayed rates fall below the per-frame
      // threshold (slightly coarser than the speed-sum threshold above
      // to avoid one final low-amplitude frame), zero the amplitude so
      // the next tick short-circuits.
      if (Math.abs(yawRate) < 0.01 && Math.abs(pitchRate) < 0.01) {
        g.amplitudeYaw = 0;
        g.amplitudePitch = 0;
      }

      return true;
    },
    [latestQRef],
  );

  return {
    isDragging,
    didDrag,
    begin,
    feed,
    end,
    clearVelocity,
    cancelMomentum,
    tick,
  };
}
