/**
 * v2 / Step 5b — primitive-driven precess with composed-transform highlight.
 *
 * Same physical scene as Step 5 but built with SVG primitives:
 *
 *   - Each bead: t=0 bezier path (an ellipse — the tangent disc's perspective
 *     projection). Under pure tiltZ rotation the bead's shape doesn't change
 *     (z-depth invariant), so one path per bead is enough.
 *
 *   - All beads inside one <g> with a single <animateTransform rotate>. ONE
 *     animation drives every bead's position AND in-place orientation.
 *
 *   - Highlight position per bead, expressed as a TRANSFORM (not as sampled
 *     cx/cy keyframes). The highlight traces a circle (≈) in OBB; we encode:
 *       • gradient cx = r, cy = 0  (starting point on a unit circle)
 *       • static gradientTransform="translate(xc yc)"  — circle center
 *       • one animated rotate transform — smooth, renderer-interpolated
 *     Total ≈ 3 numbers + 1 animateTransform per bead. No multi-sample baking.
 *
 *   - Opacity static per bead (face-culling z-component is time-invariant
 *     under pure tiltZ rotation).
 *
 * Approximation note: the true highlight trajectory in OBB is the projection
 * of a great-or-small-circle on the unit sphere into 2D, which is *very close
 * to* but not exactly a circle. We fit the best circle (least-squares). For
 * close point lights this approximation has visible residual error; for far
 * point or directional lights it's essentially exact.
 *
 * Usage:
 *   pnpm tsx scripts/banner-experiments-v2/gen-step5b-primitive-precess.mts [N] [dur] [Lx] [Ly] [Lz]
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

const N = Number(process.argv[2] ?? 150);
const DUR = process.argv[3] ?? "18s";
const N_TRAJ_SAMPLES = 64; // resolution of the fit only — not in output

const RX = 140;
const R = 9;
const D = 4 * RX;
const TILT_X = Math.atan(44 / 140);

const DEFAULT_P: [number, number, number] = [-90, 110, 220];
const P_LIGHT: [number, number, number] = [
  Number(process.argv[4] ?? DEFAULT_P[0]),
  Number(process.argv[5] ?? DEFAULT_P[1]),
  Number(process.argv[6] ?? DEFAULT_P[2]),
];

function bodyToCamera(
  x: number,
  y: number,
  z: number,
  tiltZ: number,
): [number, number, number] {
  const cosX = Math.cos(TILT_X);
  const sinX = Math.sin(TILT_X);
  const cosZ = Math.cos(tiltZ);
  const sinZ = Math.sin(tiltZ);
  const y1 = y * cosX - z * sinX;
  const z1 = y * sinX + z * cosX;
  const x2 = x * cosZ - y1 * sinZ;
  const y2 = x * sinZ + y1 * cosZ;
  return [x2, y2, z1];
}

function perspective(x: number, y: number, z: number): {
  x: number;
  y: number;
  s: number;
} {
  const s = D / (D - z);
  return { x: x * s, y: -y * s, s };
}

const BC = 0.5522847498;

function beadPath0(
  cx3: number,
  cy3: number,
  cz3: number,
  theta: number,
  sinLat: number,
  cosLat: number,
): {
  path: string;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  centerProj: { x: number; y: number };
} {
  const st = Math.sin(theta);
  const ct = Math.cos(theta);
  const right: [number, number, number] = [ct, 0, -st];
  const up: [number, number, number] = [-sinLat * st, cosLat, -sinLat * ct];

  const anchor = (sR: number, sU: number): [number, number, number] => [
    cx3 + R * sR * right[0] + R * sU * up[0],
    cy3 + R * sR * right[1] + R * sU * up[1],
    cz3 + R * sR * right[2] + R * sU * up[2],
  ];
  const handle = (
    p: [number, number, number],
    v: [number, number, number],
    sg: number,
  ): [number, number, number] => [
    p[0] + sg * BC * R * v[0],
    p[1] + sg * BC * R * v[1],
    p[2] + sg * BC * R * v[2],
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

  const pts = [P0, A0, B0, P1, A1, B1, P2, A2, B2, P3, A3, B3].map((p) => {
    const cam = bodyToCamera(p[0], p[1], p[2], 0);
    return perspective(cam[0], cam[1], cam[2]);
  });
  let minX = pts[0]!.x;
  let maxX = pts[0]!.x;
  let minY = pts[0]!.y;
  let maxY = pts[0]!.y;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const f = (i: number) => `${pts[i]!.x.toFixed(2)},${pts[i]!.y.toFixed(2)}`;
  const path = `M${f(0)} C${f(1)} ${f(2)} ${f(3)} C${f(4)} ${f(5)} ${f(6)} C${f(7)} ${f(8)} ${f(9)} C${f(10)} ${f(11)} ${f(0)} Z`;
  const cam = bodyToCamera(cx3, cy3, cz3, 0);
  const proj = perspective(cam[0], cam[1], cam[2]);
  return { path, bbox: { minX, minY, maxX, maxY }, centerProj: { x: proj.x, y: proj.y } };
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

interface Bead {
  path: string;
  opacity: number;
  // Highlight trajectory circle in OBB units.
  xc: number;
  yc: number;
  r: number;
  // Starting angle on the circle (in degrees), used to phase-shift the
  // animated rotate so t=0 lines up with the actual t=0 highlight position.
  startAngleDeg: number;
  // Rotation direction: +360 or -360 over the cycle.
  endAngleDeg: number;
  gradId: string;
  hue: number;
  initZ: number;
}

const beads: Bead[] = [];
const samples = fibonacciSphere(N);
for (let i = 0; i < samples.length; i++) {
  const { lat, lon } = samples[i]!;
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const theta = lon;
  const cx3 = RX * cosLat * Math.sin(theta);
  const cy3 = RX * sinLat;
  const cz3 = RX * cosLat * Math.cos(theta);

  const { path, bbox, centerProj } = beadPath0(cx3, cy3, cz3, theta, sinLat, cosLat);
  const bbW = Math.max(0.01, bbox.maxX - bbox.minX);
  const bbH = Math.max(0.01, bbox.maxY - bbox.minY);

  // Sample the trajectory in OBB units, then fit a circle (center=mean,
  // radius=mean distance from center).
  const trajX: number[] = [];
  const trajY: number[] = [];
  for (let k = 0; k < N_TRAJ_SAMPLES; k++) {
    const t = k / N_TRAJ_SAMPLES;
    const tiltZ = 2 * Math.PI * t;
    const camT = bodyToCamera(cx3, cy3, cz3, tiltZ);
    const dx = P_LIGHT[0] - camT[0];
    const dy = P_LIGHT[1] - camT[1];
    const dz = P_LIGHT[2] - camT[2];
    const dm = Math.hypot(dx, dy, dz);
    const Lx = dx / dm;
    const Ly = dy / dm;
    const Lz = dz / dm;
    const hCam = [camT[0] + R * Lx, camT[1] + R * Ly, camT[2] + R * Lz];
    const hProj = perspective(hCam[0], hCam[1], hCam[2]);
    const cProj = perspective(camT[0], camT[1], camT[2]);
    const ox = hProj.x - cProj.x;
    const oy = hProj.y - cProj.y;
    // Counter-rotate to bead's t=0 local frame (the group's rotation will
    // re-apply +tiltZ at render time).
    const c = Math.cos(-tiltZ);
    const s = Math.sin(-tiltZ);
    const ox0 = ox * c - oy * s;
    const oy0 = ox * s + oy * c;
    // Bbox-relative percentage as decimal in OBB [0..1].
    const cxObb = (centerProj.x + ox0 - bbox.minX) / bbW;
    const cyObb = (centerProj.y + oy0 - bbox.minY) / bbH;
    trajX.push(cxObb);
    trajY.push(cyObb);
  }

  // Fit circle.
  let xc = 0;
  let yc = 0;
  for (let k = 0; k < N_TRAJ_SAMPLES; k++) {
    xc += trajX[k]!;
    yc += trajY[k]!;
  }
  xc /= N_TRAJ_SAMPLES;
  yc /= N_TRAJ_SAMPLES;
  let radius = 0;
  for (let k = 0; k < N_TRAJ_SAMPLES; k++) {
    radius += Math.hypot(trajX[k]! - xc, trajY[k]! - yc);
  }
  radius /= N_TRAJ_SAMPLES;

  // Starting angle: where on the circle is sample 0?
  // We want the gradient at t=0 to be at the starting angle so the bright
  // spot lands at trajX[0], trajY[0] when the rotate is at 0°.
  // After gradientTransform = translate(xc, yc) and an additional rotate(α),
  // starting cx/cy = (r, 0) (a point on the unit-radius circle scaled by r)
  // maps to (xc + r·cos α, yc + r·sin α). At α=0 it's at (xc + r, yc).
  // To start at (trajX[0], trajY[0]):
  //   trajX[0] - xc = r·cos(start),  trajY[0] - yc = r·sin(start)
  const startAngle = Math.atan2(trajY[0]! - yc, trajX[0]! - xc);
  const startAngleDeg = (startAngle * 180) / Math.PI;

  // Rotation direction: angle from sample 0 to sample 1 around (xc, yc).
  // Choose +360 or -360 to match.
  const a0 = Math.atan2(trajY[0]! - yc, trajX[0]! - xc);
  const a1 = Math.atan2(trajY[1]! - yc, trajX[1]! - xc);
  let d = a1 - a0;
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  const sweep = d >= 0 ? 360 : -360;
  const endAngleDeg = startAngleDeg + sweep;

  const cam0 = bodyToCamera(cx3, cy3, cz3, 0);
  const nbx = cosLat * Math.sin(theta);
  const nby = sinLat;
  const nbz = cosLat * Math.cos(theta);
  const nCam0 = bodyToCamera(nbx, nby, nbz, 0);
  const opacity = Math.max(0, nCam0[2]);
  const hue = ((lat / Math.PI) + 0.5) * 360;

  beads.push({
    path,
    opacity,
    xc,
    yc,
    r: radius,
    startAngleDeg,
    endAngleDeg,
    gradId: `b${i}`,
    hue,
    initZ: cam0[2],
  });
}

beads.sort((a, b) => a.initZ - b.initZ);

const iconProj = perspective(P_LIGHT[0], P_LIGHT[1], P_LIGHT[2]);

// Per-bead radialGradient. cx=r cy=0 in OBB (unit-circle point at angle 0
// scaled by the trajectory radius). Static translate moves the circle center
// to (xc, yc). One animated rotate sweeps the gradient around (0, 0) — which,
// because the translate is applied AFTER (it's the underlying transform that
// appears LEFT of the appended animation in the resulting transform list),
// puts the rotated point at (xc + r·cos α, yc + r·sin α).
const gradients = beads
  .map(
    (b) =>
      `<radialGradient id="${b.gradId}" cx="${b.r.toFixed(4)}" cy="0" r="0.75" gradientTransform="translate(${b.xc.toFixed(4)} ${b.yc.toFixed(4)})"><stop offset="0%" stop-color="hsl(${b.hue.toFixed(0)},80%,88%)"/><stop offset="55%" stop-color="hsl(${b.hue.toFixed(0)},75%,45%)"/><stop offset="100%" stop-color="hsl(${b.hue.toFixed(0)},85%,10%)"/><animateTransform attributeName="gradientTransform" type="rotate" from="${b.startAngleDeg.toFixed(2)} 0 0" to="${b.endAngleDeg.toFixed(2)} 0 0" dur="${DUR}" repeatCount="indefinite" additive="sum"/></radialGradient>`,
  )
  .join("\n    ");

const beadEls = beads
  .map(
    (b) =>
      `<path d="${b.path}" fill="url(#${b.gradId})" opacity="${b.opacity.toFixed(3)}"/>`,
  )
  .join("\n      ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 320" width="800" height="320" role="img" aria-label="Step 5b — composed-transform precess">
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

  <text class="label" x="40" y="40">v2 · Step 5b</text>
  <text class="title" x="40" y="68">Primitive precess · composed-transform highlight</text>
  <text class="sub"   x="40" y="92">N=${N}, dur=${DUR}. One animateTransform rotate per bead drives a smooth circular highlight sweep — no sampled keyframes.</text>

  <g transform="translate(500 200)">
    <g>
      ${beadEls}
      <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="${DUR}" repeatCount="indefinite"/>
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
  `public/banner-experiments-v2/step5b-primitive-precess${nTag}${lightTag}.svg`,
);
writeFileSync(outPath, svg);
console.log(`Wrote ${(svg.length / 1024).toFixed(1)} KB → ${outPath}  (N=${N}, dur=${DUR}, P=${P_LIGHT.join(",")})`);
