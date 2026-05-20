"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cross, geodesic, normalize, sub, type Mesh } from "@/lib/polyhedra";
import { type WrapLine } from "@/lib/triangle-text";
import styles from "./PolyhedronGlobe.module.css";

/**
 * Sphere of project faces rendered as a tessellated icosphere (frequency-2,
 * 80 triangles). Each face is a real polygon whose vertices coincide with
 * its neighbors' vertices — the surface tessellates by construction.
 *
 * Populated faces (those assigned to a project) carry the project's category
 * tint and link to its detail page. Empty faces render as quiet outlines so
 * the polyhedron structure is fully visible.
 *
 * Rendering pipeline per frame:
 *   1. Compose Y-rotation (drag) × X-rotation (drag) × Z-tilt (axial)
 *   2. Rotate every vertex once
 *   3. For each face: compute centroid Z + face normal
 *   4. Backface-cull (normal · camera-axis < threshold → skip)
 *   5. Painter-sort by centroid Z (back to front)
 *   6. Render each face as <polygon> (or <Link><polygon></Link> if populated)
 *
 * Drag + momentum + auto-rotation mirror the existing Globe component's
 * physics (iOS-style exponential decay, pole bounce, stationary-finger
 * guard). The rotation values are applied as a 3D matrix to vertex
 * positions instead of as a CSS transform — that's the entire difference
 * from the rectangular card globe.
 */

export interface FaceAssignment {
  /** Index into mesh.faces — which face this assignment lives on. */
  faceIdx: number;
  /** Project ID for click target + key. */
  id: string;
  /** Path to navigate to. */
  href: string;
  /** Category color hex pair for fill. */
  hex: { light: string; dark: string };
  /** Project title for accessible label. */
  title: string;
  /**
   * Pre-wrapped title lines for in-face rendering. Lines are positioned
   * in unit-band coordinates: each line's `y` is in [0, 1] where 0 is
   * the top of the text band (toward north on the face's tangent plane)
   * and 1 is the bottom (toward south).
   *
   * Caller (LandingView) computes these once per project at mount,
   * using a rectangular wrap (no triangle-shape awareness — face
   * clipping handles overflow at render time).
   */
  textLines: WrapLine[];
  /**
   * Font size for the wrapped text in *sphere* units (the same units as
   * the sphere mesh's vertex positions, i.e. ~1.0 = full sphere edge).
   * At render time the affine matrix scales this into screen pixels
   * automatically based on the band's projected size.
   */
  textFontSize: number;
  /**
   * Half-width and half-height of the text band, in sphere units. The
   * band is centered on the face centroid and oriented to the tangent-
   * plane north axis. textLines positions are relative to this band.
   */
  textBandHalfWidth: number;
  textBandHalfHeight: number;
}

interface PolyhedronGlobeProps {
  assignments: FaceAssignment[];
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
  assignments,
  radius = 340,
  frequency = 2,
}: PolyhedronGlobeProps) {
  // Mesh is a stable per-frequency constant. Memoize so we don't regenerate
  // 80 vertices + 80 faces on every render.
  const mesh: Mesh = useMemo(() => geodesic(frequency), [frequency]);

  // Index assignments by faceIdx for O(1) lookup during render.
  const assignmentByFace = useMemo(() => {
    const map = new Map<number, FaceAssignment>();
    for (const a of assignments) map.set(a.faceIdx, a);
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
        // Rotated 3D position (pre-perspective, on the unit sphere).
        // Used by the per-face tangent-plane computation so text can be
        // oriented to the sphere's (rotated) north pole.
        rx: x3,
        ry: y3,
        rz: z3,
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

  // The world-up vector (0, 1, 0) rotated by the same Y/X/Z chain applied
  // to mesh vertices. This is "where the north pole is" in rotated-world
  // space — the direction we project onto each face's tangent plane to
  // get that face's local "up."
  const rotatedWorldUp = useMemo(() => {
    // (0, 1, 0) under Y rotation stays (0, 1, 0). Then X rotation flips
    // the y/z: y' = cos(angleX), z' = sin(angleX). Then Z rotation
    // mixes x'/y': x'' = -sin(angleZ) * cos(angleX), y'' = cos(angleZ) * cos(angleX).
    // Easier to just chain the matrix multiplies directly.
    const y0 = 1;
    // Y rotation: (0, 1, 0) is unchanged.
    const x1 = 0,
      y1 = y0,
      z1 = 0;
    // X rotation
    const x2 = x1;
    const y2 = y1 * cosX - z1 * sinX;
    const z2 = y1 * sinX + z1 * cosX;
    // Z rotation
    const x3 = x2 * cosZ - y2 * sinZ;
    const y3 = x2 * sinZ + y2 * cosZ;
    const z3 = z2;
    return { x: x3, y: y3, z: z3 };
  }, [cosX, sinX, cosZ, sinZ]);

  // Project a 3D point (in rotated-world space, on or near the unit sphere)
  // to screen coordinates using the same camera as the vertex pipeline.
  // Used by computeFaceTextLayout to map tangent-plane basis vectors into
  // screen space without re-running the full rotation chain.
  const projectPoint = useCallback(
    (px: number, py: number, pz: number) => {
      const persp = cameraZ / (cameraZ - pz);
      return {
        sx: px * persp * scale + cx,
        sy: -py * persp * scale + cy,
      };
    },
    [cameraZ, scale, cx, cy],
  );

  // Per-face processing: cull backfaces, compute centroid Z for sort.
  const faceRecords = useMemo(() => {
    const records: {
      faceIdx: number;
      points: string;
      /** Screen vertices A, B, C — preserved for text positioning. */
      vertices: [
        { sx: number; sy: number },
        { sx: number; sy: number },
        { sx: number; sy: number },
      ];
      /**
       * 3D centroid + normal in rotated world space — used by
       * computeFaceTextLayout to build a tangent-plane frame oriented
       * to the sphere's (rotated) north pole.
       */
      centroid3D: { x: number; y: number; z: number };
      normal3D: { x: number; y: number; z: number };
      centroidZ: number;
      facingCamera: number;
      assignment: FaceAssignment | undefined;
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
      // (ex*fy - ey*fx) is negative. So front-facing → screenZ < 0;
      // back-facing → screenZ > 0. Cull when screenZ >= 0.
      //
      // (Earlier this rule was inverted, which kept back faces and
      // culled fronts — the sphere was rendered inside-out.)
      const ex = b.sx - a.sx;
      const ey = b.sy - a.sy;
      const fx = c.sx - a.sx;
      const fy = c.sy - a.sy;
      const screenZ = ex * fy - ey * fx;
      if (screenZ >= 0) continue; // back-facing

      // For sorting + tint depth, use camera-space centroid Z.
      const cz = (a.z + b.z + c.z) / 3;

      // For tint intensity, we need a "facing the camera" metric. The
      // simplest correct version: dot product of the world-space face
      // normal with +Z. To compute the world-space normal we'd need to
      // un-project, which is wasteful. Instead, approximate facingCamera
      // as a normalized value of centroid Z (front faces have z > 0,
      // back faces are culled). Centroid Z ranges from ~-1 to +1 on a
      // unit-radius mesh.
      const facingCamera = Math.max(0, Math.min(1, (cz + 1) / 2));

      const points = `${a.sx.toFixed(1)},${a.sy.toFixed(1)} ${b.sx.toFixed(1)},${b.sy.toFixed(1)} ${c.sx.toFixed(1)},${c.sy.toFixed(1)}`;

      // 3D centroid in rotated world space.
      const centroid3D = {
        x: (a.rx + b.rx + c.rx) / 3,
        y: (a.ry + b.ry + c.ry) / 3,
        z: (a.rz + b.rz + c.rz) / 3,
      };
      // 3D face normal: cross(b - a, c - a), normalized. Direction follows
      // the same CCW winding the mesh uses, so this points outward.
      const e3x = b.rx - a.rx;
      const e3y = b.ry - a.ry;
      const e3z = b.rz - a.rz;
      const f3x = c.rx - a.rx;
      const f3y = c.ry - a.ry;
      const f3z = c.rz - a.rz;
      const nx = e3y * f3z - e3z * f3y;
      const ny = e3z * f3x - e3x * f3z;
      const nz = e3x * f3y - e3y * f3x;
      const nlen = Math.hypot(nx, ny, nz) || 1;
      const normal3D = { x: nx / nlen, y: ny / nlen, z: nz / nlen };

      records.push({
        faceIdx: i,
        points,
        vertices: [
          { sx: a.sx, sy: a.sy },
          { sx: b.sx, sy: b.sy },
          { sx: c.sx, sy: c.sy },
        ],
        centroid3D,
        normal3D,
        centroidZ: cz,
        facingCamera,
        assignment: assignmentByFace.get(i),
      });
    }

    // Painter: back first, front last.
    records.sort((a, b) => a.centroidZ - b.centroidZ);
    return records;
  }, [mesh.faces, projected, assignmentByFace]);

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
        {faceRecords.map((face) => {
          const populated = face.assignment;
          if (populated) {
            // Populated face: linked, category-tinted. Brighter when facing
            // the camera.
            const fill = composeFill(populated.hex, face.facingCamera);
            const textLayout = computeFaceTextLayout(
              face.centroid3D,
              face.normal3D,
              rotatedWorldUp,
              populated.textBandHalfWidth,
              populated.textBandHalfHeight,
              projectPoint,
            );
            const clipId = `face-clip-${face.faceIdx}`;
            return (
              <Link
                key={face.faceIdx}
                href={populated.href}
                aria-label={populated.title}
                className={styles.faceLink}
              >
                {/* Clip path for the face — text overflowing the polygon
                    silhouette gets cropped, so labels that don't fit a
                    small/foreshortened face stay visually contained. */}
                <defs>
                  <clipPath id={clipId}>
                    <polygon points={face.points} />
                  </clipPath>
                </defs>
                <polygon
                  points={face.points}
                  fill={fill}
                  stroke="rgba(60, 60, 80, 0.5)"
                  strokeWidth={0.8}
                  strokeLinejoin="round"
                />
                {textLayout && (
                  <g clipPath={`url(#${clipId})`}>
                    <FaceText
                      layout={textLayout}
                      lines={populated.textLines}
                      fontSize={populated.textFontSize}
                    />
                  </g>
                )}
              </Link>
            );
          }
          // Empty face: quiet outline, no link.
          return (
            <polygon
              key={face.faceIdx}
              points={face.points}
              fill={`oklch(from var(--muted) l c h / ${0.15 + face.facingCamera * 0.15})`}
              stroke="rgba(60, 60, 80, 0.3)"
              strokeWidth={0.5}
              strokeLinejoin="round"
              pointerEvents="none"
            />
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Computed text layout for a face. Provides a full 2D affine matrix that
 * maps text-local coordinates onto screen space, oriented so text "up"
 * points toward the (rotated) sphere north pole — not toward the face's
 * own apex.
 *
 * Text is laid out once in unit-band coordinates (u ∈ [-0.5, +0.5], v ∈
 * [0, 1] where v=0 is top and v=1 is bottom of the text band) and the
 * matrix takes care of position, rotation, scale, AND skew — so text
 * foreshortens with the face plane while always reading top-toward-north.
 */
interface FaceTextLayout {
  /**
   * SVG matrix transform values [a, b, c, d, e, f] for the mapping:
   *   screen_x = a·u + c·v + e
   *   screen_y = b·u + d·v + f
   * where (u, v) are text-band coordinates centered at the face centroid:
   *   (0, 0)   = top-center of text band (toward north pole)
   *   (0.5, 0) = top-right
   *   (0, 1)   = bottom-center (toward south)
   */
  matrix: [number, number, number, number, number, number];
  /**
   * Screen-space length of the band's vertical extent. Used to decide
   * whether to render text at all (very foreshortened bands skip text).
   */
  bandHeightScreen: number;
}

/**
 * Compute per-face text layout in the face's tangent plane, oriented so
 * "up" points toward the rotated sphere's north pole.
 *
 * Algorithm:
 *   1. Take the face's 3D normal and centroid (both in rotated-world
 *      space — already computed in faceRecords).
 *   2. Compute the tangent-plane "north" axis: world_up minus its
 *      component along the normal, normalized. Lies in the tangent
 *      plane, points toward the north pole.
 *   3. Compute the tangent-plane "east" axis: north × normal, normalized.
 *      (Not normal × north — that gives west! With the outward normal
 *      pointing toward the viewer and north pointing up, right-hand-rule
 *      curl from normal toward north points to the viewer's LEFT. Swap
 *      operands to get the viewer's right, which is geographic east.)
 *      Also lies in the tangent plane, perpendicular to north.
 *   4. The text band lives in (east, north) coordinates centered on
 *      the face centroid, with extent ±bandHalfWidth east and
 *      [-bandHalfHeight, +bandHalfHeight] north.
 *   5. Project three reference points to screen:
 *        text top-center = centroid + bandHalfHeight × north
 *        text right edge of top = centroid + bandHalfWidth × east + bandHalfHeight × north
 *        text bottom-center = centroid - bandHalfHeight × north
 *      Each projection uses the perspective camera.
 *   6. Solve the affine matrix mapping text-band coords (u, v) ∈
 *      [(-0.5, 0), (+0.5, 0), (0, 1)] to those three projected points.
 *
 * Result: text rendered through this matrix sits in the face's tangent
 * plane, oriented with north up, foreshortened naturally by perspective.
 */
function computeFaceTextLayout(
  centroid3D: { x: number; y: number; z: number },
  normal3D: { x: number; y: number; z: number },
  rotatedWorldUp: { x: number; y: number; z: number },
  bandHalfWidth: number,
  bandHalfHeight: number,
  projectPoint: (
    x: number,
    y: number,
    z: number,
  ) => {
    sx: number;
    sy: number;
  },
): FaceTextLayout | null {
  // North in tangent plane: world_up projected onto plane(normal, 0).
  const upDotN =
    rotatedWorldUp.x * normal3D.x +
    rotatedWorldUp.y * normal3D.y +
    rotatedWorldUp.z * normal3D.z;
  const nx = rotatedWorldUp.x - upDotN * normal3D.x;
  const ny = rotatedWorldUp.y - upDotN * normal3D.y;
  const nz = rotatedWorldUp.z - upDotN * normal3D.z;
  const nlen = Math.hypot(nx, ny, nz);
  // Degenerate case: the face is exactly perpendicular to world up
  // (i.e., it IS the north or south pole face). Skip text for these.
  if (nlen < 1e-4) return null;
  const north = { x: nx / nlen, y: ny / nlen, z: nz / nlen };
  // East = north × normal (NOT normal × north — that points west when
  // the normal faces the viewer and north points up). Unit-length
  // automatically since |normal|=|north|=1 and they're orthogonal.
  const east = {
    x: north.y * normal3D.z - north.z * normal3D.y,
    y: north.z * normal3D.x - north.x * normal3D.z,
    z: north.x * normal3D.y - north.y * normal3D.x,
  };

  // Three reference points in 3D (rotated-world space).
  // Text-band coordinate convention:
  //   (u, v) = (0, 0)   → top-center of band
  //   (u, v) = (+0.5, 0) → top-right of band
  //   (u, v) = (0, 1)   → bottom-center of band (one band-height below top)
  // Band extends from +bandHalfHeight along north (top) to -bandHalfHeight
  // along north (bottom), centered on the face centroid.
  //
  // So in 3D:
  //   topCenter   = centroid + bandHalfHeight · north
  //   topRight    = centroid + bandHalfHeight · north + bandHalfWidth · east
  //   bottomCenter = centroid - bandHalfHeight · north
  const topCenter3D = {
    x: centroid3D.x + bandHalfHeight * north.x,
    y: centroid3D.y + bandHalfHeight * north.y,
    z: centroid3D.z + bandHalfHeight * north.z,
  };
  const topRight3D = {
    x: topCenter3D.x + bandHalfWidth * east.x,
    y: topCenter3D.y + bandHalfWidth * east.y,
    z: topCenter3D.z + bandHalfWidth * east.z,
  };
  const bottomCenter3D = {
    x: centroid3D.x - bandHalfHeight * north.x,
    y: centroid3D.y - bandHalfHeight * north.y,
    z: centroid3D.z - bandHalfHeight * north.z,
  };

  // Project to screen.
  const pTop = projectPoint(topCenter3D.x, topCenter3D.y, topCenter3D.z);
  const pTopRight = projectPoint(topRight3D.x, topRight3D.y, topRight3D.z);
  const pBottom = projectPoint(
    bottomCenter3D.x,
    bottomCenter3D.y,
    bottomCenter3D.z,
  );

  // Solve the matrix mapping (u, v) → (sx, sy) with:
  //   (0, 0)   → pTop
  //   (0.5, 0) → pTopRight
  //   (0, 1)   → pBottom
  //
  // matrix: sx = a·u + c·v + e, sy = b·u + d·v + f
  // (0,0):    e = pTop.sx,  f = pTop.sy
  // (0.5, 0): 0.5·a + e = pTopRight.sx → a = 2·(pTopRight.sx - pTop.sx)
  //           0.5·b + f = pTopRight.sy → b = 2·(pTopRight.sy - pTop.sy)
  // (0, 1):   c + e = pBottom.sx → c = pBottom.sx - pTop.sx
  //           d + f = pBottom.sy → d = pBottom.sy - pTop.sy
  const e = pTop.sx;
  const f = pTop.sy;
  const a = 2 * (pTopRight.sx - pTop.sx);
  const b = 2 * (pTopRight.sy - pTop.sy);
  const c = pBottom.sx - pTop.sx;
  const d = pBottom.sy - pTop.sy;

  const bandHeightScreen = Math.hypot(c, d);

  return {
    matrix: [a, b, c, d, e, f],
    bandHeightScreen,
  };
}

/**
 * Renders pre-wrapped text lines inside a face. Each line sits at a
 * y position [0, 1] along the apex-to-base axis; we lerp between apex
 * and baseMid screen coords to get the line's center, then rotate the
 * <text> by the layout's rotationDeg so the text reads face-aligned.
 *
 * SVG transform="rotate(angle cx cy)" rotates around the given pivot —
 * we use the line's center so each line rotates in-place.
 */
function FaceText({
  layout,
  lines,
  fontSize,
}: {
  layout: FaceTextLayout;
  lines: WrapLine[];
  fontSize: number;
}) {
  if (lines.length === 0) return null;
  // Skip rendering when the band is severely foreshortened — text would
  // be sub-pixel and unreadable, just visual noise.
  if (layout.bandHeightScreen < 8) return null;

  // The matrix maps text-band (u, v) coordinates to screen, where:
  //   (0, 0)   = top-center of band
  //   (0.5, 0) = top-right of band
  //   (0, 1)   = bottom-center of band
  //
  // SVG's matrix() takes [a, b, c, d, e, f] in column-major: applied as
  //   x' = a·x + c·y + e
  //   y' = b·x + d·y + f
  // which matches our derivation.
  const [a, b, c, d, e, f] = layout.matrix;
  const matrixStr = `matrix(${a.toFixed(3)} ${b.toFixed(3)} ${c.toFixed(3)} ${d.toFixed(3)} ${e.toFixed(2)} ${f.toFixed(2)})`;

  return (
    <g transform={matrixStr}>
      {lines.map((line, i) => {
        if (!line.text) return null;
        // line.y is in [0, 1] along the band's north-south axis.
        // text is centered horizontally; u=0 means center of band.
        return (
          <text
            key={i}
            x={0}
            y={line.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fontSize}
            fontWeight={600}
            fill="rgba(20, 20, 30, 0.92)"
            pointerEvents="none"
            style={{ userSelect: "none" }}
          >
            {line.text}
          </text>
        );
      })}
    </g>
  );
}

/**
 * Build an rgba() fill from a category hex pair, modulated by facing
 * intensity. Lighter (more white-washed) for front-facing faces; deeper
 * (less wash) for back-facing. Mirrors the rectangle card's white-wash-
 * over-tint composition.
 */
function composeFill(
  hex: { light: string; dark: string },
  facing: number,
): string {
  // Convert hex to rgba so we can apply the wash. Skip parsing complexity
  // by treating the input as a pair of fully-opaque colors and applying
  // the wash as a per-stop alpha.
  // Wash intensity scales with facing: front faces are ~70% white-washed,
  // back faces only ~30%. The category color shows through more on the
  // back, which gives the back of the sphere a coherent tint instead of
  // looking flat.
  const wash = 0.4 + facing * 0.4;
  // For simplicity render as a flat composed color: blend white * wash
  // with the light hex * (1 - wash).
  const lightRgb = hexToRgb(hex.light);
  if (!lightRgb) return "rgba(220, 220, 230, 0.6)";
  const r = lightRgb.r * (1 - wash) + 255 * wash;
  const g = lightRgb.g * (1 - wash) + 255 * wash;
  const b = lightRgb.b * (1 - wash) + 255 * wash;
  return `rgba(${r.toFixed(0)}, ${g.toFixed(0)}, ${b.toFixed(0)}, 0.9)`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/**
 * Compute the centroid of a triangle (or polygon) face on the mesh, on
 * the unit sphere. Used for assigning projects to faces — the assignment
 * code outside this component picks 34 face indices and the projects
 * are associated with those centroids.
 *
 * Exported because the assignment code in LandingView needs it to
 * generate stable face-to-project mappings.
 */
export function faceCentroid(mesh: Mesh, faceIdx: number) {
  const face = mesh.faces[faceIdx]!;
  const verts = face.map((vi) => mesh.vertices[vi]!);
  const c = verts.reduce(
    (acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y, z: acc.z + v.z }),
    { x: 0, y: 0, z: 0 },
  );
  const n = verts.length;
  const centroid = { x: c.x / n, y: c.y / n, z: c.z / n };
  return normalize(centroid);
}

// Make face-normal calc usable for callers that want it (e.g. an external
// face-picker that orients projects along surface normals later).
export function faceNormal(mesh: Mesh, faceIdx: number) {
  const face = mesh.faces[faceIdx]!;
  const a = mesh.vertices[face[0]!]!;
  const b = mesh.vertices[face[1]!]!;
  const c = mesh.vertices[face[2]!]!;
  return normalize(cross(sub(b, a), sub(c, a)));
}
