"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { geodesic, type Mesh } from "@/lib/polyhedra";
import { type Project } from "@/lib/projects";
import {
  fromAxisAngle,
  fromUnitVectors,
  multiply as quatMultiply,
  slerp as quatSlerp,
  toMatrix3,
  type Quat,
} from "@/lib/quaternion";
import { VertexHover } from "./VertexHover";
import styles from "./PolyhedronGlobe.module.css";

// Locked tuning from the /hover-dot sandbox in svg-experiments. Mono
// font + slow typing + caret + dismissal flash + subtle hologram
// flicker. See commit history of svg-experiments for the rationale.
const HOVER_DOT_TYPE_DURATION = 800;
const HOVER_DOT_IDLE_GLOW = 8;
const HOVER_DOT_EXPANDED_GLOW = 10;
const HOVER_DOT_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';
const HOVER_DOT_FONT_SIZE = 17;

/**
 * Tessellated icosphere with optional per-vertex project assignments.
 *
 * polyhedron-hover-type phase: each vertex of the icosphere can host a
 * project. Hovering an assigned vertex pauses the sphere's rotation and
 * types the project's title below the vertex (with caret + subtle flicker)
 * — see ./HoverDot.tsx for the per-vertex visual logic.
 *
 * Hover semantics (locked in /hover-dot sandbox):
 *   - Browser hover signal is the engagement contract. As long as the
 *     cursor is "still hovering" a dot, the title stays open. A
 *     motionless cursor doesn't dismiss anything.
 *   - On mouseleave, a graceMs timer fires. During grace the title is
 *     still visible. Re-entering before grace expires cancels it.
 *   - When grace expires, a brief 80ms brightness flash precedes the
 *     untype animation (3× faster than typing).
 *   - PolyhedronGlobe tracks which dot is active (via HoverDot's
 *     onActiveChange callback). Auto-rotation pauses while any dot
 *     is active. Dragging the sphere is allowed even mid-hover; the
 *     hover state survives drag.
 *
 * Rendering pipeline per frame:
 *   1. Compose Y-rotation (drag) × X-rotation (drag) × Z-tilt (axial)
 *   2. Rotate every vertex once
 *   3. Backface-cull each face by screen-space winding
 *   4. Painter-sort visible faces by centroid Z
 *   5. Render face polygons + edge halos
 *   6. Render <HoverDot> at each assigned + visible vertex
 */

/** Map from vertex index (0..N-1 in the mesh) to a project. */
export interface VertexAssignment {
  vertexIdx: number;
  project: Project;
}

interface PolyhedronGlobeProps {
  /** Sphere radius in viewBox units. */
  radius?: number;
  /** Frequency of icosphere subdivision (2 = 80 faces, 42 vertices). */
  frequency?: number;
  /** Vertex-to-project bindings. Unassigned vertices show only their glow. */
  assignments?: VertexAssignment[];
}

// Auto-rotation angular speed in radians/second. Equivalent to the
// prior Euler AUTO_SPEED of 0.08 deg/frame at 60fps (~4.8 deg/sec).
const AUTO_ANGULAR_SPEED = (0.08 / 16) * 1000 * (Math.PI / 180);
// Drag input rate: radians of rotation per pixel of pointer move.
// Equivalent to the prior Euler 0.3 deg/px.
const DRAG_RATE = (0.3 * Math.PI) / 180;

// ─── Hover cycle ─────────────────────────────────────────────
// Any mouse hover landing on a dot triggers a "stop-and-resume" cycle:
//   1. The sphere decelerates from full auto-speed to a halt over
//      HOVER_DECEL_MS, smoothly (ease-out cubic).
//   2. It holds still for HOVER_HOLD_MS — the user's reading window,
//      covering 800ms typing + a beat to digest the title.
//   3. It accelerates back to cruise over HOVER_RESUME_MS.
// During the cycle the dot's hover behavior is independent — the user
// can engage and disengage; the cycle plays through.
//
// A new hover RESTARTS the cycle only if the current speed multiplier
// is already ≥ HOVER_RETRIGGER_THRESHOLD. Otherwise the new hover is
// treated as "the user is still looking at the previous engagement"
// and the cycle continues without interruption.
const HOVER_DECEL_MS = 350;
const HOVER_HOLD_MS = 1700;
const HOVER_RESUME_MS = 550;
const HOVER_RETRIGGER_THRESHOLD = 0.5;
const TIME_CONSTANT = 600;
// Angular-velocity threshold (rad/sec) below which momentum is
// considered settled. Was 0.5 deg/sec equivalent in the Euler model;
// keep similar value in radians.
const VELOCITY_THRESHOLD = 0.01;
const AXIAL_TILT_DEG = 18;

// ─── Anchor (click-to-anchor) ────────────────────────────────
// Clicking an assigned vertex anchors the sphere: the clicked vertex
// swings to a fixed screen position (the "anchor pose"), and auto-
// rotation continues around the AXIS THROUGH THAT VERTEX at a reduced
// speed — so the anchored point stays put while the rest of the globe
// spins around it.
//
// ANCHOR_NDC_X/Y is the target screen position in normalized (-1, 1)
// sphere-radius units. (-0.15, 0.35) reads as "upper-center, slightly
// left" against the viewBox. Leaves the lower-right area free for the
// hex billboard (Stage 3) to project upward.
const ANCHOR_NDC_X = -0.15;
const ANCHOR_NDC_Y = 0.35;
// Duration of the swing-in slerp from the user's current orientation
// to the anchor pose. Slow enough to read as a deliberate gesture.
const ANCHOR_SWING_MS = 900;
// Auto-rotation speed multiplier once anchored. The sphere keeps
// spinning, but slower — so the anchored vertex feels still while
// surrounding geometry drifts behind it.
const ANCHOR_AUTO_SPEED_MUL = 0.6;

// ─── Glow toggles ─────────────────────────────────────────────
// Flip these constants to A/B individual visual effects in isolation
// without touching the render code. polyhedron-glow branch ships with
// all three on so you see the maximalist version first.
const ENABLE_RADIAL_BG = true;
const ENABLE_EDGE_GLOW = true;
const ENABLE_VERTEX_GLOW = true;

/**
 * Compute the auto-rotation speed multiplier at time `now` given when
 * the current hover cycle started. Returns 1 (full speed) when no
 * cycle is active or the cycle has fully completed; ramps to 0 (stopped)
 * over HOVER_DECEL_MS; stays at 0 for HOVER_HOLD_MS; ramps back to 1
 * over HOVER_RESUME_MS via ease-out cubic.
 */
function computeHoverSpeedMul(now: number, cycleStart: number | null): number {
  if (cycleStart === null) return 1;
  const elapsed = now - cycleStart;
  if (elapsed < 0) return 1; // shouldn't happen but defensive
  if (elapsed < HOVER_DECEL_MS) {
    // Decelerating: ease-out cubic of (1 - p) — slows fast then settles.
    const p = elapsed / HOVER_DECEL_MS;
    return 1 - easeOutCubic(p);
  }
  const afterDecel = elapsed - HOVER_DECEL_MS;
  if (afterDecel < HOVER_HOLD_MS) {
    return 0; // fully stopped during hold
  }
  const afterHold = afterDecel - HOVER_HOLD_MS;
  if (afterHold < HOVER_RESUME_MS) {
    const p = afterHold / HOVER_RESUME_MS;
    return easeOutCubic(p);
  }
  return 1; // cycle complete
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function PolyhedronGlobe({
  radius = 340,
  frequency = 2,
  assignments,
}: PolyhedronGlobeProps) {
  // Mesh is a stable per-frequency constant. Memoize so we don't regenerate
  // 80 vertices + 80 faces on every render.
  const mesh: Mesh = useMemo(() => geodesic(frequency), [frequency]);

  // Vertex-idx → project lookup. Vertices without an assignment render
  // as plain glow circles (no hover, no title).
  const assignmentByVertex = useMemo(() => {
    const map = new Map<number, Project>();
    for (const a of assignments ?? []) map.set(a.vertexIdx, a.project);
    return map;
  }, [assignments]);

  // ─── Rotation state (quaternion) ─────────────────────────────
  //
  // A single quaternion `q` represents the cumulative rotation of the
  // sphere's user-controlled orientation. Drag and auto-rotate left-
  // multiply incremental rotations into `q` each frame. The axial Z
  // tilt is applied as a fixed post-rotation in the projection
  // pipeline below — it's a camera tilt, not part of the user's
  // controllable rotation.
  //
  // Initial value: a 15° rotation around world-X (matches the prior
  // Euler initial tilt that exposed a bit more of the northern
  // hemisphere on first paint).
  //
  // The auto-rotate axis is stored separately. By default it's world
  // Y `(0, 1, 0)` — the sphere spins around its vertical axis. Stage 2
  // (click-to-anchor) will swap this to point through the clicked
  // vertex, giving rotation around an arbitrary axis.
  const INITIAL_PITCH_RAD = (15 * Math.PI) / 180;
  const [q, setQ] = useState<Quat>(() =>
    fromAxisAngle(1, 0, 0, INITIAL_PITCH_RAD),
  );
  const latestQ = useRef<Quat>(fromAxisAngle(1, 0, 0, INITIAL_PITCH_RAD));
  const autoRotateAxis = useRef<{ x: number; y: number; z: number }>({
    x: 0,
    y: 1,
    z: 0,
  });

  const applyQ = useCallback((next: Quat) => {
    latestQ.current = next;
    setQ(next);
  }, []);

  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const lastTime = useRef(0);
  const didDrag = useRef(false);
  // Angular velocity components (radians/sec) accumulated during drag,
  // decayed via TIME_CONSTANT after release. Replaces the prior
  // velocityX/velocityY scalars that targeted Euler angles directly.
  const angularVelocityYaw = useRef(0);
  const angularVelocityPitch = useRef(0);
  const releaseTime = useRef(0);
  const amplitudeYaw = useRef(0);
  const amplitudePitch = useRef(0);

  // ─── Hover engagement model ──────────────────────────────────
  //
  // Engagement is STICKY and PARENT-CONTROLLED. Once the user hovers
  // a dot (with a recent mousemove signalling intent), that vertex
  // becomes engaged — its title types in, the sphere runs its hover
  // cycle. Engagement persists indefinitely even after the dot's hit
  // target drifts away from under a motionless cursor.
  //
  // Engagement RELEASES only on:
  //   1. The user moves the cursor and lands on a DIFFERENT dot's
  //      hit target → old releases, new engages
  //   2. The cursor leaves the entire SVG → old releases
  // (Future: clicking anywhere on the sphere → engagement transitions
  //  to the click-zoom + billboard interaction in Phase 3.)
  //
  // Why this model: the museum's sphere rotates. Dots drift under a
  // motionless cursor. The browser fires mouseleave/enter events as
  // hit targets cross the cursor — but those events are GEOMETRY
  // events, not INTENT events. A user-intent event is a mousemove
  // followed by a mouseenter. We gate engagement on intent.
  const [engagedVertexIdx, setEngagedVertexIdx] = useState<number | null>(null);

  // Hover-cycle bookkeeping (sphere decelerate → hold → resume).
  const hoverCycleStart = useRef<number | null>(null);

  // Cursor-movement gating. Updated by the SVG-level pointermove
  // listener. A new dot's mouseenter only counts as user intent if a
  // mousemove fired within INTENT_WINDOW_MS before it.
  const lastCursorMoveAt = useRef<number>(0);
  const INTENT_WINDOW_MS = 100;

  const handleDotEnter = useCallback((vi: number) => {
    const now = performance.now();
    const intent = now - lastCursorMoveAt.current < INTENT_WINDOW_MS;
    if (!intent) {
      // Geometry drift — dot rolled under a motionless cursor. Ignore.
      return;
    }
    // Different vertex → new engagement + maybe new hover cycle.
    setEngagedVertexIdx((prev) => {
      if (prev === vi) return prev; // same dot, already engaged
      // Trigger a fresh hover cycle if the sphere is back near cruise.
      const currentMul = computeHoverSpeedMul(now, hoverCycleStart.current);
      if (currentMul >= HOVER_RETRIGGER_THRESHOLD) {
        hoverCycleStart.current = now;
      }
      return vi;
    });
  }, []);

  // Dot mouseleave is INTENTIONALLY IGNORED — geometry drift would
  // fire it spuriously. Engagement only releases via SVG-level leave
  // or via a different dot's intent-gated mouseenter.
  const handleDotLeave = useCallback(() => {
    // noop
  }, []);

  // ─── Anchor (click-to-anchor) state ──────────────────────────
  //
  // anchoredVertexIdx is non-null in two situations:
  //   - During the swing-in slerp (anchorAnim active): the value
  //     names the vertex being swung to.
  //   - After settle: same value, but anchorAnim is null and the
  //     auto-rotate is now circling around the vertex's axis at
  //     ANCHOR_AUTO_SPEED_MUL.
  // The component is "anchored" for the purposes of input gating and
  // the Stage 3 billboard whenever this is non-null.
  const [anchoredVertexIdx, setAnchoredVertexIdx] = useState<number | null>(
    null,
  );
  const anchoredVertexIdxRef = useRef<number | null>(null);
  useEffect(() => {
    anchoredVertexIdxRef.current = anchoredVertexIdx;
  }, [anchoredVertexIdx]);

  // Swing animation state. When set, the rAF loop interpolates `q`
  // from `fromQ` to `toQ` over [startedAt, startedAt + ANCHOR_SWING_MS]
  // via slerp and ignores the normal drag/auto-rotate update.
  const anchorAnim = useRef<{
    startedAt: number;
    fromQ: Quat;
    toQ: Quat;
  } | null>(null);

  // After settle, this holds the world-space axis through the
  // anchored vertex (used by the auto-rotate path in the rAF loop in
  // place of the default world-Y axis). It's the unit vector that
  // `q · v_mesh` produces after the swing-in completes.
  const anchoredAxis = useRef<{ x: number; y: number; z: number } | null>(null);

  // Compute the target quaternion that puts mesh vertex `v` at the
  // ANCHOR_NDC_(X,Y) screen position. Decomposes the projection
  // pipeline backward:
  //   1. Pick a target post-rotation point on the unit sphere that
  //      projects (under axial tilt + perspective + scale) to the
  //      desired NDC. Here we approximate: ignore perspective scaling
  //      (~5% effect at our cameraZ), reverse only the axial tilt,
  //      and snap to the unit sphere via z = sqrt(1 - x² - y²).
  //   2. The rotation that takes `v` to that target point IS the
  //      target quaternion (via fromUnitVectors).
  // Returns both the target quaternion AND the world-space axis the
  // vertex lands on (== the target point itself), which the auto-
  // rotate uses post-settle.
  const computeAnchorTarget = useCallback(
    (vMesh: {
      x: number;
      y: number;
      z: number;
    }): { toQ: Quat; axis: { x: number; y: number; z: number } } => {
      // Reverse the axial Z tilt. Forward tilt is (x,y) → (x·cosZ -
      // y·sinZ, x·sinZ + y·cosZ); inverse is (x·cosZ + y·sinZ,
      // -x·sinZ + y·cosZ).
      const angZ = (AXIAL_TILT_DEG * Math.PI) / 180;
      const cZ = Math.cos(angZ);
      const sZ = Math.sin(angZ);
      // Screen NDC y is FLIPPED relative to math y (sy = -y · ...).
      // So a target screen NDC of +0.35 ("upper" on screen) maps to
      // math y = +0.35 (a positive y above the equator after the
      // axial tilt). We pass the math-y directly here.
      const ndcX = ANCHOR_NDC_X;
      const ndcY = ANCHOR_NDC_Y;
      // Inverse axial-tilt → the post-rotation, pre-tilt (x,y).
      const px = ndcX * cZ + ndcY * sZ;
      const py = -ndcX * sZ + ndcY * cZ;
      // Snap to the front-facing hemisphere of the unit sphere.
      const r2 = px * px + py * py;
      const pz = r2 >= 1 ? 0 : Math.sqrt(1 - r2);
      // Target point on the unit sphere in pre-tilt world space.
      const tx = px;
      const ty = py;
      const tz = pz;
      // Rotation that takes vMesh → target.
      const toQ = fromUnitVectors(vMesh.x, vMesh.y, vMesh.z, tx, ty, tz);
      return { toQ, axis: { x: tx, y: ty, z: tz } };
    },
    [],
  );

  // Click on an assigned vertex. Kicks off the swing-in animation
  // toward the anchor pose. If the same vertex is already anchored,
  // ignore (no jitter from double clicks). If a different vertex was
  // anchored, retarget the swing from the current `q` to the new
  // target — the slerp will smoothly redirect.
  const handleDotClick = useCallback(
    (vi: number) => {
      const v = mesh.vertices[vi];
      if (!v) return;
      if (anchoredVertexIdxRef.current === vi && !anchorAnim.current) {
        // Already settled on this vertex — nothing to do.
        return;
      }
      const { toQ } = computeAnchorTarget(v);
      anchorAnim.current = {
        startedAt: performance.now(),
        fromQ: latestQ.current,
        toQ,
      };
      setAnchoredVertexIdx(vi);
      // Clear any pending hover-cycle accel/decel — the anchor swing
      // takes over the rotation entirely.
      hoverCycleStart.current = null;
      // Anchored axis isn't settled yet; the rAF loop fills it in on
      // animation completion.
      anchoredAxis.current = null;
    },
    [mesh.vertices, computeAnchorTarget],
  );

  // SVG-level pointer handlers.
  //
  // pointermove tracks two things:
  //   - lastCursorMoveAt timestamp (gates intent for dot-enter)
  //   - cursorPos in viewBox coordinates (used by the per-frame
  //     check below to decide whether the cursor is currently over
  //     the engaged dot's hit target)
  //
  // pointerleave: cursor left the entire SVG. Belt-and-suspenders
  // dismiss — the per-frame check would also catch this once it
  // notices the cursor's last-known position is no longer over the
  // engaged dot, but pointerleave fires immediately.
  const cursorPos = useRef<{ x: number; y: number } | null>(null);

  const handleSvgPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      lastCursorMoveAt.current = performance.now();
      // Convert client coords → SVG viewBox coords. The SVG fills its
      // wrapper at intrinsic size (we set width/height = stageSize),
      // so the math is a simple subtract-bounding-rect.
      const rect = e.currentTarget.getBoundingClientRect();
      cursorPos.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    [],
  );
  const handleSvgPointerLeave = useCallback(() => {
    cursorPos.current = null;
    setEngagedVertexIdx(null);
  }, []);

  // Collapse timer: starts when the cursor moves off the engaged dot's
  // hit target (without re-entering it). Cancelled if the cursor returns
  // to the dot before expiry. On expiry, engagement releases — title
  // runs its dismissal animation (flash + untype) via the VertexHover's
  // engaged=false transition.
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const COLLAPSE_MS = 1200;
  // Mirror engagedVertexIdx into a ref so the rAF loop can read it
  // without depending on it (would re-mount the loop otherwise).
  const engagedVertexIdxRef = useRef<number | null>(null);
  useEffect(() => {
    engagedVertexIdxRef.current = engagedVertexIdx;
  }, [engagedVertexIdx]);
  // Cleanup
  useEffect(() => {
    return () => {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
    };
  }, []);

  // ─── Drag-momentum physics loop ──────────────────────────────
  //
  // Each frame: if drag-momentum is still decaying, apply incremental
  // yaw/pitch rotations (computed from decaying angular velocities)
  // to the quaternion. Otherwise auto-rotate around the current
  // autoRotateAxis, modulated by the hover-cycle speed multiplier.
  //
  // Pole-bounce is GONE in this refactor — it was a constraint
  // specific to the Euler model and doesn't compose with the
  // arbitrary-axis rotation we'll need in Stage 2 (click-to-anchor).
  // The sphere can now drag freely over the poles. This is a small
  // user-facing change vs the prior Euler implementation.
  useEffect(() => {
    let lastTick = performance.now();
    let frame: number;

    function tick(now: number) {
      const dt = now - lastTick;
      lastTick = now;
      const dtSec = dt / 1000;

      // ─── Anchor swing-in (slerp) ───────────────────────────
      // While the anchor animation is active, it OWNS the rotation
      // entirely. Drag momentum is suppressed; auto-rotate is paused.
      // The slerp progress is ease-in-out (cubic) so the swing
      // feels deliberate at both ends instead of mechanically linear.
      const anim = anchorAnim.current;
      if (anim) {
        const elapsed = now - anim.startedAt;
        const tRaw = Math.min(1, elapsed / ANCHOR_SWING_MS);
        // ease-in-out cubic: slow at both ends, fast in the middle.
        const t =
          tRaw < 0.5
            ? 4 * tRaw * tRaw * tRaw
            : 1 - Math.pow(-2 * tRaw + 2, 3) / 2;
        applyQ(quatSlerp(anim.fromQ, anim.toQ, t));
        if (tRaw >= 1) {
          // Settle: the rotated vertex's world-space position becomes
          // the new auto-rotate axis. Recompute it (instead of trusting
          // the stored target) so the axis is exactly q · v_mesh — no
          // drift from numerical slerp.
          const vi = anchoredVertexIdxRef.current;
          if (vi !== null) {
            const vMesh = mesh.vertices[vi];
            if (vMesh) {
              const m = toMatrix3(latestQ.current);
              anchoredAxis.current = {
                x: m[0] * vMesh.x + m[1] * vMesh.y + m[2] * vMesh.z,
                y: m[3] * vMesh.x + m[4] * vMesh.y + m[5] * vMesh.z,
                z: m[6] * vMesh.x + m[7] * vMesh.y + m[8] * vMesh.z,
              };
              autoRotateAxis.current = anchoredAxis.current;
            }
          }
          anchorAnim.current = null;
        }
        frame = requestAnimationFrame(tick);
        return;
      }

      if (!dragging.current) {
        const speed =
          Math.abs(amplitudeYaw.current) + Math.abs(amplitudePitch.current);

        if (speed > VELOCITY_THRESHOLD) {
          // Drag-release momentum: decay the angular velocity and apply
          // an incremental rotation each frame.
          const elapsed = now - releaseTime.current;
          const decay = Math.exp(-elapsed / TIME_CONSTANT);

          const yawRate = amplitudeYaw.current * decay;
          const pitchRate = amplitudePitch.current * decay;

          // Compose two world-axis rotations: yaw around world Y,
          // pitch around world X. Order matches the prior Euler model
          // (Y applied first, then X) — pitch is multiplied last in
          // the chain so it ends up on the left of yaw.
          let next = latestQ.current;
          const yawAngle = yawRate * dtSec;
          const pitchAngle = pitchRate * dtSec;
          if (yawAngle !== 0) {
            next = quatMultiply(fromAxisAngle(0, 1, 0, yawAngle), next);
          }
          if (pitchAngle !== 0) {
            next = quatMultiply(fromAxisAngle(1, 0, 0, pitchAngle), next);
          }
          applyQ(next);

          if (Math.abs(yawRate) < 0.01 && Math.abs(pitchRate) < 0.01) {
            amplitudeYaw.current = 0;
            amplitudePitch.current = 0;
          }
        } else {
          // Auto-rotate around autoRotateAxis. The speed multiplier is
          // driven by the hover cycle (decelerates on hover-engage,
          // holds, then ramps back up). When the cycle completes,
          // hoverCycleStart resets so we stop recomputing.
          //
          // When anchored to a vertex (anchoredAxis non-null + no
          // active swing animation), the axis is the world-space
          // direction through the anchored vertex, and the base speed
          // drops by ANCHOR_AUTO_SPEED_MUL — so the anchored point
          // stays put while the rest of the globe wheels behind it.
          const speedMul = computeHoverSpeedMul(now, hoverCycleStart.current);
          if (speedMul >= 1 && hoverCycleStart.current !== null) {
            hoverCycleStart.current = null;
          }
          if (speedMul > 0) {
            const anchorMul = anchoredAxis.current ? ANCHOR_AUTO_SPEED_MUL : 1;
            const angle = AUTO_ANGULAR_SPEED * speedMul * anchorMul * dtSec;
            const axis = autoRotateAxis.current;
            const delta = fromAxisAngle(axis.x, axis.y, axis.z, angle);
            applyQ(quatMultiply(delta, latestQ.current));
          }
        }
      }

      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // mesh.vertices is intentionally not a dep: it's stable for the
    // lifetime of the component (mesh is memoized on `frequency`).
    // Listing it would re-mount the rAF loop on every render that
    // happens to re-create the dep array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyQ]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    didDrag.current = false;
    angularVelocityYaw.current = 0;
    angularVelocityPitch.current = 0;
    amplitudeYaw.current = 0;
    amplitudePitch.current = 0;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    lastTime.current = performance.now();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  // Drag-input mapping: dx (horizontal pointer move) → yaw around
  // world Y. dy (vertical pointer move) → pitch around world X.
  // Both at DRAG_RATE radians per pixel.
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;

      const now = performance.now();
      const dt = now - lastTime.current;
      if (dt === 0) return;

      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;

      lastMouse.current = { x: e.clientX, y: e.clientY };
      lastTime.current = now;

      // Per-pixel rotation rate (rad/px). Matches the prior Euler
      // model's 0.3°/px ≈ 0.00524 rad/px.
      const yawAngle = dx * DRAG_RATE;
      const pitchAngle = dy * DRAG_RATE;

      // Angular velocity tracking (rad/sec) for release momentum.
      // Same EMA smoothing as before (0.8 new + 0.2 old).
      const yawRate = (1000 * yawAngle) / (1 + dt);
      const pitchRate = (1000 * pitchAngle) / (1 + dt);
      angularVelocityYaw.current =
        0.8 * yawRate + 0.2 * angularVelocityYaw.current;
      angularVelocityPitch.current =
        0.8 * pitchRate + 0.2 * angularVelocityPitch.current;

      // Apply the incremental rotation immediately. Same composition
      // order as the momentum loop: yaw around world Y, then pitch
      // around world X.
      let next = latestQ.current;
      if (yawAngle !== 0) {
        next = quatMultiply(fromAxisAngle(0, 1, 0, yawAngle), next);
      }
      if (pitchAngle !== 0) {
        next = quatMultiply(fromAxisAngle(1, 0, 0, pitchAngle), next);
      }
      applyQ(next);
    },
    [applyQ],
  );

  const handlePointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;

    // Stationary-finger guard: if the last move was >50ms ago, clear
    // accumulated velocity. Same as before.
    if (performance.now() - lastTime.current > 50) {
      angularVelocityYaw.current = 0;
      angularVelocityPitch.current = 0;
    }

    // Set the initial momentum amplitude from current angular velocity.
    // The amplitude decays via Math.exp(-elapsed/TIME_CONSTANT) in the
    // tick loop above.
    amplitudeYaw.current = angularVelocityYaw.current;
    amplitudePitch.current = angularVelocityPitch.current;
    releaseTime.current = performance.now();
  }, []);

  // ─── per-frame projection ─────────────────────────────────────────

  // viewBox is centered on (0, 0). Camera looks down -Z. Perspective is
  // applied via persp = cameraZ / (cameraZ - z) so vertices closer to the
  // camera scale up. Camera distance is large enough that the effect is
  // gentle, not fisheye.
  const cameraZ = 4;
  const stageSize = radius * 2 + 200;
  const scale = radius;
  const cx = stageSize / 2;
  const cy = stageSize / 2;

  // The user-controlled rotation is now a quaternion. Each frame we
  // convert it to a 3×3 matrix (once, not per vertex), apply that to
  // each vertex, then apply the fixed axial Z tilt and perspective.
  const angleZ = (AXIAL_TILT_DEG * Math.PI) / 180;
  const cosZ = Math.cos(angleZ);
  const sinZ = Math.sin(angleZ);
  const rotMatrix = useMemo(() => toMatrix3(q), [q]);

  // Project every vertex through:
  //   1. quaternion rotation (user-controlled, q)
  //   2. axial Z tilt (fixed camera tilt, AXIAL_TILT_DEG)
  //   3. perspective projection + viewBox translation
  const projected = useMemo(() => {
    const [m0, m1, m2, m3, m4, m5, m6, m7, m8] = rotMatrix;
    return mesh.vertices.map((v) => {
      // Rotate by the user quaternion's matrix.
      const x1 = m0 * v.x + m1 * v.y + m2 * v.z;
      const y1 = m3 * v.x + m4 * v.y + m5 * v.z;
      const z1 = m6 * v.x + m7 * v.y + m8 * v.z;
      // Axial Z tilt — fixed camera-level rotation.
      const x2 = x1 * cosZ - y1 * sinZ;
      const y2 = x1 * sinZ + y1 * cosZ;
      const z2 = z1;
      // Perspective.
      const persp = cameraZ / (cameraZ - z2);
      return {
        sx: x2 * persp * scale + cx,
        sy: -y2 * persp * scale + cy,
        z: z2,
      };
    });
  }, [mesh.vertices, rotMatrix, cosZ, sinZ, cameraZ, scale, cx, cy]);

  // Per-face processing: cull backfaces, compute centroid Z for sort.
  // Also collects the union of vertex indices touched by visible (front-
  // facing) faces, for vertex-glow rendering downstream.
  const { faceRecords, visibleVertices } = useMemo(() => {
    const records: {
      faceIdx: number;
      points: string;
      centroidZ: number;
      facingCamera: number;
    }[] = [];
    const visibleSet = new Set<number>();

    for (let i = 0; i < mesh.faces.length; i++) {
      const face = mesh.faces[i]!;
      const a = projected[face[0]!]!;
      const b = projected[face[1]!]!;
      const c = projected[face[2]!]!;

      // Backface cull via screen-space winding. The mesh stores faces
      // CCW when viewed from OUTSIDE the sphere. The screen's y-axis is
      // flipped relative to math y (sy = -y · ...), so a CCW-from-outside
      // face that's front-facing for the camera projects to the screen
      // as CW. CW on screen → the z-component of the 2D cross product
      // (ex*fy - ey*fx) is negative. So front-facing → screenZ < 0.
      const ex = b.sx - a.sx;
      const ey = b.sy - a.sy;
      const fx = c.sx - a.sx;
      const fy = c.sy - a.sy;
      const screenZ = ex * fy - ey * fx;
      if (screenZ >= 0) continue;

      const cz = (a.z + b.z + c.z) / 3;
      // Front-facing only after cull, so cz ∈ [0, ~1]. Map to [0, 1] for
      // tint intensity.
      const facingCamera = Math.max(0, Math.min(1, cz));
      const points = `${a.sx.toFixed(1)},${a.sy.toFixed(1)} ${b.sx.toFixed(1)},${b.sy.toFixed(1)} ${c.sx.toFixed(1)},${c.sy.toFixed(1)}`;

      records.push({ faceIdx: i, points, centroidZ: cz, facingCamera });
      for (const vi of face) visibleSet.add(vi);
    }

    // Painter: back first, front last.
    records.sort((a, b) => a.centroidZ - b.centroidZ);

    // Project each visible vertex once, keep its sphere-space z for tint
    // strength (vertices facing the camera glow brighter than vertices
    // near the silhouette). Sort back-to-front to match the face painter
    // order so silhouette vertices land last and read as crisp.
    const vertices = Array.from(visibleSet).map((vi) => {
      const p = projected[vi]!;
      return {
        vi,
        sx: p.sx,
        sy: p.sy,
        z: p.z,
        facingCamera: Math.max(0, Math.min(1, p.z)),
      };
    });
    vertices.sort((u, v) => u.z - v.z);

    return { faceRecords: records, visibleVertices: vertices };
  }, [mesh.faces, projected]);

  // Per-render: check whether the cursor is still over the engaged dot.
  //
  // Every frame (because `projected` and thus `visibleVertices`
  // re-memoize when rotation changes), this effect runs and:
  //   - If engaged AND cursor is currently inside the engaged dot's
  //     hit target → cancel any pending collapse timer.
  //   - If engaged AND cursor is NOT over the dot (or dot is back-
  //     culled and not visible) → start a collapse timer (if not
  //     already running). On expiry, engagedVertexIdx clears, which
  //     drives VertexHover's engaged=false → flash + untype.
  //   - If not engaged → nothing to do (clear any leftover timer).
  //
  // The cursor's position is captured by handleSvgPointerMove on each
  // pointermove. Between moves the cursor is motionless; the position
  // ref stays valid until the next move.
  useEffect(() => {
    const engaged = engagedVertexIdx;
    if (engaged === null) {
      if (collapseTimer.current) {
        clearTimeout(collapseTimer.current);
        collapseTimer.current = null;
      }
      return;
    }
    const cursor = cursorPos.current;
    const dot = visibleVertices.find((v) => v.vi === engaged);
    // Compute cursor-over-dot. If cursor has never moved (null), treat
    // as "still over" — the user has been motionless since engagement.
    // If the dot itself is back-culled (not in visibleVertices), the
    // user has rotated it off-screen → treat as "not over."
    let cursorOverDot = false;
    if (cursor === null) {
      cursorOverDot = true; // motionless cursor, keep engagement
    } else if (dot) {
      const dx = cursor.x - dot.sx;
      const dy = cursor.y - dot.sy;
      // Use a slightly generous radius (1.2× the hit-target) so brief
      // perimeter wobble doesn't oscillate the timer state.
      const reach = 24 * 1.2;
      cursorOverDot = dx * dx + dy * dy <= reach * reach;
    }

    if (cursorOverDot) {
      // Cancel any pending collapse timer.
      if (collapseTimer.current) {
        clearTimeout(collapseTimer.current);
        collapseTimer.current = null;
      }
    } else {
      // Start collapse timer if not already running.
      if (!collapseTimer.current) {
        collapseTimer.current = setTimeout(() => {
          setEngagedVertexIdx(null);
          collapseTimer.current = null;
        }, COLLAPSE_MS);
      }
    }
  });

  return (
    <div
      className={styles.stage}
      style={{ width: stageSize, height: stageSize }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onClickCapture={(e) => {
        if (didDrag.current) e.preventDefault();
      }}
    >
      <svg
        viewBox={`0 0 ${stageSize} ${stageSize}`}
        className={styles.svg}
        aria-label="Museum sphere"
        onPointerMove={handleSvgPointerMove}
        onPointerLeave={handleSvgPointerLeave}
      >
        <defs>
          {/* Radial gradient for the background halo. Centered on the
              sphere, fades from a soft tint at center to fully transparent
              by the corners. Read on a dark theme as a faint atmospheric
              glow; on a light theme as a barely-perceptible cool wash. */}
          <radialGradient
            id="ph-bg-halo"
            cx="50%"
            cy="50%"
            r="50%"
            fx="50%"
            fy="50%"
          >
            <stop
              offset="0%"
              stopColor="oklch(from var(--foreground) l c h / 0.18)"
            />
            <stop
              offset="55%"
              stopColor="oklch(from var(--foreground) l c h / 0.06)"
            />
            <stop
              offset="100%"
              stopColor="oklch(from var(--foreground) l c h / 0)"
            />
          </radialGradient>

          {/* Radial gradient for each vertex glow — bright pinpoint at
              center, soft falloff. Used as the fill of vertex circles. */}
          <radialGradient id="ph-vertex-glow" cx="50%" cy="50%" r="50%">
            <stop
              offset="0%"
              stopColor="oklch(from var(--foreground) l c h / 0.95)"
            />
            <stop
              offset="35%"
              stopColor="oklch(from var(--foreground) l c h / 0.45)"
            />
            <stop
              offset="100%"
              stopColor="oklch(from var(--foreground) l c h / 0)"
            />
          </radialGradient>

          {/* Gaussian-blur filter for edge glow. The blurred-stroke pass
              uses this filter on a thicker, semi-transparent stroke so
              edges read as having a halo. stdDeviation in viewBox units
              — keep small relative to sphere radius. */}
          <filter
            id="ph-edge-glow"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur stdDeviation="2.5" />
          </filter>

          {/* Radial gradient referenced by HoverDot's expandable glow
              circle. Brighter pinpoint center than the plain
              vertex-glow gradient; HoverDot uses radius scaling to
              animate it. ID must match what HoverDot.tsx references. */}
          <radialGradient id="hover-dot-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(220, 235, 255, 0.95)" />
            <stop offset="40%" stopColor="rgba(140, 180, 255, 0.55)" />
            <stop offset="100%" stopColor="rgba(80, 140, 220, 0)" />
          </radialGradient>
        </defs>

        {ENABLE_RADIAL_BG && (
          <rect
            x={0}
            y={0}
            width={stageSize}
            height={stageSize}
            fill="url(#ph-bg-halo)"
            pointerEvents="none"
          />
        )}

        {faceRecords.map((face) => (
          <g key={face.faceIdx}>
            {/* Edge-glow pass: thick, semi-transparent stroke run through
                the gaussian-blur filter sits underneath the crisp
                stroke. Visible only where the silhouette of the polygon
                is, since the fill itself is no-fill on the glow pass. */}
            {ENABLE_EDGE_GLOW && (
              <polygon
                points={face.points}
                fill="none"
                stroke={`oklch(from var(--foreground) l c h / ${0.25 + face.facingCamera * 0.35})`}
                strokeWidth={3.2}
                strokeLinejoin="round"
                filter="url(#ph-edge-glow)"
                pointerEvents="none"
              />
            )}
            {/* Crisp face on top: same fill + edge as the bare branch. */}
            <polygon
              points={face.points}
              fill={`oklch(from var(--foreground) l c h / ${0.04 + face.facingCamera * 0.1})`}
              stroke={`oklch(from var(--foreground) l c h / ${0.25 + face.facingCamera * 0.3})`}
              strokeWidth={0.8}
              strokeLinejoin="round"
              pointerEvents="none"
            />
          </g>
        ))}

        {ENABLE_VERTEX_GLOW &&
          visibleVertices.map((v) => {
            const project = assignmentByVertex.get(v.vi);
            // Assigned vertex: render <VertexHover>. Engagement is
            // sticky and parent-controlled — see the engagement model
            // comment above. The dot's hit-target enter/leave events
            // are intercepted by the parent (which gates on
            // mousemove-recency to distinguish user intent from
            // geometry drift). Dot mouseleave is intentionally a
            // noop here; engagement only releases via SVG-level
            // pointerleave OR a different dot's intent-gated enter.
            if (project) {
              return (
                <VertexHover
                  key={v.vi}
                  title={project.title}
                  x={v.sx}
                  y={v.sy}
                  engaged={engagedVertexIdx === v.vi}
                  onHitTargetEnter={() => handleDotEnter(v.vi)}
                  onHitTargetLeave={handleDotLeave}
                  onHitTargetClick={() => handleDotClick(v.vi)}
                  typeDuration={HOVER_DOT_TYPE_DURATION}
                  idleGlowRadius={HOVER_DOT_IDLE_GLOW}
                  expandedGlowRadius={HOVER_DOT_EXPANDED_GLOW}
                  titleFontFamily={HOVER_DOT_FONT_FAMILY}
                  titleFontSize={HOVER_DOT_FONT_SIZE}
                  showCaret={true}
                  flickerStyle="subtle"
                />
              );
            }
            // Unassigned vertex: plain glow circle (same as before).
            const r = 4 + v.facingCamera * 4;
            const opacity = 0.4 + v.facingCamera * 0.5;
            return (
              <circle
                key={v.vi}
                cx={v.sx}
                cy={v.sy}
                r={r}
                fill="url(#ph-vertex-glow)"
                opacity={opacity}
                pointerEvents="none"
              />
            );
          })}
      </svg>
    </div>
  );
}
