/**
 * Quaternion primitive for 3D rotation.
 *
 * Quaternions represent rotations as a 4-tuple `(x, y, z, w)` where
 * `(x, y, z)` is the rotation axis (scaled by sin(θ/2)) and `w` is
 * cos(θ/2). Compared to Euler angles:
 *   - Composable: rotating by A then B = multiply(quaternionA, quaternionB)
 *   - No gimbal lock at the poles
 *   - Slerp gives shortest-path interpolation between two rotations
 *   - Axis-angle conversion is direct (build a rotation around any axis)
 *
 * This module provides just enough operations for PolyhedronGlobe:
 *   - identity, fromAxisAngle, multiply
 *   - toMatrix3 for vertex rotation
 *   - slerp (for future click-to-anchor animation)
 *
 * All quaternions are assumed UNIT quaternions (|q| = 1). Composition
 * and slerp preserve unit length; constructed quaternions from
 * fromAxisAngle are unit by construction. No need to renormalize per
 * frame for typical use; renormalize occasionally if accumulating
 * thousands of incremental rotations to avoid drift.
 */

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** Identity rotation — no rotation. (0, 0, 0, 1). */
export function identity(): Quat {
  return { x: 0, y: 0, z: 0, w: 1 };
}

/**
 * Build a quaternion representing rotation by `angle` radians around
 * the given unit-length axis `(ax, ay, az)`. The axis is NOT
 * normalized — the caller is responsible.
 */
export function fromAxisAngle(
  ax: number,
  ay: number,
  az: number,
  angle: number,
): Quat {
  const half = angle * 0.5;
  const s = Math.sin(half);
  return {
    x: ax * s,
    y: ay * s,
    z: az * s,
    w: Math.cos(half),
  };
}

/**
 * Compose two rotations: the result rotates by `b` then by `a`.
 * (Quaternion multiplication is non-commutative; left-multiply means
 * "apply rotation a after rotation b.")
 *
 * For "build up rotation incrementally," call `multiply(delta, current)`
 * each frame — this prepends delta, so the new rotation is "delta on
 * top of current."
 */
export function multiply(a: Quat, b: Quat): Quat {
  // Standard Hamilton product.
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

/**
 * Renormalize a quaternion to unit length. Use occasionally after many
 * incremental multiplications to prevent floating-point drift from
 * accumulating into a non-unit quaternion (which would cause subtle
 * scaling artifacts in the rotation).
 */
export function normalize(q: Quat): Quat {
  const len = Math.hypot(q.x, q.y, q.z, q.w);
  if (len === 0) return identity();
  const inv = 1 / len;
  return { x: q.x * inv, y: q.y * inv, z: q.z * inv, w: q.w * inv };
}

/**
 * Convert a unit quaternion to a 3×3 rotation matrix, flattened in
 * row-major order: [m00, m01, m02, m10, m11, m12, m20, m21, m22].
 *
 * To rotate a vector `v` by quaternion `q`, compute `M = toMatrix3(q)`
 * then `v' = (M[0]·v.x + M[1]·v.y + M[2]·v.z, ...)`.
 *
 * For per-frame vertex rotation, compute the matrix once per render
 * (not per vertex) and apply it to all vertices. Saves redundant
 * trig calls.
 */
export function toMatrix3(
  q: Quat,
): [number, number, number, number, number, number, number, number, number] {
  const { x, y, z, w } = q;
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;
  return [
    1 - 2 * (yy + zz),
    2 * (xy - wz),
    2 * (xz + wy),
    2 * (xy + wz),
    1 - 2 * (xx + zz),
    2 * (yz - wx),
    2 * (xz - wy),
    2 * (yz + wx),
    1 - 2 * (xx + yy),
  ];
}

/**
 * Spherical linear interpolation between two quaternions at progress
 * `t` ∈ [0, 1]. Returns a quaternion representing the rotation that
 * is `t` of the way from `a` to `b` along the shortest geodesic on
 * the 4D unit sphere.
 *
 * Handles the "negate b if needed" case so we always go the short way
 * around (quaternions q and -q represent the same rotation).
 *
 * Falls back to linear interpolation for very-close quaternions where
 * the sin(θ) denominator approaches zero and slerp gets numerically
 * unstable.
 */
export function slerp(a: Quat, b: Quat, t: number): Quat {
  let bx = b.x;
  let by = b.y;
  let bz = b.z;
  let bw = b.w;
  // Dot product = cos(θ) where θ is the angle between a and b on the
  // unit 4-sphere.
  let dot = a.x * bx + a.y * by + a.z * bz + a.w * bw;
  // If dot < 0, negate b to take the shorter arc.
  if (dot < 0) {
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
    dot = -dot;
  }
  // When dot is very close to 1, the quaternions are nearly identical —
  // linear interpolation is accurate enough and avoids div-by-zero.
  if (dot > 0.9995) {
    return normalize({
      x: a.x + (bx - a.x) * t,
      y: a.y + (by - a.y) * t,
      z: a.z + (bz - a.z) * t,
      w: a.w + (bw - a.w) * t,
    });
  }
  const theta = Math.acos(dot);
  const sinTheta = Math.sin(theta);
  const sA = Math.sin((1 - t) * theta) / sinTheta;
  const sB = Math.sin(t * theta) / sinTheta;
  return {
    x: a.x * sA + bx * sB,
    y: a.y * sA + by * sB,
    z: a.z * sA + bz * sB,
    w: a.w * sA + bw * sB,
  };
}

/**
 * Apply a quaternion's rotation matrix to a single vector. Most code
 * should use toMatrix3 + manual application across many vectors (one
 * matrix compute per frame, many vectors), but this is convenient for
 * one-off rotations.
 */
export function rotateVec3(
  q: Quat,
  vx: number,
  vy: number,
  vz: number,
): { x: number; y: number; z: number } {
  const m = toMatrix3(q);
  return {
    x: m[0] * vx + m[1] * vy + m[2] * vz,
    y: m[3] * vx + m[4] * vy + m[5] * vz,
    z: m[6] * vx + m[7] * vy + m[8] * vz,
  };
}
