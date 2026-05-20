"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { geodesic, type Mesh } from "@/lib/polyhedra";
import styles from "./PolyhedronGlobe.module.css";

/**
 * Bare polyhedron sphere — tessellated icosphere with no content on it.
 *
 * This is the polyhedron-bare branch: everything beyond geometry is
 * stripped out (no per-face project assignments, no text, no category
 * tint, no link interactivity) so the surface can be evaluated in
 * isolation before content design choices are stacked back on.
 *
 * Rendering pipeline per frame:
 *   1. Compose Y-rotation (drag) × X-rotation (drag) × Z-tilt (axial)
 *   2. Rotate every vertex once
 *   3. For each face: compute centroid Z + screen winding
 *   4. Backface-cull (screen winding sign — see note inline)
 *   5. Painter-sort by centroid Z (back to front)
 *   6. Render each face as a uniform muted-fill <polygon>
 *
 * Drag + momentum + auto-rotation mirror the original Globe component's
 * physics (iOS-style exponential decay, pole bounce, stationary-finger
 * guard).
 */

interface PolyhedronGlobeProps {
  /** Sphere radius in viewBox units. */
  radius?: number;
  /** Frequency of icosphere subdivision (2 = 80 faces, default). */
  frequency?: number;
}

const AUTO_SPEED = 0.08;
const TIME_CONSTANT = 600;
const VELOCITY_THRESHOLD = 0.5;
const POLE_LIMIT = 60;
const AXIAL_TILT_DEG = 18;

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
}: PolyhedronGlobeProps) {
  // Mesh is a stable per-frequency constant. Memoize so we don't regenerate
  // 80 vertices + 80 faces on every render.
  const mesh: Mesh = useMemo(() => geodesic(frequency), [frequency]);

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
          const r = latestRotation.current;
          applyRotation({
            ...r,
            y: r.y + AUTO_SPEED * (dt / 16),
          });
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
  const faceRecords = useMemo(() => {
    const records: {
      faceIdx: number;
      points: string;
      centroidZ: number;
      facingCamera: number;
    }[] = [];

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
    }

    // Painter: back first, front last.
    records.sort((a, b) => a.centroidZ - b.centroidZ);
    return records;
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
        {faceRecords.map((face) => (
          // Bare-geometry rendering: every face is a uniform muted-fill
          // polygon with a faint edge. Front-facing faces get a slight
          // brightness lift (facingCamera ∈ [0, 1]) so the visible
          // hemisphere reads as a 3D surface rather than a flat
          // silhouette.
          <polygon
            key={face.faceIdx}
            points={face.points}
            fill={`oklch(from var(--foreground) l c h / ${0.04 + face.facingCamera * 0.1})`}
            stroke={`oklch(from var(--foreground) l c h / ${0.25 + face.facingCamera * 0.3})`}
            strokeWidth={0.8}
            strokeLinejoin="round"
            pointerEvents="none"
          />
        ))}
      </svg>
    </div>
  );
}
