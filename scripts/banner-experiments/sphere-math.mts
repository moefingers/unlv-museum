/**
 * Shared 3D projection + cubic-bezier-circle math for the banner experiments.
 *
 * The scene: a sphere of radius `rx` at the origin, tilted by angle β around
 * the X-axis (so we look "down at the top" of it). Camera at z = D looking in
 * −z direction. Orthographic foreshortening + perspective scaling.
 *
 * "Bead" markers on the sphere surface — each at a fixed (latitude, longitude)
 * — are drawn as 4-segment cubic Bezier paths approximating the perspective-
 * projected circle. Each bead's full 12 control points are baked through the
 * pipeline per keyframe so SMIL can interpolate between samples.
 */

export interface SceneParams {
  /** Camera distance for perspective. Larger = less perspective. Typical 4*sphereRadius. */
  D: number;
}

/** Per-shell static orientation: tilt-X then tilt-Z applied before the spin. */
export interface Orientation {
  /** Rotation around world X (radians). Positive = top of sphere tilts toward viewer. */
  tiltX: number;
  /** Rotation around world Z (radians). Positive = spin axis tilts to viewer's left. */
  tiltZ: number;
}

/** Default tilt — about 17.6° (atan(44/140)) around X, no Z tilt. Matches what we've been using. */
export const DEFAULT_TILT_X = Math.atan(44 / 140);
export const DEFAULT_ORIENTATION: Orientation = {
  tiltX: DEFAULT_TILT_X,
  tiltZ: 0,
};

/**
 * Bezier "magic constant" — control-point offset that makes 4 cubic Beziers
 * approximate a circle to within 0.027% radius error. Universally used in
 * vector graphics for circle approximations.
 */
export const BEZIER_C = 0.5522847498;

export function makeScene(p: SceneParams) {
  const D = p.D;

  /**
   * Project a 3D world point to 2D (with SVG Y-down convention), applying the
   * given orientation: tilt-X first (rotates Y toward camera), then tilt-Z
   * (rotates spin axis in the screen plane).
   */
  function project(
    x: number,
    y: number,
    z: number,
    orient: Orientation,
  ): [number, number] {
    const cosX = Math.cos(orient.tiltX);
    const sinX = Math.sin(orient.tiltX);
    const cosZ = Math.cos(orient.tiltZ);
    const sinZ = Math.sin(orient.tiltZ);
    // tilt-X: rotate (y, z) about world X
    const y1 = y * cosX - z * sinX;
    const z1 = y * sinX + z * cosX;
    // tilt-Z: rotate (x, y1) about world Z
    const x2 = x * cosZ - y1 * sinZ;
    const y2 = x * sinZ + y1 * cosZ;
    const s = D / (D - z1);
    return [x2 * s, -y2 * s];
  }

  /**
   * Compute the 4-segment cubic Bezier path string and the 2D bbox + projected
   * highlight position for a bead at (latitude, longitude) under a light source.
   *
   * @param rx     Sphere radius the bead orbits (per-shell).
   * @param r      Bead radius in 3D world units (per-shell).
   * @param L      Light direction unit vector in 3D world coords.
   * @param orient Shell orientation — static tilts applied before view projection.
   *
   * Returns the path data plus light-tracking gradient cx/cy as percentages
   * within the path's bbox, plus a face-culling factor (positive = visible).
   */
  function frame(
    theta: number,
    sinLat: number,
    cosLat: number,
    rx: number,
    r: number,
    L: readonly [number, number, number],
    orient: Orientation,
  ) {
    const st = Math.sin(theta);
    const ct = Math.cos(theta);
    const cx3 = rx * cosLat * st;
    const cy3 = rx * sinLat;
    const cz3 = rx * cosLat * ct;
    const right: [number, number, number] = [ct, 0, -st];
    const up: [number, number, number] = [-sinLat * st, cosLat, -sinLat * ct];

    const anchor = (sR: number, sU: number): [number, number, number] => [
      cx3 + r * sR * right[0] + r * sU * up[0],
      cy3 + r * sR * right[1] + r * sU * up[1],
      cz3 + r * sR * right[2] + r * sU * up[2],
    ];
    const handle = (
      p: [number, number, number],
      v: [number, number, number],
      sg: number,
    ): [number, number, number] => [
      p[0] + sg * BEZIER_C * r * v[0],
      p[1] + sg * BEZIER_C * r * v[1],
      p[2] + sg * BEZIER_C * r * v[2],
    ];

    const P0 = anchor(+1, 0);
    const P1 = anchor(0, +1);
    const P2 = anchor(-1, 0);
    const P3 = anchor(0, -1);
    const A0 = handle(P0, up, +1);
    const B0 = handle(P1, right, +1);
    const A1 = handle(P1, right, -1);
    const B1 = handle(P2, up, +1);
    const A2 = handle(P2, up, -1);
    const B2 = handle(P3, right, -1);
    const A3 = handle(P3, right, +1);
    const B3 = handle(P0, up, -1);

    const pts = [P0, A0, B0, P1, A1, B1, P2, A2, B2, P3, A3, B3].map((p) =>
      project(p[0], p[1], p[2], orient),
    );

    let minX = pts[0]![0];
    let maxX = pts[0]![0];
    let minY = pts[0]![1];
    let maxY = pts[0]![1];
    for (const [x, y] of pts) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    const [hx, hy] = project(
      cx3 + r * L[0],
      cy3 + r * L[1],
      cz3 + r * L[2],
      orient,
    );
    const bbW = maxX - minX;
    const bbH = maxY - minY;
    const cxPctLit = bbW > 0.01 ? ((hx - minX) / bbW) * 100 : 35;
    const cyPctLit = bbH > 0.01 ? ((hy - minY) / bbH) * 100 : 30;
    // Lambert lighting: dot of bead outward normal with light direction.
    // Positive = bead faces light (highlight valid). Zero/negative = back-lit,
    // so push the gradient center off-bbox to fade out the highlight smoothly.
    const normal_x = cosLat * st;
    const normal_y = sinLat;
    const normal_z = cosLat * ct;
    const litDot = normal_x * L[0] + normal_y * L[1] + normal_z * L[2];
    const litFactor = Math.max(0, litDot);
    const OFF_BBOX = 200;
    const cxPct = cxPctLit * litFactor + OFF_BBOX * (1 - litFactor);
    const cyPct = cyPctLit * litFactor + OFF_BBOX * (1 - litFactor);

    const f = (i: number) =>
      `${pts[i]![0].toFixed(2)},${pts[i]![1].toFixed(2)}`;
    const path = `M${f(0)} C${f(1)} ${f(2)} ${f(3)} C${f(4)} ${f(5)} ${f(6)} C${f(7)} ${f(8)} ${f(9)} C${f(10)} ${f(11)} ${f(0)} Z`;

    // Face-culling: dot product of bead's outward normal (after orientation) with
    // camera view direction +Z. Tilt-Z is a rotation around Z, so it doesn't
    // affect the Z component — culling depends only on tiltX.
    const culling =
      sinLat * Math.sin(orient.tiltX) +
      cosLat * Math.cos(theta) * Math.cos(orient.tiltX);

    return {
      path,
      cxPct: cxPct.toFixed(1),
      cyPct: cyPct.toFixed(1),
      culling,
    };
  }

  return { project, frame };
}

/** Build an Orientation from degrees (more user-friendly than radians). */
export function orientationFromDegrees(
  tiltXdeg: number,
  tiltZdeg: number,
): Orientation {
  return {
    tiltX: (tiltXdeg * Math.PI) / 180,
    tiltZ: (tiltZdeg * Math.PI) / 180,
  };
}

/** Normalize a 3D vector. */
export function normalize(
  v: readonly [number, number, number],
): [number, number, number] {
  const m = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return [v[0] / m, v[1] / m, v[2] / m];
}

/**
 * Transform a vector from world frame into the shell's body frame.
 * Inverse of project()'s tilt rotations: undo Rz(tiltZ) then undo Rx(tiltX).
 *
 * Use this when you have a world-fixed direction (e.g. a light) and want to
 * express it in the body frame of a shell whose orientation may animate.
 */
export function worldToBody(
  L: readonly [number, number, number],
  orient: Orientation,
): [number, number, number] {
  const cosX = Math.cos(orient.tiltX);
  const sinX = Math.sin(orient.tiltX);
  const cosZ = Math.cos(orient.tiltZ);
  const sinZ = Math.sin(orient.tiltZ);
  // Undo Rz(tiltZ)
  const r1x = L[0] * cosZ + L[1] * sinZ;
  const r1y = -L[0] * sinZ + L[1] * cosZ;
  const r1z = L[2];
  // Undo Rx(tiltX)
  return [r1x, r1y * cosX + r1z * sinX, -r1y * sinX + r1z * cosX];
}

/**
 * Transform a point from a shell's body frame into world frame.
 * Forward composition: Rx(tiltX) then Rz(tiltZ). Mirrors project()'s rotation
 * steps (without the SVG-Y flip or perspective scale).
 */
export function bodyToWorld(
  p: readonly [number, number, number],
  orient: Orientation,
): [number, number, number] {
  const cosX = Math.cos(orient.tiltX);
  const sinX = Math.sin(orient.tiltX);
  const cosZ = Math.cos(orient.tiltZ);
  const sinZ = Math.sin(orient.tiltZ);
  const y1 = p[1] * cosX - p[2] * sinX;
  const z1 = p[1] * sinX + p[2] * cosX;
  return [p[0] * cosZ - y1 * sinZ, p[0] * sinZ + y1 * cosZ, z1];
}

/** Build a comma-separated keyTimes string for N+1 evenly-spaced samples. */
export function buildKeyTimes(N: number): string {
  const kt: string[] = [];
  for (let k = 0; k <= N; k++) kt.push((k / N).toFixed(5));
  return kt.join("; ");
}

/**
 * Generate Fibonacci sphere distribution. Returns N (latitude, longitude)
 * pairs that evenly cover the sphere using the golden-angle algorithm.
 */
export function fibonacciSphere(
  N: number,
): { lat: number; lon: number; idx: number }[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const out: { lat: number; lon: number; idx: number }[] = [];
  for (let i = 0; i < N; i++) {
    const y_i = 1 - (2 * i + 1) / N;
    const lat = Math.asin(y_i);
    const lon = goldenAngle * i;
    out.push({ lat, lon, idx: i });
  }
  return out;
}
