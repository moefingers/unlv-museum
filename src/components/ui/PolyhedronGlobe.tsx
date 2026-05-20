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
import { UnfoldingBillboard } from "./UnfoldingBillboard";
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
  /**
   * Fires when the anchor state changes (true on click-to-anchor,
   * false on release). The parent uses this to apply the anchored
   * zoom transform on a wrapping host (globeScaleHost in LandingView)
   * so the BreathingMesh cutout — which measures that host — tracks
   * the visible sphere size correctly. Single source of truth: the
   * DOM transform on the measured element drives both the visual
   * effect and the cutout calculation.
   */
  onAnchoredChange?: (anchored: boolean) => void;
  /**
   * Fires when the user adjusts zoom via wheel. Receives the wheel
   * event's deltaY so the parent can apply log-scaled multiplicative
   * zoom updates. Why deltaY, not a fully-computed userZoom value:
   * the parent owns the clamp + state, so the math (and any future
   * ceiling/floor adjustments) live with the state in one place.
   */
  onWheelZoom?: (deltaY: number) => void;
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
// sphere-radius units. (-0.13, 0.55) reads as "upper portion of the
// sphere, slightly left of center" — perspectivally the viewer feels
// like they're looking down slightly ON the vertex, with the rest
// of the sphere bowed beneath it. Leaves the lower area free for
// the hex billboard (Stage 3) to project upward from the dot.
const ANCHOR_NDC_X = -0.13;
const ANCHOR_NDC_Y = 0.55;
// Duration of the swing-in slerp from the user's current orientation
// to the anchor pose. Slow enough to read as a deliberate gesture.
export const ANCHOR_SWING_MS = 900;
// Auto-rotation speed multiplier once anchored. The sphere keeps
// spinning, but slower — so the anchored vertex feels still while
// surrounding geometry drifts behind it.
const ANCHOR_AUTO_SPEED_MUL = 0.6;

// ─── Hex billboard ──────────────────────────────────────────
// Once the anchor swing settles, a hexagonal "card" unfolds above
// the anchored vertex via the UnfoldingBillboard component (which
// runs the dot → line → triangle → square → pentagon → hexagon
// spring-bounce cascade). A conic projection beam connects the dot
// to the hex's base so the card reads as light projected up from
// the vertex itself.
//
// HEX_RADIUS is the radius (center → corner) of the final hexagon
// in viewBox units. Scaled relative to the sphere radius so the
// proportions hold whatever radius the parent passes in (default
// 600 in LandingView, 340 in standalone use).
const HEX_RADIUS_RATIO = 0.24; // hex radius = sphere radius × this
// HEX_OFFSET_RATIO: vertical gap between the anchored vertex and
// the BOTTOM EDGE of the hex (the cone bridges this gap). In
// viewBox units, scaled by sphere radius. Generous enough that the
// cone reads as a deliberate projection beam rather than a touching
// outline, tight enough that the projection feels intentional and
// not stretched.
const HEX_OFFSET_RATIO = 0.14;
// Cone half-angle (degrees) — the projection beam's spread from the
// dot upward. Wider = more dramatic spray of light; narrower = a
// tighter pillar. 24° produces a beam whose top edge is comfortably
// wider than the hex's bottom edge so the geometry reads as "the
// hex sits inside the cone's spread."
const CONE_HALF_ANGLE_DEG = 24;
// ─── Choreography timings (Stage 3 state machine) ───────────
//
// Anchor → hex-open is a staged sequence of distinct phases. Each
// phase has a fixed duration; a timer advances from one to the
// next. Phases:
//
//   swinging       sphere zooms + slerps to anchor pose
//   coneRising     cone height 0 → 1, width stays 0 (a vertical
//                  filament shoots up from the dot)
//   widening       cone width 0 → 1 AND hex unfold cascade run
//                  together — they're mentally one gesture: "the
//                  projection materializes around the card as the
//                  card unfolds out of the dot." Cone widens
//                  faster (early portion of the phase); hex takes
//                  the full duration to settle.
//   open           steady state (anchored 0.6× rotation begins)
//   collapsing     hex closes + cone narrows together (reverse of
//                  widening; cone usually finishes first)
//   coneFalling    cone height 1 → 0 (the filament retracts)
//   unswinging     sphere zooms out + axis returns to world-Y
//                  (only on full dismiss; on cross-anchor handoff
//                  the sphere goes directly back to `swinging`
//                  for the new target while staying zoomed-in)
//
// The sphere's anchored rotation cycle ONLY runs in the `open`
// phase so the cone + hex animations play against a still
// backdrop. The world stirs back to life once the card is open.
// Swing phase duration = ANCHOR_SWING_MS (declared above + exported
// for LandingView's matching transform transition). The rAF loop's
// slerp reads ANCHOR_SWING_MS directly; the phase machine's swing
// completion is signaled by the slerp's finish-tick rather than a
// timer.
const CONE_RISE_MS = 280;
const WIDENING_MS = 600; // hex cascade + cone widen, run together
const CONE_WIDEN_FRACTION = 0.4; // cone reaches full width at 40% of the widening phase
const COLLAPSING_MS = 480; // hex close + cone narrow (run together)
const CONE_FALL_MS = 220;
const UNSWING_MS = 900;

// ─── Anchored-state camera move ──────────────────────────────
// When anchored, the entire sphere zooms in and drops lower on the
// screen so the anchored vertex sits in the upper portion of the
// viewport while the sphere fills the lower 2/3. Cinematic depth —
// gives the impression of the camera dollying in and tilting down
// on the anchored point.
//
// Implemented via a CSS transition on the stage div's transform —
// plays alongside the rotation slerp on the same duration so both
// motions converge on settle. Scale about top-center so the upper
// half of the sphere stays roughly anchored while the lower half
// bulges downward.
//
// These values are tuned together with the framing offset in
// LandingView's globeWrap (--globe-frame-offset-y) — the base
// framing already drops the sphere by 20% of its height; the
// anchored transform pushes a little further and zooms in. If you
// change the framing offset, retune these.
// Anchored zoom is APPLIED in LandingView (on globeScaleHost, the
// element BreathingMesh measures) so the cutout tracks the visible
// sphere size. These constants are exported so LandingView can read
// them — keeping the tuning numbers next to the rotation/anchor math
// they're calibrated against.
export const ANCHOR_ZOOM_SCALE = 1.25;
export const ANCHOR_ZOOM_TRANSLATE_Y_PCT = 10; // % of stage height
// Easing for the zoom transition. Matches the slerp's ease-in-out
// cubic flavor so both gestures feel governed by the same curve.
export const ANCHOR_ZOOM_EASING = "cubic-bezier(0.65, 0, 0.35, 1)";

// ─── User-controlled zoom ────────────────────────────────────
// Visitors can zoom in/out on the sphere via mouse wheel (or
// trackpad pinch, which browsers deliver as wheel events with
// ctrlKey set). Bounded by a floor and ceiling so the sphere is
// always usable — too small and dots are unhittable, too large
// and you can only see one face at a time.
//
// The wheel input is converted to a multiplicative zoom delta so
// equal wheel travel produces equal *relative* zoom changes
// regardless of current zoom level — feels uniform whether you're
// zoomed in or zoomed out.
//
// Wheel listener is attached with passive: false on the stage div
// so we can preventDefault and stop the page from scrolling under
// the wheel. (The page doesn't scroll currently — there's nothing
// to scroll past the fixed globe — but a future content section
// below would, and this preserves the gesture for the sphere.)
// User zoom bounds + sensitivity. Exported so LandingView (which
// owns the userZoom state and applies the resulting transform on
// globeScaleHost) can use them. Single source of truth: this file
// defines the tuning, LandingView consumes it.
export const USER_ZOOM_MIN = 0.55;
export const USER_ZOOM_MAX = 2.4;
// Sensitivity: wheel deltaY of 100 → ratio change of exp(0.0015 * 100) ≈ 1.16
// (~16% zoom-in per "notch"). Trackpad pinch deltaY is much smaller per
// event so it feels equally smooth.
export const USER_ZOOM_WHEEL_SENSITIVITY = 0.0015;

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
  onAnchoredChange,
  onWheelZoom,
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

  // ─── Anchor choreography state machine (Stage 3) ────────────
  //
  // Declared up here (before the engagement model below) because
  // engagement decisions depend on the anchored state — e.g.,
  // hovering the anchored vertex should NOT re-engage its label
  // (the card has supplanted the label as its presentation). The
  // full state machine's effects + handlers are defined later in
  // the file; only the type, state, ref, and accessor live up here.
  //
  // Anchor open/close is a multi-phase sequence; this state machine
  // makes every phase explicit so no two animations race each
  // other on timers. Phases (see top-of-file comment for the full
  // story):
  //
  //   idle → swinging → coneRising → widening → open
  //   open → collapsing → coneFalling → unswinging → idle
  //   (cross-anchor handoff jumps from coneFalling back to swinging
  //    with the new target instead of unswinging)
  //
  // `pendingVertex` rides on collapsing / coneFalling to remember
  // which vertex we'll swing to next; null means "full dismiss."
  type AnchorPhase =
    | { kind: "idle" }
    | { kind: "swinging"; vi: number }
    | { kind: "coneRising"; vi: number }
    | { kind: "widening"; vi: number }
    | { kind: "open"; vi: number }
    | { kind: "collapsing"; vi: number; nextVi: number | null }
    | { kind: "coneFalling"; vi: number; nextVi: number | null }
    | { kind: "unswinging" };

  const [phase, setPhase] = useState<AnchorPhase>({ kind: "idle" });
  const phaseRef = useRef<AnchorPhase>(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Helper: anchored vi for the CURRENT phase (read from the ref so
  // side-effect callbacks like the rAF tick get the latest value
  // without depending on phase changes to re-create their closures).
  // Returns null for idle / unswinging; the carried vi otherwise.
  const getAnchoredVi = (): number | null => {
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
  };

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
    // While a vertex is anchored (card open), suppress label
    // engagement on THAT vertex — the card has already supplanted
    // the label as the presentation of that project. Hovering it
    // shouldn't re-engage the label.
    if (getAnchoredVi() === vi) {
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
  // anchoredVertexIdx is DERIVED from the phase state machine below
  // (search for "Anchor choreography state machine"). It's null in
  // the idle and unswinging phases, otherwise it's the vi the phase
  // carries. Callsites that need a current-anchored-vi read from a
  // side-effect (rAF loop, pointer-down handler) consult `phaseRef`
  // directly via `getAnchoredVi()` rather than maintaining a
  // separate ref-mirror — single source of truth.

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

  // ─── Anchor choreography state machine (Stage 3) — drivers ──
  //
  // The type, state, ref, and getAnchoredVi accessor are declared
  // earlier in the component (right after the rotation refs) so
  // the engagement model below can depend on anchored state.
  // Below: the timer-driven phase progression + handlers.
  //
  // Single shared timer for phase advancement. Clearing it before
  // every new phase means rapid clicks (e.g., spam-clicking
  // different vertices) never leave orphan timers firing.
  const phaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPhaseTimer = () => {
    if (phaseTimer.current) {
      clearTimeout(phaseTimer.current);
      phaseTimer.current = null;
    }
  };
  const scheduleNextPhase = (
    ms: number,
    next: AnchorPhase,
    /**
     * Optional side-effect to fire alongside the phase transition.
     * Used by cross-anchor handoff to clear in-flight label
     * engagement on the incoming vi so the new card opens against
     * a clean backdrop. Co-scheduling in the same timer callback
     * means both state updates batch into one React commit.
     */
    onTransition?: () => void,
  ) => {
    clearPhaseTimer();
    phaseTimer.current = setTimeout(() => {
      phaseTimer.current = null;
      if (onTransition) onTransition();
      setPhase(next);
    }, ms);
  };

  // ─── Phase-driven side effects ──────────────────────────────
  //
  // Each phase transition triggers:
  //   1. The state-derived rotation/zoom/cone/hex visual changes
  //      (these are all derived directly from `phase` in the JSX +
  //      anchored-axis ref below — no extra state needed).
  //   2. A timer to advance to the next phase after the phase's
  //      duration elapses.
  //   3. Side effects on refs (e.g., autoRotateAxis swap) at the
  //      points where they matter.
  //
  // Side effects ride this effect rather than embedded in
  // setPhase calls so the order is deterministic and inspectable.
  useEffect(() => {
    if (phase.kind === "idle") {
      clearPhaseTimer();
      anchoredAxis.current = null;
      autoRotateAxis.current = { x: 0, y: 1, z: 0 };
      return;
    }
    if (phase.kind === "swinging") {
      // Kick off the rotation slerp. The rAF loop owns the slerp
      // and signals back via swingCompletionTick; we listen below
      // to advance the phase.
      const v = mesh.vertices[phase.vi];
      if (!v) return;
      const { toQ } = computeAnchorTarget(v);
      anchorAnim.current = {
        startedAt: performance.now(),
        fromQ: latestQ.current,
        toQ,
      };
      hoverCycleStart.current = null;
      anchoredAxis.current = null;
      // No setTimeout here — the slerp completion in the rAF loop
      // bumps swingCompletionTick which advances to coneRising via
      // a watcher effect below.
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
      // Anchored rotation runs in this phase only (see rAF loop's
      // anchoredRotationActive check).
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
      // On cross-anchor handoff (nextVi !== null), dismiss any
      // in-flight label engagement on the incoming vi so the card
      // opens cleanly on top of a label-free vertex. Co-scheduled
      // with the phase transition in the same timer callback so
      // both state updates batch.
      if (nextVi !== null) {
        scheduleNextPhase(CONE_FALL_MS, after, () => {
          setEngagedVertexIdx((prev) => (prev === nextVi ? null : prev));
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

  // The rAF loop's slerp-completion notification. When the swing
  // phase's slerp finishes, advance to coneRising. We don't react
  // to the tick during other phases — the rAF loop also nulls
  // anchorAnim on completion during phases like unswinging.
  const swingCompletionCount = useRef(0);
  const [swingCompletionTick, setSwingCompletionTick] = useState(0);
  useEffect(() => {
    const p = phaseRef.current;
    if (p.kind === "swinging") {
      setPhase({ kind: "coneRising", vi: p.vi });
    }
    // unswinging also completes via the rAF loop's slerp finish
    // but we don't need to advance — the unswinging phase's own
    // timer (UNSWING_MS) takes care of the idle transition. (The
    // unswinging slerp here is no-op — we don't actually slerp on
    // unswing, we just let the existing rotation continue while
    // zoom retracts; see below.)
  }, [swingCompletionTick]);

  // anchoredVertexIdx is derived from phase. It's the vertex the
  // sphere is currently displaying as anchored, regardless of
  // which open/close sub-phase we're in. Used by:
  //   - anchorGeometry (cone + hex position)
  //   - VertexHover (which vertex shows engaged-state visuals)
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

  // hexOpen drives UnfoldingBillboard: true during widening + open,
  // false during collapsing/coneFalling (so the reverse cascade
  // plays out) and all other phases.
  const hexOpen = phase.kind === "widening" || phase.kind === "open";

  // Cone progress: derived from phase.
  //   coneHeightProgress: 0 in pre-rising phases, 1 from widening
  //     onwards through open, 0 again in coneFalling/unswinging/idle
  //     (CSS transitions handle the actual interpolation).
  //   coneWidthProgress: 0 during coneRising, 1 during widening +
  //     open, 0 during collapsing onwards.
  //
  // Each is driven by the CSS transition on the cone group's style,
  // with phase-specific transition-duration to match the timing we
  // want for that segment.
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

  // Click on an assigned vertex. Behavior depends on current phase:
  //   - idle: kick off the open sequence (phase = swinging)
  //   - swinging/coneRising/widening on SAME vertex: no-op (already
  //     in-flight toward this vertex)
  //   - any active phase on a DIFFERENT vertex: trigger the close
  //     cascade, with nextVi set so we hop to swinging the new
  //     vertex after coneFalling completes
  //   - open on SAME vertex: no-op
  //   - open on DIFFERENT vertex: start close cascade with nextVi
  const handleDotClick = useCallback(
    (vi: number) => {
      const v = mesh.vertices[vi];
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
      // Also dismiss any in-flight label engagement for THIS vi —
      // the card is about to supplant the label as the project's
      // presentation. Co-scheduling the engagement clear with the
      // phase transition keeps the two state updates in one
      // event-handler tick so React batches them; doing it from a
      // useEffect would be a derived-state-via-effect anti-pattern.
      if (p.kind === "idle" || p.kind === "unswinging") {
        setEngagedVertexIdx((prev) => (prev === vi ? null : prev));
        setPhase({ kind: "swinging", vi });
        return;
      }
      // From any active open-direction phase to a DIFFERENT vertex,
      // start the close cascade with nextVi set. The vi we're
      // closing from is the one currently being displayed.
      if (
        p.kind === "swinging" ||
        p.kind === "coneRising" ||
        p.kind === "widening" ||
        p.kind === "open"
      ) {
        setPhase({ kind: "collapsing", vi: p.vi, nextVi: vi });
        return;
      }
      // From a close-direction phase (collapsing / coneFalling),
      // update nextVi so the chain ends at the new target rather
      // than at idle. Don't interrupt the in-progress phase —
      // letting it complete keeps motion legible.
      if (p.kind === "collapsing") {
        setPhase({ ...p, nextVi: vi });
        return;
      }
      if (p.kind === "coneFalling") {
        setPhase({ ...p, nextVi: vi });
        return;
      }
    },
    [mesh.vertices],
  );

  // ─── Dismissal (Stage 4) ─────────────────────────────────────
  //
  // Triggers the close cascade with nextVi = null (full dismiss).
  // From idle/unswinging: no-op. From any active phase: collapse
  // the visuals, run the reverse choreography, then unswing the
  // sphere back to base zoom + restore world-Y cruise axis.
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
  }, []);

  // Cleanup all timers on unmount.
  useEffect(() => {
    return () => {
      clearPhaseTimer();
    };
  }, []);

  // ESC to dismiss.
  useEffect(() => {
    if (anchoredVertexIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") releaseAnchor();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anchoredVertexIdx, releaseAnchor]);

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
  // Note: do NOT clear engagement here. The hex card (Stage 3) is a
  // SIBLING div of the SVG inside the stage; when the cursor moves
  // from SVG-only space to over the card, the SVG fires pointerleave
  // even though the cursor is still within the stage's interactive
  // area. Clearing engagement here would dismiss the label
  // immediately whenever the user grazes the card region — even
  // when their actual target is a different vertex. Engagement
  // clearing lives on the stage div's pointerleave (see below),
  // which fires only when the cursor exits the entire stage.
  const handleSvgPointerLeave = useCallback(() => {
    // Intentionally empty — cursorPos stays so the collapse-timer
    // effect can still evaluate distance even while the cursor is
    // over the card. The card's own pointerdown/click handlers
    // prevent interactions from leaking through.
  }, []);

  // Stage-level pointerleave: cursor fully exits the stage div.
  // THIS is the right place to clear engagement (the user has
  // genuinely walked away from the sphere area).
  const handleStagePointerLeave = useCallback(() => {
    cursorPos.current = null;
    setEngagedVertexIdx(null);
  }, []);

  // Collapse timer: starts when the cursor moves off the engaged dot's
  // hit target (without re-entering it). Cancelled if the cursor returns
  // to the dot before expiry. On expiry, engagement releases — title
  // runs its dismissal animation (flash + untype) via the VertexHover's
  // engaged=false transition.
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Long enough that the type-in animation (800ms) completes plus
  // a comfortable read window before any dismissal could fire. The
  // timer is what gives the user time to read the title even when
  // their cursor has drifted off the dot. Earlier value (1200ms)
  // could expire while the title was still partway through typing
  // — felt like the label was being snatched away.
  const COLLAPSE_MS = 2500;
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
          const vi = getAnchoredVi();
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
          // Notify the hex-billboard effect that the swing has just
          // settled. Bump a counter ref + sync to a state setter so
          // the effect re-runs (refs don't trigger re-renders).
          swingCompletionCount.current += 1;
          setSwingCompletionTick(swingCompletionCount.current);
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
          // Auto-rotate around autoRotateAxis. Gated by phase:
          //   idle / unswinging       → full-speed cruise (world-Y)
          //   open                    → anchored 0.6× rotation
          //                             around the anchored vertex
          //   any in-flight phase     → no auto-rotation (the cone
          //     (coneRising/widening/   + hex choreography plays
          //      collapsing/coneFall)   against a still backdrop)
          //
          // The hover cycle (decel → hold → resume on dot hover)
          // only modulates speed during idle. Once anchored, the
          // anchored 0.6× speed is steady — no per-hover cycle.
          const p = phaseRef.current.kind;
          const rotationActive =
            p === "idle" || p === "unswinging" || p === "open";
          if (rotationActive) {
            const speedMul =
              p === "open"
                ? 1 // anchored rotation is steady at 0.6× via anchorMul below
                : computeHoverSpeedMul(now, hoverCycleStart.current);
            if (
              p !== "open" &&
              speedMul >= 1 &&
              hoverCycleStart.current !== null
            ) {
              hoverCycleStart.current = null;
            }
            if (speedMul > 0) {
              const anchorMul = p === "open" ? ANCHOR_AUTO_SPEED_MUL : 1;
              const angle = AUTO_ANGULAR_SPEED * speedMul * anchorMul * dtSec;
              const axis = autoRotateAxis.current;
              const delta = fromAxisAngle(axis.x, axis.y, axis.z, angle);
              applyQ(quatMultiply(delta, latestQ.current));
            }
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

  // Wheel handler — forwards deltaY up to the parent, which owns the
  // userZoom state and applies the resulting transform on the
  // measured cutoutTarget (globeScaleHost in LandingView). That
  // arrangement keeps a single source of truth for the visible
  // sphere size: BreathingMesh measures the same DOM element that
  // gets the transform, so its cutout tracks zoom + anchored state
  // automatically via getBoundingClientRect's post-transform read.
  //
  // The listener is attached imperatively (not via onWheel JSX)
  // because React's synthetic wheel events are passive by default
  // and can't preventDefault — and we need to suppress the browser's
  // own ctrl+wheel page zoom on top of the sphere.
  const stageRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !onWheelZoom) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      onWheelZoom(e.deltaY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheelZoom]);

  // Notify the parent whenever anchored state changes so it can
  // apply the matching transform on globeScaleHost.
  useEffect(() => {
    onAnchoredChange?.(anchoredVertexIdx !== null);
  }, [anchoredVertexIdx, onAnchoredChange]);

  // (Anchored-vertex label dismissal happens at the transition
  // sites that move INTO an anchored phase:
  //   - handleDotClick → setPhase(swinging) clears engagement on
  //     the incoming vi in the same event-handler tick.
  //   - scheduleNextPhase for coneFalling → swinging (cross-anchor
  //     handoff) fires the same clear in its timer callback.
  // Doing it at the transition site instead of in a useEffect
  // avoids the derived-state-via-effect pattern.)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Anchored + pointerdown on bare sphere/background (dots stop
      // propagation of pointerdown so we only get here when the
      // user is targeting the sphere itself, not a vertex) = the
      // user wants to drag rather than read. Dismiss the card and
      // start the drag in the same gesture; the reverse
      // choreography plays out underneath the user's drag motion.
      if (getAnchoredVi() !== null) {
        releaseAnchor();
      }
      dragging.current = true;
      didDrag.current = false;
      angularVelocityYaw.current = 0;
      angularVelocityPitch.current = 0;
      amplitudeYaw.current = 0;
      amplitudePitch.current = 0;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      lastTime.current = performance.now();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [releaseAnchor],
  );

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

  // ─── Anchored-vertex screen geometry (hex billboard + cone) ──
  //
  // When anchored, derive the screen-space position of the anchored
  // vertex from `projected[]`, then compute:
  //   - `coneTrianglePoints`: the three corners of the projection
  //     beam (apex at the dot, top wide at the hex's base level),
  //     used as <polygon> points.
  //   - `hexCx, hexCy`: where the UnfoldingBillboard host should be
  //     positioned (in viewBox / stage-div pixel space — they match
  //     since the SVG is 1:1 with the stage div).
  //
  // Everything bails out to null when not anchored — the JSX guards
  // on it. Geometry recomputes each frame because the rotation
  // continues at ANCHOR_AUTO_SPEED_MUL × cruise once settled, so the
  // dot's screen position is drifting (slowly) all the time. The
  // anchor-axis math keeps the drift below the perceptible threshold
  // for the dot's POSITION, but tiny float wobble keeps anchorGeometry
  // stable across renders by way of being deterministic.
  const anchorGeometry = useMemo(() => {
    if (anchoredVertexIdx === null) return null;
    const dot = projected[anchoredVertexIdx];
    if (!dot) return null;
    const hexRadius = radius * HEX_RADIUS_RATIO;
    const hexOffset = radius * HEX_OFFSET_RATIO;
    // Hex sits directly above the dot. The bottom-most point of the
    // hex (the corner pointing straight down at 6 o'clock) is
    // `hexOffset` above the dot. UnfoldingBillboard renders pointed-
    // up (corner 0 at 12 o'clock, corner 3 at 6 o'clock), so its
    // bottom corner is at +hexRadius below the hex center.
    //
    // Therefore: hexCenter.y = dot.y - hexOffset - hexRadius.
    const hexCx = dot.sx;
    const hexCy = dot.sy - hexOffset - hexRadius;
    // Cone triangle: apex at the dot (a couple px above the dot
    // center so we don't paint over it), top wide-spread at the
    // hex's base level. Half-width at the top = tan(half_angle) ×
    // cone_height.
    const coneHalfRad = (CONE_HALF_ANGLE_DEG * Math.PI) / 180;
    const coneTopY = dot.sy - hexOffset; // hex's bottom edge
    const coneBottomY = dot.sy - 2; // just above the dot
    const coneHeight = Math.abs(coneBottomY - coneTopY);
    const coneTopHalfW = Math.tan(coneHalfRad) * coneHeight;
    // CW from the apex: apex at the dot, top-left, top-right.
    const coneTrianglePoints = [
      `${dot.sx.toFixed(1)},${coneBottomY.toFixed(1)}`,
      `${(dot.sx - coneTopHalfW).toFixed(1)},${coneTopY.toFixed(1)}`,
      `${(dot.sx + coneTopHalfW).toFixed(1)},${coneTopY.toFixed(1)}`,
    ].join(" ");
    return {
      dotX: dot.sx,
      dotY: dot.sy,
      hexCx,
      hexCy,
      hexRadius,
      coneTrianglePoints,
      coneTopY,
      coneBottomY,
      coneTopHalfW,
    };
  }, [anchoredVertexIdx, projected, radius]);

  // Project for the anchored vertex (for billboard title content).
  const anchoredProject =
    anchoredVertexIdx !== null
      ? assignmentByVertex.get(anchoredVertexIdx)
      : undefined;

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
      ref={stageRef}
      className={styles.stage}
      style={{
        width: stageSize,
        height: stageSize,
        // No transform here — both the anchored zoom AND user zoom
        // are applied by LandingView on globeScaleHost (the element
        // BreathingMesh measures for its cutout). This file owns
        // ROTATION (via projected[] math) and SHAPE; LandingView
        // owns SCALING + POSITIONING. Keeping one transform stack
        // on one DOM element means the BreathingMesh cutout tracks
        // the visible sphere without manual multipliers.
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        handlePointerUp();
        handleStagePointerLeave();
      }}
      onClickCapture={(e) => {
        if (didDrag.current) e.preventDefault();
      }}
      onClick={() => {
        // Background-click dismissal (Stage 4). Dot hit-targets stop
        // propagation, and the billboard is rendered in a sibling
        // div whose own clicks don't bubble through here unless they
        // hit the surrounding empty area — those count as background
        // and should dismiss. If didDrag is set, the click was a
        // drag-release and we ignore it.
        if (didDrag.current) return;
        if (getAnchoredVi() !== null) releaseAnchor();
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

          {/* Projection cone gradient. Used for the projection beam
              from the anchored dot up to the hex's base. userSpaceOnUse
              with anchor-anchored y1/y2 so the gradient flows along
              the beam's axis regardless of where the anchor sits on
              screen. Filled at runtime via the cone's <linearGradient>
              attributes — this is just the stop palette. The gradient
              ramps from bright-with-some-opacity at the apex (dot) to
              fully-transparent at the top (hex base), so the beam
              fades out toward the hex rather than ending in a hard
              edge. The bias is shifted toward the bottom (offset 0.5
              keeps the top half nearly transparent) so the hex floats
              cleanly above the cone's brightest region. */}
          <linearGradient id="ph-cone-gradient" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(220, 235, 255, 0.0)" />
            <stop offset="65%" stopColor="rgba(180, 210, 255, 0.18)" />
            <stop offset="100%" stopColor="rgba(220, 235, 255, 0.55)" />
          </linearGradient>

          {/* Soft outer-blur for the cone edges — keeps the beam from
              looking like a hard polygon. stdDeviation in viewBox
              units; larger values make the cone hazier. */}
          <filter
            id="ph-cone-blur"
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
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

        {/* ─── Projection cone (Stage 3) ──────────────────────────
            Light-beam from the anchored dot upward to the hex base.
            Two nested <g> transforms drive the choreography:
              - outer: scale Y from 0 → 1 (cone rises). Transition
                duration matches CONE_RISE_MS (open) or CONE_FALL_MS
                (close). Origin at the dot so the cone grows UP from
                the vertex.
              - inner: scale X from 0 → 1 (cone widens). Transition
                duration matches the WIDENING_MS × CONE_WIDEN_FRACTION
                (open) or COLLAPSING_MS (close). Origin at the dot.
            The polygon and edge lines inside are drawn at FULL SIZE
            always; only the transforms move. transform-box: fill-box
            so the % origin resolves against the cone polygon's bbox.
            Fill is the linearGradient (also drawn at full size). */}
        {anchorGeometry && (
          <g
            style={{
              transform: `scaleY(${coneHeightProgress})`,
              transformOrigin: `${anchorGeometry.dotX}px ${anchorGeometry.coneBottomY}px`,
              transformBox: "view-box",
              transition: `transform ${coneHeightTransitionMs}ms ease-out`,
            }}
            pointerEvents="none"
          >
            <g
              style={{
                transform: `scaleX(${coneWidthProgress})`,
                transformOrigin: `${anchorGeometry.dotX}px ${anchorGeometry.coneBottomY}px`,
                transformBox: "view-box",
                transition: `transform ${coneWidthTransitionMs}ms ease-out`,
              }}
            >
              <linearGradient
                id="ph-cone-gradient-instance"
                gradientUnits="userSpaceOnUse"
                x1={anchorGeometry.dotX}
                y1={anchorGeometry.coneBottomY}
                x2={anchorGeometry.dotX}
                y2={anchorGeometry.coneTopY}
              >
                <stop offset="0%" stopColor="rgba(220, 235, 255, 0.55)" />
                <stop offset="55%" stopColor="rgba(180, 210, 255, 0.22)" />
                <stop offset="100%" stopColor="rgba(220, 235, 255, 0.0)" />
              </linearGradient>
              {/* Soft blurred fill pass — wider feel. */}
              <polygon
                points={anchorGeometry.coneTrianglePoints}
                fill="url(#ph-cone-gradient-instance)"
                filter="url(#ph-cone-blur)"
              />
              {/* Crisp fill pass on top — gives the beam definition. */}
              <polygon
                points={anchorGeometry.coneTrianglePoints}
                fill="url(#ph-cone-gradient-instance)"
                opacity={0.85}
              />
              {/* Edge highlights along the two slanted sides of the
                  triangle. Stroked lines, semi-transparent, blend
                  the cone into surrounding space without a hard
                  polygon outline. */}
              <line
                x1={anchorGeometry.dotX}
                y1={anchorGeometry.coneBottomY}
                x2={anchorGeometry.dotX - anchorGeometry.coneTopHalfW}
                y2={anchorGeometry.coneTopY}
                stroke="rgba(220, 235, 255, 0.4)"
                strokeWidth={1}
                strokeLinecap="round"
              />
              <line
                x1={anchorGeometry.dotX}
                y1={anchorGeometry.coneBottomY}
                x2={anchorGeometry.dotX + anchorGeometry.coneTopHalfW}
                y2={anchorGeometry.coneTopY}
                stroke="rgba(220, 235, 255, 0.4)"
                strokeWidth={1}
                strokeLinecap="round"
              />
            </g>
          </g>
        )}
      </svg>

      {/* ─── Hexagonal billboard (Stage 3) ──────────────────────
          The hex unfolds above the anchored vertex via the
          UnfoldingBillboard component. It's an HTML overlay
          (absolutely positioned on the stage div) rather than an
          SVG element because the component owns its own SVG and
          HTML content layer. Position is in stage-div pixel space,
          which matches the parent SVG's viewBox 1:1.
          Pointer events isolated to the billboard itself so the
          underlying sphere/dot hit-targets keep working around it.
          Rendered always while anchored so the close-cascade plays
          out even after engagedVertexIdx clears.
       */}
      {anchorGeometry && (
        <div
          style={{
            position: "absolute",
            left: anchorGeometry.hexCx,
            // The hex billboard's host is centered (translate -50%
            // -50%) on its own internal origin. UnfoldingBillboard's
            // stage-0 collapsed dot sits at that origin. So setting
            // `top: dotY` puts the collapsed dot exactly on the
            // anchored vertex; setting `top: hexCy` puts the
            // unfolded hex's center at its final position. We lerp
            // between them via coneHeightProgress so the dot
            // visually "shoots out" of the vertex along the cone as
            // the cone height grows.
            top:
              anchorGeometry.dotY +
              (anchorGeometry.hexCy - anchorGeometry.dotY) * coneHeightProgress,
            transform: "translate(-50%, -50%)",
            // CSS transition on `top` ONLY during the cone
            // rise/fall phases. During swinging, the dot's screen
            // position moves frame-by-frame as the slerp runs —
            // we want the hex to track it 1:1, not lag behind. A
            // transition here would animate from the previous
            // render's top to the current render's top, smearing
            // the hex through space behind the moving dot.
            transition:
              phase.kind === "coneRising" || phase.kind === "coneFalling"
                ? `top ${coneHeightTransitionMs}ms ease-out`
                : "none",
            pointerEvents: hexOpen ? "auto" : "none",
            zIndex: 2,
          }}
          onPointerDown={(e) => {
            // Block pointerdown so the stage's drag handler doesn't
            // start a drag when the user clicks on the hex card.
            // (The stage's pointerdown also releases the anchor as
            // a "user wants to drag" intent — neither should fire
            // when the user is interacting with the card itself.)
            e.stopPropagation();
          }}
          onClick={(e) => {
            // Stop the click from bubbling to the stage-bg dismiss.
            // Clicking the hex itself shouldn't release the anchor.
            e.stopPropagation();
          }}
        >
          <UnfoldingBillboard
            open={hexOpen}
            radius={anchorGeometry.hexRadius}
            stageDelay={90}
            spring={{ stiffness: 260, damping: 18 }}
          >
            {anchoredProject && (
              <div
                style={{
                  fontFamily: HOVER_DOT_FONT_FAMILY,
                  fontSize: 18,
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                  color: "rgba(245, 248, 255, 0.96)",
                  textShadow:
                    "0 0 6px rgba(180, 210, 255, 0.6), 0 0 18px rgba(140, 180, 255, 0.35)",
                  padding: "0 12%",
                  lineHeight: 1.25,
                }}
              >
                {anchoredProject.title}
              </div>
            )}
          </UnfoldingBillboard>
        </div>
      )}

      {/* Backdrop dismiss target (Stage 4). Active only while
          anchored. Sits behind the SVG (lower z-index) so it
          doesn't block sphere interaction, but a click on it
          (anywhere on the stage div NOT covered by a dot's
          hit-target) releases the anchor. The SVG's pointer
          surface is opaque-to-events on dots only; clicks on the
          background propagate up to this handler via the stage
          div's onClick. */}
    </div>
  );
}
