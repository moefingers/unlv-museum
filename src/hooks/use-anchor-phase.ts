"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fromUnitVectors, type Quat } from "@/lib/quaternion";
import { useLatestRef } from "./use-latest-ref";

/*
 * Anchor phase state machine — the multi-phase sequence that opens
 * a project's hex card from a vertex and closes it back down.
 *
 * Extracted from PolyhedronGlobe.tsx (Audit 2f). The behavior is
 * unchanged; the move is purely structural to make the state
 * machine isolated, testable, and shorter to read.
 *
 * Phase sequence (forward, idle→open):
 *   idle → swinging → coneRising → widening → open
 * Phase sequence (reverse, open→idle):
 *   open → collapsing → coneFalling → unswinging → idle
 * Cross-anchor handoff (click a different vertex while open):
 *   coneFalling jumps back to swinging with the new target instead
 *   of unswinging. The next-target rides on collapsing /
 *   coneFalling as `nextVi`.
 *
 * The state machine OWNS:
 *   - the `phase` state (and `phaseRef` mirror for rAF reads)
 *   - the swing animation state (`anchorAnim` ref) and post-swing
 *     world-space axis (`anchoredAxis` ref)
 *   - the phase-advance timer (`phaseTimer`)
 *   - all phase derivations (anchoredVertexIdx, hexOpen, cone
 *     progress + transition durations)
 *   - handleDotClick + releaseAnchor + ESC dismiss
 *
 * The state machine READS from outside (via the config arg):
 *   - meshVertices (for the target-quaternion compute)
 *   - latestQ (current rotation, used as the swing's fromQ)
 *   - autoRotateAxis (writable; swapped between world-Y and the
 *     anchored axis as phase changes)
 *   - hoverCycleStartRef (resettable; cleared on swing-in)
 *   - clearEngagement (called to dismiss any in-flight label
 *     engagement on the swinging-toward vertex)
 *
 * The state machine is READ FROM by:
 *   - the rAF rotation loop in PolyhedronGlobe, which uses
 *     `anchorAnim` for the slerp, writes `anchoredAxis` +
 *     `autoRotateAxis` on slerp completion, and calls
 *     `notifySwingComplete()` to advance from swinging→coneRising.
 *   - the JSX, which uses `anchoredVertexIdx`, `hexOpen`, and the
 *     cone progress + transition values to drive visuals.
 */

// ─── Timing constants ────────────────────────────────────────────
//
// Exported because the rAF loop and a few JSX style hooks in
// PolyhedronGlobe still reference them by name. Kept here (not in
// PolyhedronGlobe) because they describe the state machine's
// pacing — they belong with the machine.

export const ANCHOR_SWING_MS = 900;
export const CONE_RISE_MS = 280;
export const WIDENING_MS = 600; // hex cascade + cone widen, run together
export const CONE_WIDEN_FRACTION = 0.4; // cone reaches full width at 40% of the widening phase
export const COLLAPSING_MS = 480; // hex close + cone narrow (run together)
export const CONE_FALL_MS = 220;
export const UNSWING_MS = 900;

// ─── Anchor-target screen position ────────────────────────────────
//
// Where on the screen the anchored vertex should land (NDC coords:
// (-1,-1) bottom-left, (+1,+1) top-right). Used by computeAnchorTarget
// to reverse the projection back into a target quaternion.

const AXIAL_TILT_DEG = 18;
const ANCHOR_NDC_X = -0.13;
const ANCHOR_NDC_Y = 0.55;

// ─── Types ───────────────────────────────────────────────────────

export type AnchorPhase =
  | { kind: "idle" }
  | { kind: "swinging"; vi: number }
  | { kind: "coneRising"; vi: number }
  | { kind: "widening"; vi: number }
  | { kind: "open"; vi: number }
  | { kind: "collapsing"; vi: number; nextVi: number | null }
  | { kind: "coneFalling"; vi: number; nextVi: number | null }
  | { kind: "unswinging" };

export type AnchorAnim = {
  startedAt: number;
  fromQ: Quat;
  toQ: Quat;
};

export type Vec3 = { x: number; y: number; z: number };

export interface UseAnchorPhaseConfig {
  /** Mesh vertices keyed by vertex index. The hook reads `[vi]` only. */
  meshVertices: readonly Vec3[];
  /** Current rotation; the swing's fromQ is `latestQRef.current` at kickoff. */
  latestQRef: React.RefObject<Quat>;
  /**
   * The rAF loop's auto-rotate axis. The hook writes this on phase
   * transitions:
   *   - idle → world-Y `{0,1,0}`
   *   - on swing settle (via rAF + the exposed `notifySwingComplete`) →
   *     the anchored axis (handled in the loop itself, not here).
   *
   * Named with the `Ref` suffix per React 19's immutability lint —
   * the hook mutates `.current`, which the linter only permits on
   * args ending in `Ref` (signals "this is a ref by convention").
   */
  autoRotateAxisRef: React.RefObject<Vec3>;
  /**
   * Hover-cycle bookkeeping. The hook clears this when a swing kicks
   * off so the previous cycle doesn't keep modulating the sphere
   * speed mid-anchor.
   */
  hoverCycleStartRef: React.RefObject<{ cycleStart: number | null }>;
  /**
   * Clear any in-flight label engagement on the given vertex (so a
   * card opens against a clean backdrop). Called as the state
   * machine kicks off swing-in toward `vi`, and on cross-anchor
   * handoff when the new vi takes over.
   */
  clearEngagementFor: (vi: number) => void;
  /**
   * NDC-X target for the anchored vertex. Override the default
   * (-0.13) per viewport width — narrow screens want the vertex
   * closer to center horizontally so the hex card has equal room
   * on both sides. Optional; defaults to ANCHOR_NDC_X when
   * unspecified.
   */
  anchorNdcX?: number;
}

export interface AnchorPhaseAPI {
  // State + accessor
  phase: AnchorPhase;
  phaseRef: React.RefObject<AnchorPhase>;
  /** Anchored vi for the CURRENT phase, or null in idle/unswinging. */
  getAnchoredVi: () => number | null;

  // Refs the rAF loop reads/writes
  /** Current slerp target; null when no swing is in flight. */
  anchorAnim: React.RefObject<AnchorAnim | null>;
  /** Post-settle world-space axis of the anchored vertex (rAF writes). */
  anchoredAxis: React.RefObject<Vec3 | null>;

  // rAF → state-machine signal
  /** Call when the swing's slerp settles. Advances to coneRising. */
  notifySwingComplete: () => void;

  // Derived values for JSX
  anchoredVertexIdx: number | null;
  hexOpen: boolean;
  coneHeightProgress: number;
  coneWidthProgress: number;
  coneHeightTransitionMs: number;
  coneWidthTransitionMs: number;

  // Action handlers
  handleDotClick: (vi: number) => void;
  releaseAnchor: () => void;
}

/**
 * Returns the anchor state machine wrapped into a single API object.
 *
 * Hook ordering note: this hook calls useState/useEffect/useRef
 * internally; place it AFTER all engagement/hover state has been
 * declared in the consumer so the `clearEngagementFor` callback
 * passed in has stable identity. (PolyhedronGlobe handles this by
 * declaring this hook in section 3 of its anchor-state block.)
 */
export function useAnchorPhase(config: UseAnchorPhaseConfig): AnchorPhaseAPI {
  const {
    meshVertices,
    latestQRef,
    autoRotateAxisRef,
    hoverCycleStartRef,
    clearEngagementFor,
    anchorNdcX,
  } = config;

  const [phase, setPhase] = useState<AnchorPhase>({ kind: "idle" });
  const phaseRef = useLatestRef(phase);

  const getAnchoredVi = useCallback((): number | null => {
    const p = phaseRef.current;
    if (
      p.kind === "swinging" ||
      p.kind === "coneRising" ||
      p.kind === "widening" ||
      p.kind === "open" ||
      p.kind === "collapsing" ||
      p.kind === "coneFalling"
    ) {
      return p.vi;
    }
    return null;
  }, [phaseRef]);

  // ─── Swing animation state ───────────────────────────────────
  const anchorAnim = useRef<AnchorAnim | null>(null);
  const anchoredAxis = useRef<Vec3 | null>(null);

  // ─── Phase timer ─────────────────────────────────────────────
  const phaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPhaseTimer = useCallback(() => {
    if (phaseTimer.current) {
      clearTimeout(phaseTimer.current);
      phaseTimer.current = null;
    }
  }, []);
  const scheduleNextPhase = useCallback(
    (
      ms: number,
      next: AnchorPhase,
      /**
       * Optional side-effect to fire alongside the phase transition.
       * Used by cross-anchor handoff to clear in-flight label
       * engagement on the incoming vi. Co-scheduling in the same
       * timer callback means both state updates batch into one
       * React commit.
       */
      onTransition?: () => void,
    ) => {
      clearPhaseTimer();
      phaseTimer.current = setTimeout(() => {
        phaseTimer.current = null;
        if (onTransition) onTransition();
        setPhase(next);
      }, ms);
    },
    [clearPhaseTimer],
  );

  // ─── Phase-driven side effects ───────────────────────────────
  //
  // Each phase transition triggers a timer to advance to the next
  // phase (and ref-side-effects at the points where they matter).
  // Visual changes are derived directly from `phase` in JSX — no
  // extra state needed.
  useEffect(() => {
    if (phase.kind === "idle") {
      clearPhaseTimer();
      anchoredAxis.current = null;
      autoRotateAxisRef.current = { x: 0, y: 1, z: 0 };
      return;
    }
    if (phase.kind === "swinging") {
      // Kick off the rotation slerp. The rAF loop owns the slerp
      // and signals back via notifySwingComplete(); we advance to
      // coneRising in that callback.
      const v = meshVertices[phase.vi];
      if (!v) return;
      const { toQ } = computeAnchorTarget(v, anchorNdcX ?? ANCHOR_NDC_X);
      anchorAnim.current = {
        startedAt: performance.now(),
        fromQ: latestQRef.current,
        toQ,
      };
      hoverCycleStartRef.current.cycleStart = null;
      anchoredAxis.current = null;
      return;
    }
    if (phase.kind === "coneRising") {
      scheduleNextPhase(CONE_RISE_MS, { kind: "widening", vi: phase.vi });
      return;
    }
    if (phase.kind === "widening") {
      scheduleNextPhase(WIDENING_MS, { kind: "open", vi: phase.vi });
      return;
    }
    if (phase.kind === "open") {
      clearPhaseTimer();
      return;
    }
    if (phase.kind === "collapsing") {
      scheduleNextPhase(COLLAPSING_MS, {
        kind: "coneFalling",
        vi: phase.vi,
        nextVi: phase.nextVi,
      });
      return;
    }
    if (phase.kind === "coneFalling") {
      const nextVi = phase.nextVi;
      const after: AnchorPhase =
        nextVi !== null
          ? { kind: "swinging", vi: nextVi }
          : { kind: "unswinging" };
      if (nextVi !== null) {
        scheduleNextPhase(CONE_FALL_MS, after, () => {
          clearEngagementFor(nextVi);
        });
      } else {
        scheduleNextPhase(CONE_FALL_MS, after);
      }
      return;
    }
    if (phase.kind === "unswinging") {
      scheduleNextPhase(UNSWING_MS, { kind: "idle" });
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Re-aim the anchored vertex when anchorNdcX changes (typically
  // because the viewport resized across a breakpoint that shifts
  // the anchor target horizontally — narrow viewports want ndcX≈0,
  // wide viewports want ndcX=-0.13). Without this effect, an
  // already-open anchor stays at its original X target until the
  // user closes and re-opens it. With it, the rotation re-slerps
  // to the new target so the hex card visually re-centers in place.
  //
  // The re-aim ONLY fires when:
  //   - a vertex is anchored (open / coneRising / widening / swinging)
  //   - anchorNdcX has changed since last render
  //
  // We don't restart the phase machine; just hand the rAF loop a
  // new slerp target. `latestQRef.current` is the swing's fromQ
  // because that's where the visible rotation IS right now —
  // whether the swing was mid-flight or settled, latestQ is the
  // ground truth.
  useEffect(() => {
    const p = phaseRef.current;
    const anchoredVi =
      p.kind === "swinging" ||
      p.kind === "coneRising" ||
      p.kind === "widening" ||
      p.kind === "open"
        ? p.vi
        : null;
    if (anchoredVi === null) return;
    const v = meshVertices[anchoredVi];
    if (!v) return;
    const { toQ } = computeAnchorTarget(v, anchorNdcX ?? ANCHOR_NDC_X);
    anchorAnim.current = {
      startedAt: performance.now(),
      fromQ: latestQRef.current,
      toQ,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorNdcX, meshVertices]);

  // ─── rAF → state-machine signal ──────────────────────────────
  //
  // When the rAF loop's swing slerp settles, it calls
  // notifySwingComplete(). The functional setter monotonically
  // increments a tick, which fires the watcher effect below to
  // advance phase from swinging→coneRising. The bump-and-watch
  // pattern bridges from imperative rAF writes into React data flow.
  const [swingCompletionTick, setSwingCompletionTick] = useState(0);
  const notifySwingComplete = useCallback(() => {
    setSwingCompletionTick((n) => n + 1);
  }, []);
  useEffect(() => {
    const p = phaseRef.current;
    if (p.kind === "swinging") {
      setPhase({ kind: "coneRising", vi: p.vi });
    }
    // unswinging also completes via the rAF loop's slerp finish but
    // we don't advance here — the unswinging phase's own timer
    // (UNSWING_MS) handles the idle transition. (The unswinging
    // slerp here is no-op — we don't slerp on unswing, we just let
    // existing rotation continue while zoom retracts.)
  }, [swingCompletionTick, phaseRef]);

  // ─── Derived values ──────────────────────────────────────────
  const anchoredVertexIdx: number | null =
    phase.kind === "idle" || phase.kind === "unswinging"
      ? null
      : phase.kind === "swinging" ||
          phase.kind === "coneRising" ||
          phase.kind === "widening" ||
          phase.kind === "open" ||
          phase.kind === "collapsing" ||
          phase.kind === "coneFalling"
        ? phase.vi
        : null;

  const hexOpen = phase.kind === "widening" || phase.kind === "open";

  let coneHeightProgress = 0;
  let coneWidthProgress = 0;
  let coneHeightTransitionMs = CONE_RISE_MS;
  let coneWidthTransitionMs = WIDENING_MS * CONE_WIDEN_FRACTION;
  if (
    phase.kind === "coneRising" ||
    phase.kind === "widening" ||
    phase.kind === "open" ||
    phase.kind === "collapsing"
  ) {
    coneHeightProgress = 1;
  }
  if (phase.kind === "widening" || phase.kind === "open") {
    coneWidthProgress = 1;
  }
  if (phase.kind === "coneFalling") {
    coneHeightProgress = 0;
    coneHeightTransitionMs = CONE_FALL_MS;
  }
  if (phase.kind === "collapsing") {
    coneWidthProgress = 0;
    coneWidthTransitionMs = COLLAPSING_MS;
  }

  // ─── Action handlers ─────────────────────────────────────────
  //
  // Click on an assigned vertex. Behavior depends on current phase:
  //   - idle/unswinging: kick off open sequence (phase = swinging)
  //   - swinging/coneRising/widening/open on SAME vertex: no-op
  //   - swinging/coneRising/widening/open on DIFFERENT vertex:
  //     start close cascade with nextVi set
  //   - collapsing/coneFalling on DIFFERENT vertex: update nextVi
  //     in-place (don't interrupt motion — letting the current
  //     phase complete keeps motion legible)
  const handleDotClick = useCallback(
    (vi: number) => {
      const v = meshVertices[vi];
      if (!v) return;
      const p = phaseRef.current;
      // Same-vertex no-op for all "in this vertex's flow" phases.
      if (
        (p.kind === "swinging" ||
          p.kind === "coneRising" ||
          p.kind === "widening" ||
          p.kind === "open") &&
        p.vi === vi
      ) {
        return;
      }
      // From idle (or unswinging tail end), straight to swinging.
      // Also dismiss any in-flight label engagement on the new vi —
      // the card is about to supplant the label.
      if (p.kind === "idle" || p.kind === "unswinging") {
        clearEngagementFor(vi);
        setPhase({ kind: "swinging", vi });
        return;
      }
      // From any active open-direction phase to a DIFFERENT vertex,
      // start the close cascade with nextVi set.
      if (
        p.kind === "swinging" ||
        p.kind === "coneRising" ||
        p.kind === "widening" ||
        p.kind === "open"
      ) {
        setPhase({ kind: "collapsing", vi: p.vi, nextVi: vi });
        return;
      }
      // From a close-direction phase, update nextVi in place.
      if (p.kind === "collapsing") {
        setPhase({ ...p, nextVi: vi });
        return;
      }
      if (p.kind === "coneFalling") {
        setPhase({ ...p, nextVi: vi });
        return;
      }
    },
    [meshVertices, phaseRef, clearEngagementFor],
  );

  // Triggers the close cascade with nextVi = null (full dismiss).
  // From idle/unswinging: no-op. From any active phase: collapse
  // the visuals, run the reverse choreography, then unswing.
  const releaseAnchor = useCallback(() => {
    const p = phaseRef.current;
    if (p.kind === "idle" || p.kind === "unswinging") return;
    if (
      p.kind === "swinging" ||
      p.kind === "coneRising" ||
      p.kind === "widening" ||
      p.kind === "open"
    ) {
      setPhase({ kind: "collapsing", vi: p.vi, nextVi: null });
      return;
    }
    if (p.kind === "collapsing" || p.kind === "coneFalling") {
      // Already closing — just clear any pending handoff so we
      // end at idle.
      setPhase({ ...p, nextVi: null });
      return;
    }
  }, [phaseRef]);

  // ─── Cleanup + ESC ───────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearPhaseTimer();
    };
  }, [clearPhaseTimer]);

  useEffect(() => {
    if (anchoredVertexIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") releaseAnchor();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anchoredVertexIdx, releaseAnchor]);

  return {
    phase,
    phaseRef,
    getAnchoredVi,
    anchorAnim,
    anchoredAxis,
    notifySwingComplete,
    anchoredVertexIdx,
    hexOpen,
    coneHeightProgress,
    coneWidthProgress,
    coneHeightTransitionMs,
    coneWidthTransitionMs,
    handleDotClick,
    releaseAnchor,
  };
}

/*
 * Compute the target quaternion that puts mesh vertex `v` at the
 * ANCHOR_NDC_(X,Y) screen position. Decomposes the projection
 * pipeline backward:
 *   1. Pick a target post-rotation point on the unit sphere that
 *      projects (under axial tilt + perspective + scale) to the
 *      desired NDC. Approximation: ignore perspective scaling
 *      (~5% effect at the museum's cameraZ), reverse only the
 *      axial tilt, snap to the unit sphere via z = sqrt(1−x²−y²).
 *   2. The rotation that takes `v` to that target point IS the
 *      target quaternion (via fromUnitVectors).
 *
 * Pure utility — no React, no hook state. Kept here because it's
 * exclusive to the swing-in machinery.
 */
function computeAnchorTarget(
  vMesh: Vec3,
  ndcX: number,
): { toQ: Quat; axis: Vec3 } {
  // Reverse the axial Z tilt. Forward tilt is (x,y) → (x·cosZ −
  // y·sinZ, x·sinZ + y·cosZ); inverse is (x·cosZ + y·sinZ,
  // −x·sinZ + y·cosZ).
  const angZ = (AXIAL_TILT_DEG * Math.PI) / 180;
  const cZ = Math.cos(angZ);
  const sZ = Math.sin(angZ);
  // Screen NDC y is FLIPPED relative to math y (sy = −y · …). So a
  // target screen NDC of +0.35 ("upper" on screen) maps to math y =
  // +0.35 (a positive y above the equator after axial tilt). We pass
  // math-y directly here. ndcX is passed in so callers can shift the
  // anchor's horizontal position based on viewport (narrow screens
  // want the anchor near x=0 for symmetric layout around the hex
  // card; wide screens want the museum's traditional -0.13).
  const ndcY = ANCHOR_NDC_Y;
  const px = ndcX * cZ + ndcY * sZ;
  const py = -ndcX * sZ + ndcY * cZ;
  const r2 = px * px + py * py;
  const pz = r2 >= 1 ? 0 : Math.sqrt(1 - r2);
  const tx = px;
  const ty = py;
  const tz = pz;
  const toQ = fromUnitVectors(vMesh.x, vMesh.y, vMesh.z, tx, ty, tz);
  return { toQ, axis: { x: tx, y: ty, z: tz } };
}
