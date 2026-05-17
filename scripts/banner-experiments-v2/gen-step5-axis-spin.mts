/**
 * v2 / Step 5 — shell precesses, static point light.
 *
 * Builds on Step 3 (static sphere, point light, full Fibonacci coverage) by
 * animating the shell's orient. Beads do NOT walk their latitude (theta is
 * constant per bead); the apparent motion is purely from the shell's tiltZ
 * rotating over the cycle. Light is fixed in CAMERA frame.
 *
 * Key shift from v1: at every keyframe, the bead's body coords are rotated
 * into the camera frame via the current orient, *then* L is computed as
 * normalize(P_light − C_camera). The highlight is projected with perspective
 * only (no second rotation). This way both "where the bead is on screen" and
 * "which way the light hits it" use the same camera-frame data.
 *
 * Verification:
 *   Q1: As the sphere precesses, does every visible bead's bright spot keep
 *       pointing at the on-screen light icon — at every moment of the cycle?
 *   Q2: Does opacity culling cleanly fade beads as they rotate to the back?
 *
 * Usage:
 *   pnpm tsx scripts/banner-experiments-v2/gen-step5-axis-spin.mts [N] [dur] [Lx] [Ly] [Lz]
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

const N = Number(process.argv[2] ?? 150);
const DUR = process.argv[3] ?? "18s";
const N_KF = 60;

const RX = 140;
const R = 9;
const D = 4 * RX;
const TILT_X_BASE = Math.atan(44 / 140);

const DEFAULT_P: [number, number, number] = [-90, 110, 220];
const P_LIGHT: [number, number, number] = [
  Number(process.argv[4] ?? DEFAULT_P[0]),
  Number(process.argv[5] ?? DEFAULT_P[1]),
  Number(process.argv[6] ?? DEFAULT_P[2]),
];

/** Shell orient over the cycle: precess (tiltZ rotates one full turn). */
function orientAt(t: number): { tiltX: number; tiltZ: number } {
  return { tiltX: TILT_X_BASE, tiltZ: 2 * Math.PI * t };
}

/** Rotate body→camera: Rx(tiltX) then Rz(tiltZ). */
function bodyToCamera(
  x: number,
  y: number,
  z: number,
  orient: { tiltX: number; tiltZ: number },
): [number, number, number] {
  const cosX = Math.cos(orient.tiltX);
  const sinX = Math.sin(orient.tiltX);
  const cosZ = Math.cos(orient.tiltZ);
  const sinZ = Math.sin(orient.tiltZ);
  const y1 = y * cosX - z * sinX;
  const z1 = y * sinX + z * cosX;
  const x2 = x * cosZ - y1 * sinZ;
  const y2 = x * sinZ + y1 * cosZ;
  return [x2, y2, z1];
}

/** Apply perspective + SVG-Y flip to a camera-frame point. */
function perspective(x: number, y: number, z: number): {
  x: number;
  y: number;
  s: number;
} {
  const s = D / (D - z);
  return { x: x * s, y: -y * s, s };
}

const BC = 0.5522847498;

function beadPath(
  cx3: number,
  cy3: number,
  cz3: number,
  theta: number,
  sinLat: number,
  cosLat: number,
  orient: { tiltX: number; tiltZ: number },
): {
  path: string;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
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
    const cam = bodyToCamera(p[0], p[1], p[2], orient);
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
  return { path, bbox: { minX, minY, maxX, maxY } };
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

function buildKeyTimes(n: number): string {
  const kt: string[] = [];
  for (let k = 0; k <= n; k++) kt.push((k / n).toFixed(5));
  return kt.join("; ");
}

interface Bead {
  initZ: number;
  paths: string[];
  ops: string[];
  cxs: string[];
  cys: string[];
  gradId: string;
  hue: number;
}

const beads: Bead[] = [];
const samples = fibonacciSphere(N);
const keyTimes = buildKeyTimes(N_KF);

for (let i = 0; i < samples.length; i++) {
  const { lat, lon } = samples[i]!;
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const theta = lon; // no theta walk in step 5

  const cx3 = RX * cosLat * Math.sin(theta);
  const cy3 = RX * sinLat;
  const cz3 = RX * cosLat * Math.cos(theta);

  // Body-frame outward normal (unit) — same value at every keyframe; gets
  // rotated to camera frame per keyframe for culling + Lambert dot.
  const nbx = cosLat * Math.sin(theta);
  const nby = sinLat;
  const nbz = cosLat * Math.cos(theta);

  const paths: string[] = [];
  const ops: string[] = [];
  const cxs: string[] = [];
  const cys: string[] = [];

  for (let k = 0; k <= N_KF; k++) {
    const t = k / N_KF;
    const orient = orientAt(t);

    // Bead center in camera frame (where the light "lives").
    const cCam = bodyToCamera(cx3, cy3, cz3, orient);
    const dx = P_LIGHT[0] - cCam[0];
    const dy = P_LIGHT[1] - cCam[1];
    const dz = P_LIGHT[2] - cCam[2];
    const dm = Math.hypot(dx, dy, dz);
    const Lx = dx / dm;
    const Ly = dy / dm;
    const Lz = dz / dm;

    // Bead surface normal in camera frame — used for opacity culling.
    const nCam = bodyToCamera(nbx, nby, nbz, orient);
    const culling = nCam[2]; // +z = facing camera

    const { path, bbox } = beadPath(cx3, cy3, cz3, theta, sinLat, cosLat, orient);

    // Highlight point in camera frame, then perspective to 2D.
    const hx = cCam[0] + R * Lx;
    const hy = cCam[1] + R * Ly;
    const hz = cCam[2] + R * Lz;
    const hp = perspective(hx, hy, hz);

    const bbW = Math.max(0.01, bbox.maxX - bbox.minX);
    const bbH = Math.max(0.01, bbox.maxY - bbox.minY);

    paths.push(path);
    cxs.push((((hp.x - bbox.minX) / bbW) * 100).toFixed(1));
    cys.push((((hp.y - bbox.minY) / bbH) * 100).toFixed(1));
    ops.push(Math.max(0, culling).toFixed(3));
  }

  // Initial-keyframe depth for the static z-sort.
  const orient0 = orientAt(0);
  const cam0 = bodyToCamera(cx3, cy3, cz3, orient0);
  const hue = ((lat / Math.PI) + 0.5) * 360;

  beads.push({
    initZ: cam0[2],
    paths,
    ops,
    cxs,
    cys,
    gradId: `b${i}`,
    hue,
  });
}

beads.sort((a, b) => a.initZ - b.initZ);

// Light icon — fixed in camera frame.
const iconProj = perspective(P_LIGHT[0], P_LIGHT[1], P_LIGHT[2]);

const gradients = beads
  .map(
    (b) =>
      `<radialGradient id="${b.gradId}" cx="${b.cxs[0]}%" cy="${b.cys[0]}%" r="75%"><stop offset="0%" stop-color="hsl(${b.hue.toFixed(0)},80%,88%)"/><stop offset="55%" stop-color="hsl(${b.hue.toFixed(0)},75%,45%)"/><stop offset="100%" stop-color="hsl(${b.hue.toFixed(0)},85%,10%)"/><animate attributeName="cx" values="${b.cxs.join("%; ")}%" keyTimes="${keyTimes}" dur="${DUR}" repeatCount="indefinite"/><animate attributeName="cy" values="${b.cys.join("%; ")}%" keyTimes="${keyTimes}" dur="${DUR}" repeatCount="indefinite"/></radialGradient>`,
  )
  .join("\n    ");

const beadEls = beads
  .map(
    (b) =>
      `<path fill="url(#${b.gradId})" d="${b.paths[0]}"><animate attributeName="d" values="${b.paths.join("; ")}" keyTimes="${keyTimes}" dur="${DUR}" repeatCount="indefinite"/><animate attributeName="opacity" values="${b.ops.join("; ")}" keyTimes="${keyTimes}" dur="${DUR}" repeatCount="indefinite"/></path>`,
  )
  .join("\n    ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 320" width="800" height="320" role="img" aria-label="Step 5 — shell precess, static light">
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

  <text class="label" x="40" y="40">v2 · Step 5</text>
  <text class="title" x="40" y="68">Shell precess · static light</text>
  <text class="sub"   x="40" y="92">N=${N}, dur=${DUR}. tiltZ walks 0→2π. Beads carried by shell rotation; light stays world-fixed.</text>

  <g transform="translate(500 200)">
    ${beadEls}
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
  `public/banner-experiments-v2/step5-axis-spin${nTag}${lightTag}.svg`,
);
writeFileSync(outPath, svg);
console.log(`Wrote ${(svg.length / 1024).toFixed(1)} KB → ${outPath}  (N=${N}, dur=${DUR}, P=${P_LIGHT.join(",")})`);
