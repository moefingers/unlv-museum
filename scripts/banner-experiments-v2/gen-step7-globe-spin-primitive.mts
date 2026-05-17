/**
 * v2 / Step 7 — globe spin with primitive-driven animations.
 *
 * Goal: maximum temporal fidelity. Every property that maps to a continuous
 * SVG primitive (motion path, rotation) is animated as such; samples appear
 * only where SVG genuinely forces them (scalar attributes with non-linear
 * time dependence — radius, opacity).
 *
 * Each bead is a sphere billboard (always perfectly round in 2D). The sphere
 * spins around its tilted body-Y axis (theta walks 0 → 2π over the cycle).
 *
 * Per bead:
 *   - 2D position: 4-cubic-bezier ellipse mpath, fitted to the exact
 *     perspective-projected trajectory of the bead's 3D latitude circle.
 *     Driven by <animateMotion>. Smooth-exact.
 *   - Highlight sweep: the world-fixed light, in the bead's body frame,
 *     rotates around the bead at the spin rate. Driven by <animateTransform
 *     rotate> on gradientTransform around the bead's bbox center. Smooth.
 *   - Radius (perspective scale): sampled 12× + linear interp (no easing
 *     that causes visible sample pauses). Polygonal in value space but
 *     visually smooth at this density.
 *   - Opacity (face culling): same — 12 samples + linear interp.
 *
 * Z-sort is static at t=0 (SMIL has no dynamic reorder). Beads on the far
 * side of the cycle are face-culled to opacity 0; the residual ordering
 * artifact is fundamental to single-pass SVG and isn't an animation issue.
 *
 * Usage:
 *   pnpm tsx scripts/banner-experiments-v2/gen-step7-globe-spin-primitive.mts [N] [dur] [Lx] [Ly] [Lz]
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

const N = Number(process.argv[2] ?? 150);
const DUR = process.argv[3] ?? "18s";

const RX = 140;
const R = 9;
const D = 4 * RX;
const TILT_X = Math.atan(44 / 140);
const N_R_SAMPLES = 12;

const DEFAULT_P: [number, number, number] = [-90, 110, 220];
const P_LIGHT: [number, number, number] = [
  Number(process.argv[4] ?? DEFAULT_P[0]),
  Number(process.argv[5] ?? DEFAULT_P[1]),
  Number(process.argv[6] ?? DEFAULT_P[2]),
];

const BC = 0.5522847498; // bezier-circle magic constant

/**
 * Transform a body-frame point through:
 *   1. Body-Y rotation by spinAngle (the theta-walk)
 *   2. World-X rotation by TILT_X (the static base tilt)
 * Returns the camera-frame point.
 */
function bodyToCamera(
  x: number,
  y: number,
  z: number,
  spinAngle: number,
): [number, number, number] {
  const cosS = Math.cos(spinAngle);
  const sinS = Math.sin(spinAngle);
  // R_y(spinAngle): rotates (x, z) keeping y
  const x1 = x * cosS + z * sinS;
  const y1 = y;
  const z1 = -x * sinS + z * cosS;
  // R_x(TILT_X): rotates (y, z) keeping x
  const cosX = Math.cos(TILT_X);
  const sinX = Math.sin(TILT_X);
  return [x1, y1 * cosX - z1 * sinX, y1 * sinX + z1 * cosX];
}

function perspective(x: number, y: number, z: number): {
  x: number;
  y: number;
  s: number;
} {
  const s = D / (D - z);
  return { x: x * s, y: -y * s, s };
}

function fibonacciSphere(n: number): { lat: number; lon: number }[] {
  const ga = Math.PI * (3 - Math.sqrt(5));
  const out: { lat: number; lon: number }[] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * i + 1) / n;
    out.push({ lat: Math.asin(y), lon: ga * i });
  }
  return out;
}

/**
 * Given an array of (x, y) trajectory samples, fit an ellipse via PCA.
 * Returns center, semi-axes, and orientation. PCA on a closed curve
 * recovers the true bounding ellipse exactly when the curve IS an ellipse.
 */
function fitEllipse(pts: { x: number; y: number }[]): {
  xc: number;
  yc: number;
  a: number;
  b: number;
  phi: number;
} {
  const n = pts.length;
  let xc = 0;
  let yc = 0;
  for (const p of pts) {
    xc += p.x;
    yc += p.y;
  }
  xc /= n;
  yc /= n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of pts) {
    const dx = p.x - xc;
    const dy = p.y - yc;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  sxx /= n;
  syy /= n;
  sxy /= n;
  const tr = sxx + syy;
  const disc = Math.sqrt(Math.max(0, ((sxx - syy) / 2) ** 2 + sxy * sxy));
  const lambdaMax = tr / 2 + disc;
  const lambdaMin = tr / 2 - disc;
  // For uniform sampling around an ellipse, variance = (semi-axis)^2 / 2.
  const a = Math.sqrt(2 * Math.max(0, lambdaMax));
  const b = Math.sqrt(2 * Math.max(0, lambdaMin));
  // Eigenvector for lambdaMax (major axis direction).
  let vx: number;
  let vy: number;
  if (Math.abs(sxy) > 1e-9) {
    vx = sxy;
    vy = lambdaMax - sxx;
  } else if (sxx >= syy) {
    vx = 1;
    vy = 0;
  } else {
    vx = 0;
    vy = 1;
  }
  const m = Math.hypot(vx, vy);
  if (m > 1e-9) {
    vx /= m;
    vy /= m;
  }
  const phi = Math.atan2(vy, vx);
  return { xc, yc, a, b, phi };
}

/**
 * Generate a 4-cubic-bezier-segment ellipse path (the standard magic-constant
 * approximation; max radial error 0.027%). Path starts at angle 0 (major-axis
 * endpoint after rotation by phi).
 */
function ellipsePath(
  xc: number,
  yc: number,
  a: number,
  b: number,
  phi: number,
): string {
  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);
  // Local-frame anchors at angles 0, π/2, π, 3π/2 on the (a, b)-scaled
  // ellipse, and handles offset by BC·b or BC·a.
  const local: [number, number][] = [
    [a, 0],
    [a, BC * b],
    [BC * a, b],
    [0, b],
    [-BC * a, b],
    [-a, BC * b],
    [-a, 0],
    [-a, -BC * b],
    [-BC * a, -b],
    [0, -b],
    [BC * a, -b],
    [a, -BC * b],
  ];
  const world = local.map(([lx, ly]) => [
    xc + lx * cosP - ly * sinP,
    yc + lx * sinP + ly * cosP,
  ] as [number, number]);
  const f = (i: number) => `${world[i]![0].toFixed(2)},${world[i]![1].toFixed(2)}`;
  return `M${f(0)} C${f(1)} ${f(2)} ${f(3)} C${f(4)} ${f(5)} ${f(6)} C${f(7)} ${f(8)} ${f(9)} C${f(10)} ${f(11)} ${f(0)} Z`;
}

/**
 * Compute the starting-angle offset (in degrees) so that the bead's <circle>
 * with `cx=xc cy=yc` plus animateMotion on a path that starts at the first
 * sample lines up with the actual t=0 sample. Used for keyframe phase
 * alignment.
 */
function startAngleDeg(
  first: { x: number; y: number },
  xc: number,
  yc: number,
  a: number,
  b: number,
  phi: number,
): number {
  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);
  const dx = first.x - xc;
  const dy = first.y - yc;
  // R(-phi)
  const lx = dx * cosP + dy * sinP;
  const ly = -dx * sinP + dy * cosP;
  // Recover angle along the ellipse: atan2(ly/b, lx/a)
  return (Math.atan2(ly / Math.max(b, 1e-6), lx / Math.max(a, 1e-6)) * 180) /
    Math.PI;
}

interface Bead {
  initZ: number;
  pathStr: string;
  startAngleDeg: number;
  sweepDeg: 360 | -360;
  rSamples: string[];
  opSamples: string[];
  // Highlight gradient: trace its position in OBB through the spin.
  gradXc: number;
  gradYc: number;
  gradA: number;
  gradB: number;
  gradPhi: number;
  gradStartAngleDeg: number;
  gradSweepDeg: 360 | -360;
  initR: number;
  initOp: number;
  initCx: number;
  initCy: number;
  gradId: string;
  hue: number;
}

const N_TRAJ = 96;
const beads: Bead[] = [];
for (const { lat, lon } of fibonacciSphere(N)) {
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const bx = RX * cosLat * Math.sin(lon);
  const by = RX * sinLat;
  const bz = RX * cosLat * Math.cos(lon);
  const nbx = cosLat * Math.sin(lon);
  const nby = sinLat;
  const nbz = cosLat * Math.cos(lon);

  // 1. Trajectory ellipse fit.
  const traj: { x: number; y: number }[] = [];
  for (let k = 0; k < N_TRAJ; k++) {
    const ang = (k / N_TRAJ) * 2 * Math.PI;
    const cam = bodyToCamera(bx, by, bz, ang);
    const p = perspective(cam[0], cam[1], cam[2]);
    traj.push({ x: p.x, y: p.y });
  }
  const fit = fitEllipse(traj);
  const pathStr = ellipsePath(fit.xc, fit.yc, fit.a, fit.b, fit.phi);
  const startAng = startAngleDeg(traj[0]!, fit.xc, fit.yc, fit.a, fit.b, fit.phi);
  // Direction along the ellipse: angle 0→1 vs the ellipse parameterization.
  const a0 = startAng;
  const startAng1 = startAngleDeg(traj[1]!, fit.xc, fit.yc, fit.a, fit.b, fit.phi);
  let d = startAng1 - a0;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  const sweepDeg: 360 | -360 = d >= 0 ? 360 : -360;

  // 2. Radius + opacity sample arrays (12 samples).
  const rSamples: string[] = [];
  const opSamples: string[] = [];
  for (let k = 0; k <= N_R_SAMPLES; k++) {
    const t = k / N_R_SAMPLES;
    const ang = t * 2 * Math.PI;
    const cam = bodyToCamera(bx, by, bz, ang);
    const p = perspective(cam[0], cam[1], cam[2]);
    rSamples.push((R * p.s).toFixed(2));
    const nCam = bodyToCamera(nbx, nby, nbz, ang);
    opSamples.push(Math.max(0, nCam[2]).toFixed(3));
  }

  // 3. Highlight gradient trajectory in OBB.
  // For a sphere bead, the highlight offset from bead-center in screen is
  // approximately R·s·(L_x_screen, -L_y_screen) where L_x_screen, L_y_screen
  // are the screen-projection of the world-frame L unit vector (P - C).
  // As percent of bbox (which is 2·R·s wide and tall): cxPct = 50 + 50·L_x.
  const gradTraj: { x: number; y: number }[] = [];
  for (let k = 0; k < N_TRAJ; k++) {
    const ang = (k / N_TRAJ) * 2 * Math.PI;
    const cam = bodyToCamera(bx, by, bz, ang);
    const dx = P_LIGHT[0] - cam[0];
    const dy = P_LIGHT[1] - cam[1];
    const dz = P_LIGHT[2] - cam[2];
    const dm = Math.hypot(dx, dy, dz);
    const Lx = dx / dm;
    const Ly = dy / dm;
    const Lz = dz / dm;
    // Highlight screen-space offset = R·s·(L_x, -L_y) ÷ (2·R·s) → 50 + 50·L_x
    // (with the sign flip on y for SVG y-down).
    const hCam = [cam[0] + R * Lx, cam[1] + R * Ly, cam[2] + R * Lz];
    const hProj = perspective(hCam[0], hCam[1], hCam[2]);
    const cProj = perspective(cam[0], cam[1], cam[2]);
    const bbox = 2 * R * cProj.s;
    const cxPct = 50 + ((hProj.x - cProj.x) / bbox) * 100;
    const cyPct = 50 + ((hProj.y - cProj.y) / bbox) * 100;
    gradTraj.push({ x: cxPct, y: cyPct });
  }
  const gFit = fitEllipse(gradTraj);
  const gStartAng = startAngleDeg(
    gradTraj[0]!,
    gFit.xc,
    gFit.yc,
    gFit.a,
    gFit.b,
    gFit.phi,
  );
  const gStartAng1 = startAngleDeg(
    gradTraj[1]!,
    gFit.xc,
    gFit.yc,
    gFit.a,
    gFit.b,
    gFit.phi,
  );
  let gd = gStartAng1 - gStartAng;
  if (gd > 180) gd -= 360;
  if (gd < -180) gd += 360;
  const gSweepDeg: 360 | -360 = gd >= 0 ? 360 : -360;

  // Initial state at t=0.
  const cam0 = bodyToCamera(bx, by, bz, 0);
  const p0 = perspective(cam0[0], cam0[1], cam0[2]);
  const nCam0 = bodyToCamera(nbx, nby, nbz, 0);
  const hue = ((lat / Math.PI) + 0.5) * 360;

  beads.push({
    initZ: cam0[2],
    pathStr,
    startAngleDeg: startAng,
    sweepDeg,
    rSamples,
    opSamples,
    gradXc: gFit.xc,
    gradYc: gFit.yc,
    gradA: gFit.a,
    gradB: gFit.b,
    gradPhi: (gFit.phi * 180) / Math.PI,
    gradStartAngleDeg: gStartAng,
    gradSweepDeg: gSweepDeg,
    initR: R * p0.s,
    initOp: Math.max(0, nCam0[2]),
    initCx: gradTraj[0]!.x,
    initCy: gradTraj[0]!.y,
    gradId: `b${beads.length}`,
    hue,
  });
}

beads.sort((a, b) => a.initZ - b.initZ);

const iconProj = perspective(P_LIGHT[0], P_LIGHT[1], P_LIGHT[2]);

const keyTimes: string[] = [];
for (let k = 0; k <= N_R_SAMPLES; k++) {
  keyTimes.push((k / N_R_SAMPLES).toFixed(5));
}
const keyTimesStr = keyTimes.join("; ");

// Per-bead gradient: gradient center traces an ellipse in OBB.
// Underlying gradientTransform encodes the static ellipse shape:
//   translate(xc%, yc%) rotate(phi°) scale(a/50, b/50)
// (the /50 is because gradient cx=1 cy=0 starts at OBB unit-radius from origin;
//  we want it to land at semi-axis a in the trajectory's a units, but expressed
//  in OBB-% units where bbox is 100, so divide by 50)
// One animateTransform rotate appends to the right, applied innermost to (1, 0).
//
// Note: gradientUnits is OBB by default. cx/cy are in OBB units (or %). Setting
// cx=1 cy=0 puts the initial gradient center at (100%, 50%) before transform —
// the right-middle edge of the bbox in pre-transform coords.
const gradients = beads
  .map((b) => {
    // The fitted ellipse params are in PERCENT space (cx/cy% values).
    // In OBB units (0..1), 50% = 0.5. So the gradient transform uses /100.
    const xcObb = b.gradXc / 100;
    const ycObb = b.gradYc / 100;
    const aObb = b.gradA / 100;
    const bObb = b.gradB / 100;
    return `<radialGradient id="${b.gradId}" cx="1" cy="0" r="0.75" gradientTransform="translate(${xcObb.toFixed(4)} ${ycObb.toFixed(4)}) rotate(${b.gradPhi.toFixed(2)}) scale(${aObb.toFixed(4)} ${bObb.toFixed(4)})"><stop offset="0%" stop-color="hsl(${b.hue.toFixed(0)},80%,88%)"/><stop offset="55%" stop-color="hsl(${b.hue.toFixed(0)},75%,45%)"/><stop offset="100%" stop-color="hsl(${b.hue.toFixed(0)},85%,10%)"/><animateTransform attributeName="gradientTransform" type="rotate" from="${b.gradStartAngleDeg.toFixed(2)} 0 0" to="${(b.gradStartAngleDeg + b.gradSweepDeg).toFixed(2)} 0 0" dur="${DUR}" repeatCount="indefinite" additive="sum"/></radialGradient>`;
  })
  .join("\n    ");

const beadEls = beads
  .map((b) => {
    // Each bead is a <g> with animateMotion. Inside, a <circle> at (0,0)
    // with animated r and opacity. The animateMotion's path begins at the
    // bead's t=0 position; rotate keyPoints to phase-align if needed.
    // Use rotate="auto" so the bead's local frame doesn't tumble along
    // the motion path (we want the bead to translate, not rotate).
    return `<g><animateMotion dur="${DUR}" repeatCount="indefinite" path="${b.pathStr}" rotate="0"/><circle cx="0" cy="0" r="${b.initR.toFixed(2)}" fill="url(#${b.gradId})" opacity="${b.initOp.toFixed(3)}"><animate attributeName="r" values="${b.rSamples.join("; ")}" keyTimes="${keyTimesStr}" dur="${DUR}" repeatCount="indefinite"/><animate attributeName="opacity" values="${b.opSamples.join("; ")}" keyTimes="${keyTimesStr}" dur="${DUR}" repeatCount="indefinite"/></circle></g>`;
  })
  .join("\n      ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 320" width="800" height="320" role="img" aria-label="Step 7 — globe spin, primitive-driven">
  <defs>
    ${gradients}
    <radialGradient id="lightIcon" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fffbeb"/>
      <stop offset="60%" stop-color="#fde68a" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#fde68a" stop-opacity="0"/>
    </radialGradient>
    <style>
      .bg { fill: #050505; }
      .label { font: 600 13px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #a3a3a3; letter-spacing: 0.05em; text-transform: uppercase; }
      .title { font: 700 22px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #fafafa; }
      .sub { font: 500 12px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #737373; }
    </style>
  </defs>

  <rect class="bg" width="800" height="320"/>

  <text class="label" x="40" y="40">v2 · Step 7</text>
  <text class="title" x="40" y="68">Globe spin · primitive-driven</text>
  <text class="sub"   x="40" y="92">N=${N}, dur=${DUR}. Position + gradient = smooth-exact primitives. Radius + opacity = ${N_R_SAMPLES} linear samples.</text>

  <g transform="translate(500 200)">
    <g>
      ${beadEls}
    </g>
    <circle cx="${iconProj.x.toFixed(2)}" cy="${iconProj.y.toFixed(2)}" r="${(40 * iconProj.s).toFixed(2)}" fill="url(#lightIcon)"/>
    <circle cx="${iconProj.x.toFixed(2)}" cy="${iconProj.y.toFixed(2)}" r="${(5 * iconProj.s).toFixed(2)}" fill="#fffbeb"/>
  </g>
</svg>`;

const sameAsDefault =
  P_LIGHT[0] === DEFAULT_P[0] &&
  P_LIGHT[1] === DEFAULT_P[1] &&
  P_LIGHT[2] === DEFAULT_P[2];
const lightTag = sameAsDefault
  ? ""
  : `-L${P_LIGHT.map((v) => String(v).replace(/-/, "n")).join("_")}`;
const nTag = N === 150 ? "" : `-${N}`;
const outPath = resolve(
  projectRoot,
  `public/banner-experiments-v2/step7-globe-spin-primitive${nTag}${lightTag}.svg`,
);
writeFileSync(outPath, svg);
console.log(`Wrote ${(svg.length / 1024).toFixed(1)} KB → ${outPath}  (N=${N}, dur=${DUR}, P=${P_LIGHT.join(",")})`);
