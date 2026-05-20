"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { geodesic, type Mesh } from "@/lib/polyhedra";
import { type Project } from "@/lib/projects";
import { HoverDot } from "./HoverDot";
import styles from "./PolyhedronGlobe.module.css";

// Locked tuning from the /hover-dot sandbox in svg-experiments. Mono
// font + slow typing + caret + dismissal flash + subtle hologram
// flicker. See commit history of svg-experiments for the rationale.
const HOVER_DOT_TYPE_DURATION = 800;
const HOVER_DOT_GRACE_MS = 1200;
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

const AUTO_SPEED = 0.08;

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
const VELOCITY_THRESHOLD = 0.5;
const POLE_LIMIT = 60;
const AXIAL_TILT_DEG = 18;

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

function bounceX(x: number): { x: number; flipped: boolean } {
  let flipped = false;
  while (x > POLE_LIMIT || x < -POLE_LIMIT) {
    if (x > POLE_LIMIT) {
      x = 2 * POLE_LIMIT - x;
      flipped = !flipped;
    }
    if (x < -POLE_LIMIT) {
      x = -2 * POLE_LIMIT - x;
      flipped = !flipped;
    }
  }
  return { x, flipped };
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

  // Initial X is positive: tips the top of the sphere toward the camera
  // by ~15°, exposing a touch more of the northern hemisphere on first
  // render. Composed with the 18° axial-tilt Z rotation downstream.
  const [rotation, setRotation] = useState({ x: 15, y: 0 });
  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const lastTime = useRef(0);
  const didDrag = useRef(false);
  const velocityY = useRef(0);
  const velocityX = useRef(0);
  const releaseTime = useRef(0);
  const amplitudeY = useRef(0);
  const amplitudeX = useRef(0);
  const targetY = useRef(0);
  const targetX = useRef(0);
  const latestRotation = useRef({ x: 15, y: 0 });

  const applyRotation = useCallback((r: { x: number; y: number }) => {
    latestRotation.current = r;
    setRotation(r);
  }, []);

  // Hover state for the typed-title overlay. The vertex index here is
  // Hover-cycle bookkeeping. Each hover that lands on a dot triggers
  // a decelerate → hold → resume animation on the sphere's auto-
  // rotation, played out over (HOVER_DECEL_MS + HOVER_HOLD_MS +
  // HOVER_RESUME_MS) ms. The cycle is driven by a `hoverCycleStart`
  // timestamp ref. The rAF auto-rotate branch computes the current
  // speed multiplier each frame from `now - hoverCycleStart`.
  //
  // A new hover restarts the cycle only when the current speed
  // multiplier is ≥ HOVER_RETRIGGER_THRESHOLD — otherwise we're still
  // inside the slow-down or hold and the new hover is treated as
  // continuing engagement with the same moment.
  const hoverCycleStart = useRef<number | null>(null);

  // Which vertex idx is currently engaged (active=true). null when no
  // dot is engaged. Used to enforce "only one dot active at a time" —
  // when a new dot reports active=true, we set this to its idx, which
  // causes every OTHER dot to receive forceClose=true and run its
  // dismissal sequence immediately. This handles the case where the
  // previous dot's onMouseLeave never fired because the sphere
  // rotation moved its hit target out from under a motionless cursor.
  const [activeVertexIdx, setActiveVertexIdx] = useState<number | null>(null);

  // Per-vertex onActiveChange handler. The HoverDot at vertex `vi`
  // calls this with active=true on engage, active=false on dismiss.
  //
  // On engage: start a new hover cycle (subject to threshold) and
  // record this vertex as the active one — which force-closes any
  // other dot via the forceClose prop wiring below.
  //
  // On dismiss: clear activeVertexIdx if it was us. (No cycle change.)
  const handleDotActiveChange = useCallback((vi: number, active: boolean) => {
    if (active) {
      const now = performance.now();
      const currentMul = computeHoverSpeedMul(now, hoverCycleStart.current);
      if (currentMul >= HOVER_RETRIGGER_THRESHOLD) {
        hoverCycleStart.current = now;
      }
      setActiveVertexIdx(vi);
    } else {
      // Use the functional updater so concurrent dismiss/engage events
      // from different dots don't clobber a more-recent engagement.
      setActiveVertexIdx((curr) => (curr === vi ? null : curr));
    }
  }, []);

  // Drag-momentum physics loop. Direct port from Globe.tsx — same time
  // constant, same pole bounce, same stationary-finger guard.
  useEffect(() => {
    let lastTick = performance.now();
    let frame: number;

    function tick(now: number) {
      const dt = now - lastTick;
      lastTick = now;

      if (!dragging.current) {
        const speed =
          Math.abs(amplitudeY.current) + Math.abs(amplitudeX.current);

        if (speed > VELOCITY_THRESHOLD) {
          const elapsed = now - releaseTime.current;
          const decay = Math.exp(-elapsed / TIME_CONSTANT);

          const rawX = targetX.current - amplitudeX.current * decay;
          const { x: bouncedX, flipped } = bounceX(rawX);
          if (flipped) {
            amplitudeX.current = -amplitudeX.current;
            targetX.current = 2 * bouncedX - targetX.current;
          }

          applyRotation({
            x: bouncedX,
            y: targetY.current - amplitudeY.current * decay,
          });

          if (
            Math.abs(amplitudeY.current * decay) < 0.1 &&
            Math.abs(amplitudeX.current * decay) < 0.1
          ) {
            amplitudeY.current = 0;
            amplitudeX.current = 0;
          }
        } else {
          // Auto-rotate, modulated by the hover cycle's speed multiplier.
          // The multiplier is 1 at cruise, ramps to 0 over HOVER_DECEL_MS
          // when a hover triggers a new cycle, sits at 0 through the
          // hold, then ramps back to 1 over HOVER_RESUME_MS — see
          // computeHoverSpeedMul. When the cycle completes, the ref is
          // reset so subsequent frames don't keep recomputing.
          const speedMul = computeHoverSpeedMul(now, hoverCycleStart.current);
          if (speedMul >= 1 && hoverCycleStart.current !== null) {
            hoverCycleStart.current = null;
          }
          if (speedMul > 0) {
            const r = latestRotation.current;
            applyRotation({
              ...r,
              y: r.y + AUTO_SPEED * speedMul * (dt / 16),
            });
          }
        }
      }

      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [applyRotation]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    didDrag.current = false;
    velocityX.current = 0;
    velocityY.current = 0;
    amplitudeX.current = 0;
    amplitudeY.current = 0;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    lastTime.current = performance.now();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

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

      const vxNow = (1000 * dx) / (1 + dt);
      const vyNow = (1000 * dy) / (1 + dt);
      velocityY.current = 0.8 * vxNow + 0.2 * velocityY.current;
      velocityX.current = 0.8 * vyNow + 0.2 * velocityX.current;

      const r = latestRotation.current;
      const { x: bx } = bounceX(r.x + dy * 0.3);
      applyRotation({ x: bx, y: r.y + dx * 0.3 });
    },
    [applyRotation],
  );

  const handlePointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;

    if (performance.now() - lastTime.current > 50) {
      velocityY.current = 0;
      velocityX.current = 0;
    }

    const r = latestRotation.current;
    amplitudeY.current = (velocityY.current * TIME_CONSTANT) / 1000;
    amplitudeX.current = (velocityX.current * TIME_CONSTANT) / 1000;
    targetY.current = r.y + amplitudeY.current;
    targetX.current = r.x + amplitudeX.current;
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

  // Convert rotation degrees to radians; combine Y (mouse-x), X (mouse-y),
  // and the axial Z tilt into one set of trig values.
  //
  // Direct conversion — both axes share the same sign convention.
  // The drag handler stores rotation.x and rotation.y in this same
  // convention (positive rotation.x tips the top toward the camera;
  // positive rotation.y spins the right side toward the back). No
  // sign mismatches between input space and matrix space; whatever
  // visual flips the original CSS-Globe ported with are absorbed
  // at the drag-handler boundary instead.
  const angleY = (rotation.y * Math.PI) / 180;
  const angleX = (rotation.x * Math.PI) / 180;
  const angleZ = (AXIAL_TILT_DEG * Math.PI) / 180;
  const cosY = Math.cos(angleY);
  const sinY = Math.sin(angleY);
  const cosX = Math.cos(angleX);
  const sinX = Math.sin(angleX);
  const cosZ = Math.cos(angleZ);
  const sinZ = Math.sin(angleZ);

  // Project every vertex. Order of rotations: first Y (sphere spin), then
  // X (pitch from drag), then Z (axial tilt). Mirrors how the rectangle
  // Globe composed its three CSS rotateY/rotateX/rotateZ transforms.
  const projected = useMemo(() => {
    return mesh.vertices.map((v) => {
      // Y rotation: spin around vertical axis
      const x1 = v.x * cosY + v.z * sinY;
      const z1 = -v.x * sinY + v.z * cosY;
      const y1 = v.y;
      // X rotation: pitch (look up/down)
      const y2 = y1 * cosX - z1 * sinX;
      const z2 = y1 * sinX + z1 * cosX;
      const x2 = x1;
      // Z rotation: axial tilt
      const x3 = x2 * cosZ - y2 * sinZ;
      const y3 = x2 * sinZ + y2 * cosZ;
      const z3 = z2;
      // Perspective
      const persp = cameraZ / (cameraZ - z3);
      return {
        // Screen-space (post-perspective, post-translate-to-viewBox-center).
        sx: x3 * persp * scale + cx,
        sy: -y3 * persp * scale + cy,
        z: z3,
      };
    });
  }, [
    mesh.vertices,
    cosY,
    sinY,
    cosX,
    sinX,
    cosZ,
    sinZ,
    cameraZ,
    scale,
    cx,
    cy,
  ]);

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
            // Assigned vertex: render a <HoverDot> at the projected
            // screen position. HoverDot owns its own hover state +
            // grace timer + typing animation + dismissal flash +
            // subtle flicker. We listen via onActiveChange to keep
            // activeDotCount in sync (pauses auto-rotation).
            if (project) {
              return (
                <HoverDot
                  key={v.vi}
                  title={project.title}
                  x={v.sx}
                  y={v.sy}
                  typeDuration={HOVER_DOT_TYPE_DURATION}
                  graceMs={HOVER_DOT_GRACE_MS}
                  idleGlowRadius={HOVER_DOT_IDLE_GLOW}
                  expandedGlowRadius={HOVER_DOT_EXPANDED_GLOW}
                  titleFontFamily={HOVER_DOT_FONT_FAMILY}
                  titleFontSize={HOVER_DOT_FONT_SIZE}
                  showCaret={true}
                  flickerStyle="subtle"
                  onActiveChange={(active) =>
                    handleDotActiveChange(v.vi, active)
                  }
                  forceClose={
                    activeVertexIdx !== null && activeVertexIdx !== v.vi
                  }
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
