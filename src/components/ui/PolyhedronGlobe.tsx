"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { geodesic, type Mesh } from "@/lib/polyhedra";
import { projectLandingUrl, type Project } from "@/lib/projects";
import {
  fromAxisAngle,
  multiply as quatMultiply,
  toMatrix3,
  type Quat,
} from "@/lib/quaternion";
import { useLatestRef } from "@/hooks/use-latest-ref";
import { useAnchorPhase } from "@/hooks/use-anchor-phase";
import { useAutoRotate } from "@/hooks/use-auto-rotate";
import { useDragMomentum } from "@/hooks/use-drag-momentum";
import { useGraphics } from "@/hooks/use-graphics";
import { useHoverCrosshair } from "@/hooks/use-hover-crosshair";
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
// Label engagement collapse timeout. When the cursor leaves an
// engaged dot's hit target (and doesn't return), the label
// dismisses after this many ms — long enough to cover the typing
// animation (800ms) + a comfortable ~3s read window.
const COLLAPSE_MS = 4000;
// Intent gating for label engagement: a dot's mouseenter only
// counts as user-intent if a pointermove fired within this many
// ms before it. Filters out spurious enters from sphere rotation
// drifting a dot under a motionless cursor.
const INTENT_WINDOW_MS = 100;

/**
 * Tessellated icosphere with optional per-vertex project assignments —
 * the museum's landing-page centerpiece.
 *
 * For the user-visible flow, hook composition, rAF orchestrator,
 * pointer routing model, and touch-hover-mode state-machine quirks,
 * see CONTEXT/internal_docs/globe.md.
 *
 * This component owns:
 *   - Mesh geodesy + per-frame projection (rotate, cull, sort, paint).
 *   - Hover engagement (intent gating, collapse-on-leave timer).
 *   - Pointer routing dispatch (tap-mode handlers; hover-mode goes to
 *     useHoverCrosshair).
 *   - The rAF orchestrator that composes the three rotation drivers.
 *   - The SVG + hex-billboard JSX.
 *
 * The parent (LandingView) owns userZoom, the .globeWrap surface
 * that gives drag/dismiss a viewport-sized hit region, and the
 * anchored translateY. We report anchor changes upward via
 * onAnchoredChange.
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
  /**
   * Touch input mode. "tap" (default) = current behavior; finger
   * drag rotates the sphere, finger-tap on a vertex's hit target
   * opens the card. "hover" = a virtual crosshair follows the
   * finger; the vertex nearest the crosshair gets label engagement
   * (preview-on-hover, no card open). A tap-without-much-movement
   * in hover mode opens whichever vertex the crosshair is nearest
   * to — so the user can preview titles by sliding around, then
   * commit with a lift. Defaults to "tap" for backward compat.
   */
  touchMode?: "tap" | "hover";
  /**
   * Current user zoom factor. Used to scale the drag rate inversely
   * with zoom — at higher zoom the same finger motion covers
   * less of the (visually larger) sphere, so the rotation feels
   * too fast unless we slow it down proportionally. Defaults to 1.
   */
  userZoom?: number;
  /**
   * NDC-X target for anchored vertices. Overrides the default
   * (-0.13) so callers can shift the horizontal anchor toward 0 on
   * narrow viewports — the hex card then sits more centered on
   * screen rather than leaning toward the right edge where it'd
   * otherwise clip on small phones. Passed straight to
   * useAnchorPhase. Default kept here so callers who don't care
   * get the museum's traditional desktop framing.
   */
  anchorNdcX?: number;
  /**
   * Imperative escape hatch for the parent to release the anchor
   * from outside this component. The globe assigns `releaseAnchor`
   * into `dismissRef.current`; the parent calls `dismissRef.current?.()`
   * from a UI element outside the stage subtree (e.g. an explicit
   * close button on the hex card). The background-click dismiss
   * path doesn't need this — it goes through `surfaceHandlersRef`
   * below — but having a direct dismiss callable is useful for
   * deliberate UI close affordances.
   */
  dismissRef?: React.MutableRefObject<(() => void) | null>;
  /**
   * Imperative bundle of the globe's pointer + click handlers, lifted
   * to the parent so they can be bound on a LARGER surface than the
   * internal stage div. The globe assigns its handlers into
   * `surfaceHandlersRef.current` and stops binding them to its own
   * stage div when the ref is provided (parent owns the surface).
   *
   * Rationale: PolyhedronGlobe's stage div sizes itself to
   * `radius*2 + 200` and lives inside a transformed wrapper
   * (.globeScaleHost > .globeZoomLayer). At low userZoom or after
   * the anchored "stage view" translateY, the stage div's hit
   * region only covers a fraction of the viewport — taps anywhere
   * outside that bbox never reach the globe's drag-rotate /
   * dismiss-anchor handlers. Lifting the bind point to the
   * fullscreen .globeWrap ancestor makes the ENTIRE landing view
   * an active surface for those gestures, with no logic changes
   * inside the globe.
   *
   * The handlers themselves are unchanged useCallbacks — only their
   * attachment point moves. Drag math uses clientX/clientY (surface-
   * agnostic) so widening the surface is safe.
   */
  surfaceHandlersRef?: React.MutableRefObject<{
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
    onPointerLeave: (e: React.PointerEvent) => void;
    onClick: (e: React.MouseEvent) => void;
  } | null>;
}

// (AUTO_ANGULAR_SPEED lives in use-auto-rotate.ts — the only
// consumer is the per-frame auto-rotate driver.)
//
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
const AXIAL_TILT_DEG = 18;
// First-paint user rotation: a small pitch around world-X so the
// sphere shows a bit more of its northern hemisphere on initial
// load rather than reading as a perfectly equator-on view.
const INITIAL_PITCH_RAD = (15 * Math.PI) / 180;

// ─── Anchor (click-to-anchor) ────────────────────────────────
// Clicking an assigned vertex anchors the sphere: the clicked vertex
// swings to a fixed screen position (the "anchor pose"), and auto-
// rotation continues around the AXIS THROUGH THAT VERTEX at a reduced
// speed — so the anchored point stays put while the rest of the globe
// spins around it.
//
// The target screen position the anchored vertex lands on
// ((-0.13, 0.55) — upper portion of the sphere, slightly left of
// center, leaving the lower area free for the hex billboard to
// project upward into) lives inside useAnchorPhase as the constants
// ANCHOR_NDC_X / ANCHOR_NDC_Y. It's part of the state machine's
// projection-reverse math and belongs with that machine.
//
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
//
// Phase timing constants (ANCHOR_SWING_MS, CONE_RISE_MS,
// WIDENING_MS,
// CONE_WIDEN_FRACTION, COLLAPSING_MS, CONE_FALL_MS, UNSWING_MS)
// live with the state machine — see useAnchorPhase. They're not
// imported here because no JSX in this file references them
// directly any more; the hook owns its own timing.

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
// % of stage height to translate down when anchored. The sphere
// drops below its idle resting position to make room for the
// unfolding hex card above. Mobile devices need a deeper drop
// because the hex card claims more vertical space relative to a
// narrow viewport — see ANCHOR_ZOOM_TRANSLATE_Y_PCT_MOBILE below
// and the viewport-conditional pick in LandingView.
export const ANCHOR_ZOOM_TRANSLATE_Y_PCT = 14;
export const ANCHOR_ZOOM_TRANSLATE_Y_PCT_MOBILE = 22;
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

// (Touch hover-mode tunings live with the implementation in
// use-hover-crosshair.ts: CROSSHAIR_LINGER_MS, TAP_MAX_MS,
// TAP_MAX_PX, CROSSHAIR_ENGAGEMENT_RADIUS, POINTERUP_HESITATION_MS.)

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
  touchMode = "tap",
  userZoom = 1,
  anchorNdcX,
  dismissRef,
  surfaceHandlersRef,
}: PolyhedronGlobeProps) {
  // Mesh is a stable per-frequency constant. Memoize so we don't regenerate
  // 80 vertices + 80 faces on every render.
  const mesh: Mesh = useMemo(() => geodesic(frequency), [frequency]);

  // Graphics settings — read once per render. The hook subscribes
  // to localStorage changes so cross-tab + same-tab updates flow
  // through automatically. Individual toggles below gate visual
  // passes (edge-glow halo, background radial, per-vertex glow);
  // CSS-only toggles (edgeGlow, backgroundHalo) ALSO have
  // [data-graphics-*] selectors in globals.css as a redundant
  // safety net — if a future render branch forgets to gate, the
  // CSS still hides the layer. The JSX guards prevent the work
  // from happening at all, which is what we want for perf.
  const { settings: graphics } = useGraphics();

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

  // ─── Drag-momentum ──────────────────────────────────────────
  //
  // Gesture state + post-release exponential-decay physics live in
  // useDragMomentum. The pointer handlers below call begin/feed/end
  // to drive the state machine; the main rAF loop calls
  // dragMomentum.tick() to apply momentum-decay rotations between
  // gestures. didDrag() is read by the click-vs-drag guard in
  // handleSurfaceClick. See use-drag-momentum.ts for the full API.
  const dragMomentum = useDragMomentum({ latestQRef: latestQ, applyQ });

  // Per-move bookkeeping owned by the pointer handlers (NOT the
  // momentum hook). Holds the prior pointer centroid + the
  // performance.now() of the most recent move so handlePointerMove
  // can compute dx/dy + dt for the instantaneous-rate calculation,
  // and handlePointerUp can apply the stationary-finger guard. The
  // hook deliberately doesn't track these because they're consumed
  // by other handler-local concerns (pinch baseline, multi-pointer
  // rebaselining) that don't belong to drag-momentum's physics.
  const lastMove = useRef({ x: 0, y: 0, t: 0 });

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

  // Hover-gesture bookkeeping. Single ref bundling all per-gesture
  // hover state that doesn't render — same pattern as `drag` and
  // `crosshairGesture` above. `engagedVertexIdx` stays separate as
  // React state because it drives VertexHover renders.
  //
  // Field roles:
  //   cycleStart      — performance.now() when the sphere hover-
  //                     deceleration cycle started; null when not
  //                     in a cycle. The rAF loop reads this to
  //                     interpolate the speed multiplier.
  //   lastMoveAt      — performance.now() of the last pointermove
  //                     on the SVG. handleDotEnter uses it to gate
  //                     "intent" vs "geometry drift" — a dot's
  //                     mouseenter only counts as user intent if a
  //                     mousemove fired within INTENT_WINDOW_MS.
  //   cursorPos       — last pointer position in viewBox coords;
  //                     null when the cursor is outside the SVG.
  //                     The collapse-timer effect uses it each
  //                     render to check whether the cursor is
  //                     still over the engaged dot.
  type HoverGesture = {
    cycleStart: number | null;
    lastMoveAt: number;
    cursorPos: { x: number; y: number } | null;
  };
  const hover = useRef<HoverGesture>({
    cycleStart: null,
    lastMoveAt: 0,
    cursorPos: null,
  });

  // ─── Anchor state machine ───────────────────────────────────
  //
  // The multi-phase open/close sequence (idle → swinging → coneRising
  // → widening → open → collapsing → coneFalling → unswinging → idle)
  // lives in useAnchorPhase. This call returns the full API: phase
  // state, refs the rAF loop reads (anchorAnim, anchoredAxis,
  // phaseRef), the rAF→state-machine signal (notifySwingComplete),
  // all derived values for JSX (anchoredVertexIdx, hexOpen, cone
  // progress + transition durations), and the user-action handlers
  // (handleDotClick, releaseAnchor).
  //
  // Declared AFTER engagedVertexIdx + hover so the hook can receive
  // setEngagedVertexIdx (via clearEngagementFor) and read the hover
  // ref. The handleDotEnter callback below uses anchor.getAnchoredVi
  // to suppress engagement on a vertex that is already anchored.
  const anchor = useAnchorPhase({
    meshVertices: mesh.vertices,
    latestQRef: latestQ,
    autoRotateAxisRef: autoRotateAxis,
    hoverCycleStartRef: hover,
    clearEngagementFor: (vi) =>
      setEngagedVertexIdx((prev) => (prev === vi ? null : prev)),
    anchorNdcX,
  });

  // Expose a dismiss hook upward: the landing view's outer shell
  // catches background clicks (outside corner UI / hex card / vertex
  // dots) and calls this to release the anchor. The stage div's own
  // onClick still works for clicks inside the sphere's transformed
  // bbox; this ref covers everywhere else. Effect-mounted so the
  // ref tracks the current anchor instance — `releaseAnchor` is
  // re-created on every render of useAnchorPhase, and we want
  // dismissRef.current to always be the latest callable. The
  // landing view never reads it during render, only on click.
  useEffect(() => {
    if (!dismissRef) return;
    dismissRef.current = () => {
      if (anchor.getAnchoredVi() !== null) anchor.releaseAnchor();
    };
    return () => {
      dismissRef.current = null;
    };
  }, [dismissRef, anchor]);

  const handleDotEnter = useCallback(
    (vi: number) => {
      const now = performance.now();
      const intent = now - hover.current.lastMoveAt < INTENT_WINDOW_MS;
      if (!intent) {
        // Geometry drift — dot rolled under a motionless cursor. Ignore.
        return;
      }
      // While a vertex is anchored (card open), suppress label
      // engagement on THAT vertex — the card has already supplanted
      // the label as the presentation of that project. Hovering it
      // shouldn't re-engage the label.
      if (anchor.getAnchoredVi() === vi) {
        return;
      }
      // Different vertex → new engagement + maybe new hover cycle.
      setEngagedVertexIdx((prev) => {
        if (prev === vi) return prev; // same dot, already engaged
        // Trigger a fresh hover cycle if the sphere is back near cruise.
        const currentMul = computeHoverSpeedMul(now, hover.current.cycleStart);
        if (currentMul >= HOVER_RETRIGGER_THRESHOLD) {
          hover.current.cycleStart = now;
        }
        return vi;
      });
    },
    [anchor],
  );

  // (Dot mouseleave is intentionally not handled — geometry drift
  // under a motionless cursor would fire it spuriously. Engagement
  // only releases via SVG-level leave or via a different dot's
  // intent-gated mouseenter.)

  // SVG-level pointer handlers.
  //
  // pointermove tracks two things via the `hover` bundle declared
  // up in the engagement model section:
  //   - hover.current.lastMoveAt timestamp (gates intent for
  //     dot-enter)
  //   - hover.current.cursorPos in viewBox coordinates (used by
  //     the per-frame check below to decide whether the cursor is
  //     currently over the engaged dot's hit target)
  //
  // pointerleave: cursor left the entire SVG. Belt-and-suspenders
  // dismiss — the per-frame check would also catch this once it
  // notices the cursor's last-known position is no longer over the
  // engaged dot, but pointerleave fires immediately.

  const handleSvgPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      hover.current.lastMoveAt = performance.now();
      // Convert client coords → SVG viewBox coords. The SVG fills its
      // wrapper at intrinsic size (we set width/height = stageSize),
      // so the math is a simple subtract-bounding-rect.
      const rect = e.currentTarget.getBoundingClientRect();
      hover.current.cursorPos = {
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
    hover.current.cursorPos = null;
    setEngagedVertexIdx(null);
  }, []);

  // Collapse timer: starts when the cursor moves off the engaged
  // dot's hit target (without re-entering it). Cancelled if the
  // cursor returns to the dot before expiry. On expiry, engagement
  // releases — title runs its dismissal animation (flash + untype)
  // via the VertexHover's engaged=false transition. Timeout
  // duration is COLLAPSE_MS (module scope).
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cleanup
  useEffect(() => {
    return () => {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
    };
  }, []);

  // Auto-rotate driver. Composes with anchor.tickSwing and
  // dragMomentum.tick in the rAF loop below as one of three
  // rotation drivers (priority-ordered: anchor swing → drag
  // momentum decay → auto-rotate). See use-auto-rotate.ts for the
  // phase gating + hover-cycle speed modulation.
  const autoRotate = useAutoRotate({
    phaseRef: anchor.phaseRef,
    latestQRef: latestQ,
    autoRotateAxisRef: autoRotateAxis,
    applyQ,
    computeSpeedMul: useCallback(
      (now: number) => computeHoverSpeedMul(now, hover.current.cycleStart),
      [],
    ),
    notifyHoverCycleSettled: useCallback(() => {
      if (hover.current.cycleStart !== null) {
        hover.current.cycleStart = null;
      }
    }, []),
    anchorSpeedMul: ANCHOR_AUTO_SPEED_MUL,
  });

  // ─── rAF rotation orchestrator ───────────────────────────────
  //
  // Each frame, try the rotation drivers in priority order:
  //   1. Anchor swing slerp (claims the frame entirely if active)
  //   2. Drag momentum decay (claims the frame if active)
  //   3. Auto-rotate (default; gated on phase + hover cycle)
  //
  // Each driver returns true if it applied a rotation, signaling
  // the next driver to bow out for this frame. Drivers own their
  // own state + physics; this loop is pure orchestration.
  useEffect(() => {
    let lastTick = performance.now();
    let frame: number;

    function tick(now: number) {
      const dt = now - lastTick;
      lastTick = now;
      const dtSec = dt / 1000;

      // Anchor swing claims rotation when active — drag momentum
      // and auto-rotate are paused during the swing. Hook owns the
      // slerp + settle logic; we just gate.
      if (anchor.tickSwing(now, applyQ)) {
        frame = requestAnimationFrame(tick);
        return;
      }

      if (!dragMomentum.isDragging() && !dragMomentum.tick(now, dtSec)) {
        autoRotate.tick(now, dtSec);
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
    onAnchoredChange?.(anchor.anchoredVertexIdx !== null);
  }, [anchor.anchoredVertexIdx, onAnchoredChange]);

  // (Anchored-vertex label dismissal happens at the transition
  // sites that move INTO an anchored phase:
  //   - handleDotClick → setPhase(swinging) clears engagement on
  //     the incoming vi in the same event-handler tick.
  //   - scheduleNextPhase for coneFalling → swinging (cross-anchor
  //     handoff) fires the same clear in its timer callback.
  // Doing it at the transition site instead of in a useEffect
  // avoids the derived-state-via-effect pattern.)

  // ─── Multi-pointer state ─────────────────────────────────────
  //
  // Active pointers tracked by pointerId. 1 pointer → drag using
  // that pointer's position. 2+ pointers → pinch + drag-on-
  // midpoint: the midpoint of all active pointers drives yaw/pitch
  // (so the user can still rotate while pinching), and the average
  // distance between pointers and the midpoint drives zoom.
  //
  // Map enables O(1) updates on pointermove without an extra
  // traversal. Insertion order is preserved which is convenient
  // for deterministic midpoint calculation.
  const activePointers = useRef<Map<number, { x: number; y: number }>>(
    new Map(),
  );
  // Last pinch reference distance — set on the 2nd pointer down
  // (or whenever we drop from 3+ → 2 pointers), updated on each
  // pointermove with 2+ pointers. The ratio between the new
  // distance and the last reference distance drives the zoom step.
  const lastPinchDistance = useRef<number | null>(null);

  // Touch-mode ref so handlers can read the current mode without
  // recreating on every prop change. The crosshair render is
  // gated on (touchMode === "hover" && crosshairPos) in the JSX,
  // so switching to Tap mode hides the crosshair visually
  // without needing an effect to clear state.
  const touchModeRef = useLatestRef(touchMode);
  // userZoom mirror: lets the drag handler scale its per-pixel
  // rotation rate inversely with zoom (so dragging a fixed pixel
  // distance always rotates the sphere the same amount visually,
  // not the same amount of underlying degrees).
  const userZoomRef = useLatestRef(userZoom);

  // Compute the centroid + average radius of all active pointers.
  // For 1 pointer: centroid = that pointer's pos, radius = 0.
  // For 2+: centroid is the geometric mean of positions, radius is
  // the average Euclidean distance from each pointer to the centroid.
  // Radius (not raw distance) generalizes pinch to 3+ fingers if
  // they ever happen (e.g., palm-rejection failure).
  //
  // useCallback (no deps) so consumers like useHoverCrosshair can
  // list it in their dependency arrays without invalidating their
  // own memoization on every render.
  const pointerCentroid = useCallback((): {
    x: number;
    y: number;
    radius: number;
    count: number;
  } => {
    const pts = activePointers.current;
    const n = pts.size;
    if (n === 0) return { x: 0, y: 0, radius: 0, count: 0 };
    let cx = 0;
    let cy = 0;
    for (const p of pts.values()) {
      cx += p.x;
      cy += p.y;
    }
    cx /= n;
    cy /= n;
    if (n === 1) return { x: cx, y: cy, radius: 0, count: 1 };
    let sumR = 0;
    for (const p of pts.values()) {
      sumR += Math.hypot(p.x - cx, p.y - cy);
    }
    return { x: cx, y: cy, radius: sumR / n, count: n };
  }, []);

  // Try to emit a pinch-zoom delta from a multi-pointer centroid.
  // Converts the radius-change ratio into a synthetic wheel deltaY
  // so the parent's existing onWheelZoom path handles the zoom —
  // wheel and pinch end up calibrated against the same
  // USER_ZOOM_WHEEL_SENSITIVITY. Returns true if a delta was emitted
  // (caller may want to update its rotation baseline accordingly).
  //
  // Math: zoom by exp(-deltaY * sensitivity). To produce the same
  // effective ratio newRadius/oldRadius, set deltaY = -ln(ratio) /
  // sensitivity. Filters sub-px jitter via the 0.5 threshold.
  //
  // Used identically by hover-mode and tap-mode pointermove paths
  // (extracted to remove the duplication).
  const tryEmitPinchZoom = useCallback(
    (c: { radius: number; count: number }): boolean => {
      if (
        c.count < 2 ||
        lastPinchDistance.current === null ||
        lastPinchDistance.current <= 0 ||
        c.radius <= 0 ||
        !onWheelZoom
      ) {
        return false;
      }
      const ratio = c.radius / lastPinchDistance.current;
      const syntheticDeltaY = -Math.log(ratio) / USER_ZOOM_WHEEL_SENSITIVITY;
      if (Math.abs(syntheticDeltaY) <= 0.5) return false;
      onWheelZoom(syntheticDeltaY);
      lastPinchDistance.current = c.radius;
      return true;
    },
    [onWheelZoom],
  );

  // Ref on the SVG so we can convert client coords → viewBox
  // coords from any handler. Used by hover-mode crosshair to
  // place itself in the same coord space as projected vertices.
  // Wrapped in useCallback with [radius] so it's stable across
  // renders that don't change the radius prop — pointer-event
  // handlers can list it as a dep without losing memoization.
  const svgRef = useRef<SVGSVGElement | null>(null);
  const clientToViewBox = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      return {
        x: ((clientX - rect.left) / rect.width) * (radius * 2 + 200),
        y: ((clientY - rect.top) / rect.height) * (radius * 2 + 200),
      };
    },
    [radius],
  );

  // Find the visible vertex nearest to a viewBox-space point.
  // Returns null if no vertex is within engagementRadius (in
  // viewBox units, which is the same coord space as projected[].sx/sy).
  // Restricted to ASSIGNED vertices since those are the only
  // ones a hover should engage / a tap should open.
  //
  // Doesn't use useLatestRef here because the value being mirrored
  // (`visibleVertices`) is computed much later in the component
  // body via useMemo on `projected`, and we need the ref available
  // up here so findNearestAssignedVertex (used in pointer handlers
  // below) can close over it. The mirror happens in a useEffect
  // further down, where visibleVertices is in scope.
  const visibleVerticesRef = useRef<
    Array<{ vi: number; sx: number; sy: number }>
  >([]);
  const findNearestAssignedVertex = useCallback(
    (
      point: { x: number; y: number },
      engagementRadius: number,
    ): number | null => {
      let best: number | null = null;
      let bestDist = engagementRadius * engagementRadius;
      for (const v of visibleVerticesRef.current) {
        if (!assignmentByVertex.has(v.vi)) continue;
        const dx = point.x - v.sx;
        const dy = point.y - v.sy;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDist) {
          bestDist = d2;
          best = v.vi;
        }
      }
      return best;
    },
    [assignmentByVertex],
  );

  // ─── Touch hover-mode crosshair (delegated to hook) ──────────
  // Owns the crosshair gesture state machine + mount/unmount + the
  // imperative position/opacity writers. See use-hover-crosshair.ts
  // for the full state machine including multi-finger lift
  // hesitation. We destructure the hook's return into local
  // variables — keeping them in a single `crosshair` object trips
  // the react-hooks/refs lint when `bindGroup` is used as `ref={…}`
  // (the rule infers the whole object is ref-related).
  const {
    onPointerDown: handleHoverPointerDown,
    onPointerMove: handleHoverPointerMove,
    onPointerUp: handleHoverPointerUp,
    visible: crosshairVisible,
    bindGroup: bindCrosshairGroup,
  } = useHoverCrosshair({
    touchMode,
    activePointersRef: activePointers,
    pointerCentroid,
    lastPinchDistanceRef: lastPinchDistance,
    tryEmitPinchZoom,
    clientToViewBox,
    findNearestAssignedVertex,
    anchor,
    setEngagedVertexIdx,
  });

  // Tap-mode (mouse + single-touch default) pointerdown: dismiss
  // any open anchor, register the pointer for drag tracking, seed
  // drag-momentum + last-move baselines.
  const handleTapPointerDown = useCallback(
    (e: React.PointerEvent, surface: HTMLElement) => {
      // Pointerdown on bare sphere while anchored = "dismiss and
      // start dragging in one gesture." Vertex dots stop click
      // propagation (not pointerdown anymore — see VertexHover), so
      // a press-on-vertex-then-drag also reaches here; if the
      // gesture turns out to be a tap, didDrag stays false and the
      // vertex's onClick still fires.
      if (anchor.getAnchoredVi() !== null) {
        anchor.releaseAnchor();
      }
      activePointers.current.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
      });
      const c = pointerCentroid();
      // Re-anchor the move baseline to the new centroid so a 1↔2
      // pointer transition doesn't produce a snap-rotation from a
      // stale prior centroid.
      lastMove.current.x = c.x;
      lastMove.current.y = c.y;
      lastPinchDistance.current = c.count >= 2 ? c.radius : null;
      if (!dragMomentum.isDragging()) {
        // Fresh gesture: clear prior momentum + velocity via
        // begin(); seed the move-timestamp baseline for the
        // stationary-finger guard.
        dragMomentum.begin();
        lastMove.current.t = performance.now();
      }
      // setPointerCapture is intentionally omitted in tap mode.
      // For mouse: the OS routes pointermove naturally to whichever
      // element is under the cursor, and React's event bubbling
      // gets those moves to the surface handler regardless. For
      // touch: a single-finger gesture works the same way; pinch
      // (count >= 2) keeps working because we track pointers via
      // activePointers on each down/up, not via formal capture.
      //
      // Why not capture: capture redirects the synthesized `click`
      // event to the captured element, so capturing on the surface
      // after pointerdown on a vertex would prevent the vertex's
      // onClick from firing — breaking tap-to-open.
      void surface;
    },
    // Deps list ONLY identities whose change should rebuild this
    // callback. Refs (touchModeRef, lastMove, activePointers,
    // lastPinchDistance) and stable callbacks (pointerCentroid) are
    // intentionally omitted — they're read fresh on each call, so
    // listing them would force unnecessary callback churn. Same
    // convention used by the other pointer handlers below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [anchor, dragMomentum],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Capture currentTarget into a local before delegating — React
      // synthetic events can have currentTarget reset between
      // handler frames, and the sub-handlers need the original
      // surface element for setPointerCapture.
      const surface = e.currentTarget as HTMLElement;
      if (touchModeRef.current === "hover") {
        handleHoverPointerDown(e, surface);
        return;
      }
      handleTapPointerDown(e, surface);
    },
    // Stable refs (touchModeRef) intentionally omitted; see the
    // handleTapPointerDown deps comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleHoverPointerDown, handleTapPointerDown],
  );

  // Tap-mode pointermove: track centroid delta as rotation input
  // for the sphere, feed the drag-momentum hook for release-fling
  // amplitude, and emit pinch zoom if multi-finger.
  const handleTapPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragMomentum.isDragging()) return;
      const pt = activePointers.current.get(e.pointerId);
      if (!pt) return;
      pt.x = e.clientX;
      pt.y = e.clientY;

      const now = performance.now();
      const dt = now - lastMove.current.t;
      if (dt === 0) return;

      const c = pointerCentroid();
      // Rotation: delta from prior centroid → yaw/pitch around world
      // axes. Multi-touch's midpoint behaves identically to a single
      // cursor for the rotation pipeline.
      const dx = c.x - lastMove.current.x;
      const dy = c.y - lastMove.current.y;

      // Scale drag rate inversely with userZoom so the perceived
      // rotation per finger-pixel feels constant across zoom levels.
      const dragRate = DRAG_RATE / Math.max(0.1, userZoomRef.current);
      const yawAngle = dx * dragRate;
      const pitchAngle = dy * dragRate;
      const yawRate = (1000 * yawAngle) / (1 + dt);
      const pitchRate = (1000 * pitchAngle) / (1 + dt);
      // Feed the momentum hook: it EMA-smooths yawRate/pitchRate
      // into the release amplitude and flips didDrag if movement
      // passed the click-vs-drag threshold.
      dragMomentum.feed({ dx, dy, yawRate, pitchRate });

      let next = latestQ.current;
      if (yawAngle !== 0) {
        next = quatMultiply(fromAxisAngle(0, 1, 0, yawAngle), next);
      }
      if (pitchAngle !== 0) {
        next = quatMultiply(fromAxisAngle(1, 0, 0, pitchAngle), next);
      }
      applyQ(next);

      tryEmitPinchZoom(c);

      lastMove.current.x = c.x;
      lastMove.current.y = c.y;
      lastMove.current.t = now;
    },
    // Stable refs (userZoomRef, lastMove, activePointers) +
    // pointerCentroid (useCallback-stable) intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dragMomentum, applyQ, tryEmitPinchZoom],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (touchModeRef.current === "hover") return handleHoverPointerMove(e);
      handleTapPointerMove(e);
    },
    // Stable refs (touchModeRef) intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleHoverPointerMove, handleTapPointerMove],
  );

  // Tap-mode pointerup. Remove the lifted pointer; if no pointers
  // remain, seal the drag-momentum amplitude so the rAF tick can
  // decay it (the throw-and-release fling). If pointers remain,
  // rebaseline the move + pinch references so the next pointermove
  // doesn't jump-rotate.
  const handleTapPointerUp = useCallback(
    (e?: React.PointerEvent) => {
      // Remove the lifted pointer. Undefined e (caller used
      // pointerleave with no event) clears all — covers "user
      // dragged off the surface" which ends the entire gesture.
      if (e) {
        activePointers.current.delete(e.pointerId);
      } else {
        activePointers.current.clear();
      }
      const c = pointerCentroid();

      if (c.count === 0) {
        if (!dragMomentum.isDragging()) return;
        const now = performance.now();
        dragMomentum.end(now, lastMove.current.t);
        lastPinchDistance.current = null;
        return;
      }
      // Still 1+ pointers — gesture continues with the remaining
      // set. Re-anchor everything to the new centroid + radius so
      // the next move doesn't jump-rotate or jump-pinch.
      lastMove.current.x = c.x;
      lastMove.current.y = c.y;
      lastMove.current.t = performance.now();
      lastPinchDistance.current = c.count >= 2 ? c.radius : null;
      // Clear EMA velocity — we want a clean delta-from-here on the
      // next move; otherwise inherited velocity feeds back through
      // the EMA after a finger-lift.
      dragMomentum.clearVelocity();
    },
    // Stable refs (activePointers, lastMove, lastPinchDistance) +
    // pointerCentroid (useCallback-stable) intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dragMomentum],
  );

  const handlePointerUp = useCallback(
    (e?: React.PointerEvent) => {
      if (touchModeRef.current === "hover") return handleHoverPointerUp(e);
      handleTapPointerUp(e);
    },
    // Stable refs (touchModeRef) intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleHoverPointerUp, handleTapPointerUp],
  );

  // Composite leave handler — pointerleave on the surface means
  // BOTH "lift the current pointer" (handlePointerUp) AND "stop
  // any hover-cycle / engagement bookkeeping the stage owns"
  // (handleStagePointerLeave). Pulled out so the same identity
  // can be bound to either the internal stage div OR the lifted
  // .globeWrap surface via surfaceHandlersRef.
  const handleSurfacePointerLeave = useCallback(
    (e: React.PointerEvent) => {
      handlePointerUp(e);
      handleStagePointerLeave();
    },
    [handlePointerUp, handleStagePointerLeave],
  );

  // Background-click dismissal. Fires on clicks that bubble up
  // from "bare" surface — dots and the hex card both stop bubble-
  // phase propagation, so this only runs when the click missed
  // every interactive child. The didDrag guard suppresses clicks
  // that were really drag-releases.
  const handleSurfaceClick = useCallback(() => {
    if (dragMomentum.didDrag()) return;
    if (anchor.getAnchoredVi() !== null) anchor.releaseAnchor();
  }, [dragMomentum, anchor]);

  // Mirror handlers into the parent's surfaceHandlersRef so the
  // parent can bind them to a larger surface (.globeWrap, which
  // is fullscreen). Without this, the handlers only fire from
  // events inside the stage div's transformed bbox — which leaves
  // dead zones at low zoom and after the anchored translateY.
  // See PolyhedronGlobeProps.surfaceHandlersRef for the full
  // rationale.
  useEffect(() => {
    if (!surfaceHandlersRef) return;
    surfaceHandlersRef.current = {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onPointerLeave: handleSurfacePointerLeave,
      onClick: handleSurfaceClick,
    };
    return () => {
      surfaceHandlersRef.current = null;
    };
  }, [
    surfaceHandlersRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleSurfacePointerLeave,
    handleSurfaceClick,
  ]);

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
  // Mirror visibleVertices into a ref so non-React event handlers
  // (hover-mode pointer routing in particular) can read the latest
  // set without closure staleness or re-creating callbacks each
  // render. Updated in an effect (not directly during render) per
  // the react-hooks/refs lint — refs are commit-phase artifacts.
  useEffect(() => {
    visibleVerticesRef.current = visibleVertices;
  }, [visibleVertices]);

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
    if (anchor.anchoredVertexIdx === null) return null;
    const dot = projected[anchor.anchoredVertexIdx];
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
  }, [anchor.anchoredVertexIdx, projected, radius]);

  // Project for the anchored vertex (for billboard title content).
  const anchoredProject =
    anchor.anchoredVertexIdx !== null
      ? assignmentByVertex.get(anchor.anchoredVertexIdx)
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
    const cursor = hover.current.cursorPos;
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

  // ─── Render ──────────────────────────────────────────────────
  //
  // The DOM tree, top to bottom:
  //
  //   <div .stage>                          ← pointer surface + sizing
  //     <svg>                                ← the polyhedron + crosshair
  //       <defs>                             ← gradients, filters
  //       <rect background halo>             ← atmospheric wash (optional)
  //       <g> × N faces                      ← painter-sorted polyhedron faces
  //       <VertexHover|circle> × N vertices  ← project dots + plain glows
  //       <g crosshair>                      ← touch hover crosshair
  //       <g cone>                           ← projection beam (when anchored)
  //     </svg>
  //     <div hex-billboard>                  ← HTML overlay above the SVG
  //   </div>
  //
  // Order = painter order. Inside the SVG, later elements paint
  // OVER earlier ones (defs don't paint at all). The hex billboard
  // is an HTML sibling of <svg>, layered above it via position:
  // absolute + zIndex:2 — it lives outside the SVG because
  // UnfoldingBillboard owns its own SVG + HTML content layer.
  //
  // No transforms on .stage. ROTATION is per-vertex in projected[]
  // math; SCALING + POSITIONING (anchored zoom, viewport framing)
  // happen on globeScaleHost in LandingView so BreathingMesh can
  // measure them in one place for its cutout.
  return (
    <div
      ref={stageRef}
      className={styles.stage}
      style={{ width: stageSize, height: stageSize }}
      // Pointer handlers: the parent (.globeWrap in LandingView)
      // owns the input surface when surfaceHandlersRef is provided —
      // gives drag/dismiss a viewport-sized hit region instead of
      // just the transformed stage bbox. We omit the local handlers
      // in that case to avoid double-firing. Standalone use (no
      // parent surface) falls back to binding them here.
      {...(surfaceHandlersRef
        ? {}
        : {
            onPointerDown: handlePointerDown,
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerUp,
            onPointerCancel: handlePointerUp,
            onPointerLeave: handleSurfacePointerLeave,
            onClick: handleSurfaceClick,
          })}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${stageSize} ${stageSize}`}
        className={styles.svg}
        aria-label="Museum sphere"
        // SVG-level pointer handlers run alongside the stage-div
        // ones; they convert client coords → viewBox coords for the
        // hover-cycle bookkeeping (independent of the surface-lift
        // pointer routing above).
        onPointerMove={handleSvgPointerMove}
        onPointerLeave={handleSvgPointerLeave}
      >
        {/* ─── <defs>: gradients + filters used across the scene ─
            Defined once here, referenced by `url(#id)` from polygons
            and circles below. None of these paint on their own — they
            describe paints that other elements pull in via fill /
            stroke / filter attributes. */}
        <defs>
          {/* Background halo — fades from a soft tint at center to
              transparent at the corners. Reads as faint atmosphere on
              dark theme, a barely-perceptible cool wash on light. */}
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

          {/* Fallback vertex glow — bright pinpoint, soft falloff.
              Fill of unassigned vertex circles. Assigned vertices use
              their own per-category gradients below. */}
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

          {/* Edge-glow blur. The faces' edge-glow pass strokes the
              polygon outline with a thick semi-transparent stroke and
              runs it through this filter so the edges read as having
              a halo. Skipped when graphics.edgeGlow is off. */}
          <filter
            id="ph-edge-glow"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur stdDeviation="2.5" />
          </filter>

          {/* Neutral vertex glow used by VertexHover when category-
              tinting is off (graphics.vertexGlows === "engaged-only"
              for non-focused dots). Legacy id "hover-dot-glow" from
              the standalone HoverDot sandbox. */}
          <radialGradient id="hover-dot-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--glow-pinpoint)" />
            <stop offset="22%" stopColor="var(--glow-core)" />
            <stop offset="55%" stopColor="var(--glow-mid)" />
            <stop offset="100%" stopColor="var(--glow-far)" />
          </radialGradient>

          {/* Per-category vertex glows. White-hot center → category
              color mid → transparent edge. Same stop palette across
              categories so dots read as consistent "lit pinpoints";
              only the mid color (via --category-X token) changes.
              The legend's category swatches mirror these stops as
              CSS radial-gradients so legend + sphere read identical. */}
          {(
            [
              ["games", "--category-games"],
              ["full-stack", "--category-fullstack"],
              ["frontend", "--category-frontend"],
              ["api", "--category-apis"],
              ["python", "--category-python"],
              ["exercises", "--category-exercises"],
            ] as const
          ).map(([cat, token]) => (
            <radialGradient
              key={cat}
              id={`hover-dot-glow-${cat}`}
              cx="50%"
              cy="50%"
              r="50%"
            >
              <stop offset="0%" stopColor="var(--glow-pinpoint)" />
              <stop
                offset="35%"
                stopColor={`var(${token})`}
                stopOpacity={0.95}
              />
              <stop
                offset="65%"
                stopColor={`var(${token})`}
                stopOpacity={0.7}
              />
              <stop offset="100%" stopColor={`var(${token})`} stopOpacity={0} />
            </radialGradient>
          ))}

          {/* Cone gradient template. This <defs> entry is the stop
              palette only; the cone itself instantiates its own
              <linearGradient id="ph-cone-gradient-instance"> with
              userSpaceOnUse + run-time x1/y1/x2/y2 so the gradient
              flows along the beam's actual screen axis. The stops
              fade from opaque-at-apex to transparent-at-top so the
              hex floats cleanly above the brightest region instead
              of meeting the beam at a hard edge. */}
          <linearGradient id="ph-cone-gradient" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--cone-stop-far)" />
            <stop offset="65%" stopColor="var(--cone-stop-mid)" />
            <stop offset="100%" stopColor="var(--cone-stop-near)" />
          </linearGradient>

          {/* Cone-edge softening blur. Keeps the beam from reading
              as a hard polygon outline. */}
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

        {/* ─── Background halo ───────────────────────────────────
            Soft radial wash filling the whole stage. Paints first so
            everything else sits on top of it. Skipped when the user
            has disabled the backgroundHalo graphics toggle (the
            biggest fillrate contributor on low-end hardware). */}
        {graphics.backgroundHalo && (
          <rect
            x={0}
            y={0}
            width={stageSize}
            height={stageSize}
            fill="url(#ph-bg-halo)"
            pointerEvents="none"
          />
        )}

        {/* ─── Polyhedron faces ──────────────────────────────────
            faceRecords is painter-sorted by centroid Z (back-to-
            front) earlier in this component, so later iterations
            paint over earlier — giving correct visual stacking on
            the sphere without depth testing.

            Each face renders TWO passes when edge-glow is on: a
            thick blurred stroke underneath (the halo) + a crisp
            stroke + fill on top. Face shading multiplies alpha by
            facingCamera so front faces are brighter than back —
            disable to flatten the look (and skip the per-face
            oklch resolves, a measurable perf save). */}
        {faceRecords.map((face) => {
          // shadingMul: per-face alpha multiplier. With shading on,
          // we use facingCamera (front faces bright, back faces dim).
          // With shading off, every face gets the same midpoint alpha
          // — visually flatter, computationally cheaper.
          const shadingMul = graphics.faceShading ? face.facingCamera : 0.5;
          return (
            <g key={face.faceIdx}>
              {graphics.edgeGlow && (
                <polygon
                  points={face.points}
                  fill="none"
                  stroke={`oklch(from var(--foreground) l c h / ${0.25 + shadingMul * 0.35})`}
                  strokeWidth={3.2}
                  strokeLinejoin="round"
                  filter="url(#ph-edge-glow)"
                  pointerEvents="none"
                />
              )}
              <polygon
                points={face.points}
                fill={`oklch(from var(--foreground) l c h / ${0.04 + shadingMul * 0.1})`}
                stroke={`oklch(from var(--foreground) l c h / ${0.25 + shadingMul * 0.3})`}
                strokeWidth={0.8}
                strokeLinejoin="round"
                pointerEvents="none"
              />
            </g>
          );
        })}

        {/* ─── Vertices ─────────────────────────────────────────
            For each visible vertex: assigned → <VertexHover> (the
            dot + hit-target + typing label), unassigned → plain
            glow circle. Hidden entirely when vertexGlows === "off".
            visibleVertices is built earlier via backface-culling +
            projection so we don't render dots on the far side. */}
        {graphics.vertexGlows !== "off" &&
          visibleVertices.map((v) => {
            const project = assignmentByVertex.get(v.vi);
            if (project) {
              // Category-tinted glow is per-dot fillrate work. In
              // "engaged-only" mode we use the neutral fallback for
              // non-focused dots — keeps the focused dot's identity
              // color while saving a gradient-resolve per dot across
              // the visible ~22 vertices.
              const isFocused =
                engagedVertexIdx === v.vi || anchor.anchoredVertexIdx === v.vi;
              const useCategoryGlow =
                graphics.vertexGlows === "all" ||
                (graphics.vertexGlows === "engaged-only" && isFocused);
              return (
                <VertexHover
                  key={v.vi}
                  title={project.title}
                  x={v.sx}
                  y={v.sy}
                  engaged={engagedVertexIdx === v.vi}
                  onHitTargetEnter={() => handleDotEnter(v.vi)}
                  onHitTargetClick={() => anchor.handleDotClick(v.vi)}
                  typeDuration={HOVER_DOT_TYPE_DURATION}
                  idleGlowRadius={HOVER_DOT_IDLE_GLOW}
                  expandedGlowRadius={HOVER_DOT_EXPANDED_GLOW}
                  titleFontFamily={HOVER_DOT_FONT_FAMILY}
                  titleFontSize={HOVER_DOT_FONT_SIZE}
                  showCaret={true}
                  flickerStyle="subtle"
                  glowGradientId={
                    useCategoryGlow
                      ? `hover-dot-glow-${project.category}`
                      : "hover-dot-glow"
                  }
                  category={project.category}
                />
              );
            }
            // Unassigned vertex: plain glow circle. Size + opacity
            // both modulated by facingCamera so dots on the far side
            // recede visually.
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

        {/* ─── Touch hover crosshair ─────────────────────────────
            Tiny luminous hexagon that tracks the touch centroid in
            hover mode. Children draw at origin (0,0); the group's
            CSS transform places them. Position writes are imperative
            (useHoverCrosshair owns them) so the crosshair tracks the
            finger at native pointermove rate without React re-renders.
            Rendered both during active touch and through the
            post-release linger fade-out. */}
        {touchMode === "hover" && crosshairVisible && (
          <g
            // Neither `transform` nor `style` declared in JSX so
            // React's reconciliation can't overwrite the imperative
            // writes from the hook. See use-hover-crosshair.ts.
            ref={bindCrosshairGroup}
            pointerEvents="none"
          >
            {/* Outer halo: glow that shows through under the
                fingertip itself. */}
            <circle r={28} fill="url(#hover-dot-glow)" opacity={0.6} />
            {/* Hexagon mark: bright rim, faint fill. Sized larger
                than a fingertip but small enough to read what it
                points at. */}
            <polygon
              points={(() => {
                const r = 18;
                const pts: string[] = [];
                for (let i = 0; i < 6; i++) {
                  const a = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
                  pts.push(
                    `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`,
                  );
                }
                return pts.join(" ");
              })()}
              fill="var(--glass-fill)"
              stroke="var(--glass-stroke)"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
            {/* Center pinpoint. */}
            <circle r={2} fill="var(--glow-pinpoint)" />
          </g>
        )}

        {/* ─── Projection cone ────────────────────────────────────
            Light-beam from the anchored dot up to the hex's base.
            Choreography uses TWO nested <g> transforms:
              - outer: scaleY 0 → 1 (cone rises out of the dot).
              - inner: scaleX 0 → 1 (cone widens from a line to a
                triangle).
            Both originate at the dot so the cone grows OUT of the
            vertex. Polygon + edges are drawn full-size always; only
            the wrapping transforms move. CSS transitions on each
            scale carry the open/close timing — durations come from
            anchor.cone{Height,Width}TransitionMs. */}
        {anchorGeometry && (
          <g
            style={{
              transform: `scaleY(${anchor.coneHeightProgress})`,
              transformOrigin: `${anchorGeometry.dotX}px ${anchorGeometry.coneBottomY}px`,
              transformBox: "view-box",
              transition: `transform ${anchor.coneHeightTransitionMs}ms ease-out`,
            }}
            pointerEvents="none"
            // Cone tracks the anchored project's category — gradient
            // stops + edge strokes resolve --cone-* tokens, which
            // resolve --glass-category, which this attribute overrides
            // (see globals.css [data-glass-category]).
            data-glass-category={anchoredProject?.category}
          >
            <g
              style={{
                transform: `scaleX(${anchor.coneWidthProgress})`,
                transformOrigin: `${anchorGeometry.dotX}px ${anchorGeometry.coneBottomY}px`,
                transformBox: "view-box",
                transition: `transform ${anchor.coneWidthTransitionMs}ms ease-out`,
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
                <stop offset="0%" stopColor="var(--cone-stop-near)" />
                <stop offset="55%" stopColor="var(--cone-stop-mid)" />
                <stop offset="100%" stopColor="var(--cone-stop-far)" />
              </linearGradient>
              {/* Soft blurred underlayer — gives the beam its haze. */}
              <polygon
                points={anchorGeometry.coneTrianglePoints}
                fill="url(#ph-cone-gradient-instance)"
                filter="url(#ph-cone-blur)"
              />
              {/* Crisp fill on top — gives the beam its definition. */}
              <polygon
                points={anchorGeometry.coneTrianglePoints}
                fill="url(#ph-cone-gradient-instance)"
                opacity={0.85}
              />
              {/* Edge highlights along the two slanted sides.
                  Semi-transparent strokes blend into surroundings
                  instead of reading as a hard polygon outline. */}
              <line
                x1={anchorGeometry.dotX}
                y1={anchorGeometry.coneBottomY}
                x2={anchorGeometry.dotX - anchorGeometry.coneTopHalfW}
                y2={anchorGeometry.coneTopY}
                stroke="var(--cone-edge)"
                strokeWidth={1}
                strokeLinecap="round"
              />
              <line
                x1={anchorGeometry.dotX}
                y1={anchorGeometry.coneBottomY}
                x2={anchorGeometry.dotX + anchorGeometry.coneTopHalfW}
                y2={anchorGeometry.coneTopY}
                stroke="var(--cone-edge)"
                strokeWidth={1}
                strokeLinecap="round"
              />
            </g>
          </g>
        )}
      </svg>

      {/* ─── Hex billboard ─────────────────────────────────────
          The card that unfolds above the anchored vertex. Lives
          OUTSIDE the SVG (HTML overlay positioned absolutely on
          the stage div) because UnfoldingBillboard owns its own
          SVG + HTML content layer. Stays mounted throughout the
          anchor lifecycle — `open` toggles the unfold cascade,
          but the wrapper persists so the close-cascade can play. */}
      {anchorGeometry && (
        <div
          style={{
            position: "absolute",
            left: anchorGeometry.hexCx,
            // The wrapper centers on its own midpoint (translate
            // -50% -50%). top:dotY lands the (collapsed) dot on
            // the vertex; top:hexCy lands the (unfolded) hex's
            // center at its final position. Lerp between them via
            // coneHeightProgress so the dot visually shoots out of
            // the vertex along the cone as it rises.
            top:
              anchorGeometry.dotY +
              (anchorGeometry.hexCy - anchorGeometry.dotY) *
                anchor.coneHeightProgress,
            transform: "translate(-50%, -50%)",
            // top-transition only during cone phases. During the
            // swinging phase the dot moves frame-by-frame as the
            // slerp runs and a transition here would smear the
            // hex through space behind the moving dot.
            transition:
              anchor.phase.kind === "coneRising" ||
              anchor.phase.kind === "coneFalling"
                ? `top ${anchor.coneHeightTransitionMs}ms ease-out`
                : "none",
            pointerEvents: anchor.hexOpen ? "auto" : "none",
            // Clip the wrapper's hit region to the visible hex
            // shape. The wrapper is radius*2.4 square (matches
            // UnfoldingBillboard's SVG viewbox), much larger than
            // the visible hex; without this, taps in the empty
            // corners would hit the wrapper and get eaten by its
            // bubble-phase stopPropagation. clip-path makes those
            // off-hex taps fall through to the surface's dismiss.
            //
            // The polygon is a pointy-top hexagon inflated to ~1.13×
            // the geometric vertex positions so the SVG path's
            // drop-shadow glow isn't sliced by the clip. Inflation
            // costs a small ring of dismiss-area in the corners that
            // the user wouldn't aim at anyway.
            clipPath:
              "polygon(50% 2.9%, 90.78% 26.45%, 90.78% 73.55%, 50% 97.1%, 9.22% 73.55%, 9.22% 26.45%)",
            // Override the ancestor stage's `touch-action: none`
            // (which suppresses native pan/zoom on the sphere) so
            // the browser still synthesizes click events for taps
            // on the Link inside.
            touchAction: "manipulation",
            zIndex: 2,
          }}
          // Capture-phase pointerdown stop: prevents the surface's
          // drag-start handler from firing on taps that are meant
          // to navigate the card.
          onPointerDownCapture={(e) => e.stopPropagation()}
          // Bubble-phase click stop: by the time the click bubbles
          // here the native Link has already navigated; stop it so the
          // surface's background-dismiss doesn't ALSO fire.
          onClick={(e) => e.stopPropagation()}
          data-hex-card=""
          // Drive --glass-category for the hex's body/rim/text
          // tinting. Falls back to neutral when no anchor.
          data-glass-category={anchoredProject?.category}
        >
          <UnfoldingBillboard
            open={anchor.hexOpen}
            radius={anchorGeometry.hexRadius}
            stageDelay={90}
            spring={{ stiffness: 260, damping: 18 }}
          >
            {anchoredProject && (
              <Link
                href={
                  anchoredProject.href ?? projectLandingUrl(anchoredProject)
                }
                // Native Next.js <Link> navigation. An earlier version
                // overrode onClick with preventDefault + router.push to
                // "bypass a brittle global click interceptor" — but that
                // override didn't commit the navigation on the first
                // click; the route only flushed on the next
                // click-away/releaseAnchor re-render (the reported
                // billboard regression). The wrapper's bubble-phase
                // onClick stopPropagation already keeps this click from
                // reaching the surface's background-dismiss, and the
                // native Link handles modifier-key / middle-click
                // new-tab semantics, so plain href navigation is both
                // correct and simpler.
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.35rem",
                  textAlign: "center",
                  textDecoration: "none",
                  padding: "0 12%",
                  cursor: "pointer",
                  // Reserve enough vertical room for title + year +
                  // desc inside the hex's inscribed-square region.
                  // UnfoldingBillboard's contentLayer caps width at
                  // radius * 1.4 already.
                  width: "100%",
                }}
              >
                <span
                  style={{
                    fontFamily: HOVER_DOT_FONT_FAMILY,
                    fontSize: 18,
                    fontWeight: 600,
                    letterSpacing: "0.02em",
                    color: "var(--glass-text)",
                    textShadow: "var(--glass-text-shadow)",
                    lineHeight: 1.2,
                  }}
                >
                  {anchoredProject.title}
                </span>
                <span
                  style={{
                    fontFamily: HOVER_DOT_FONT_FAMILY,
                    fontSize: 11,
                    color: "var(--glass-text-muted)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {anchoredProject.year}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    lineHeight: 1.35,
                    color: "var(--glass-text-secondary)",
                    // Trim the description to one or two lines so it
                    // fits the hex's bowl. Clamping with -webkit-
                    // line-clamp is widely supported and graceful on
                    // the few engines that still ignore it (the
                    // overflow just hides any excess).
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    marginTop: "0.1rem",
                  }}
                >
                  {anchoredProject.description}
                </span>
              </Link>
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
