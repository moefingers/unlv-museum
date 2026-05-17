/**
 * v2 / Step 4 — beads spin around static sphere; static point light.
 *
 * Each bead walks its latitude (theta = lon + t * 2π) over the SMIL cycle.
 * Sphere orient is still static. Light is still a fixed world-frame point.
 * The point of this step is to verify that as beads sweep through the front
 * of the sphere, their per-bead L recomputes correctly per keyframe and the
 * highlights stay pinned to the world-fixed light icon.
 *
 * Verification:
 *   Q1: As beads cross the visible hemisphere, does the bright spot on any
 *       given bead always point toward the on-screen light icon?
 *   Q2: When a bead crosses to the back side, does it fade out cleanly (via
 *       opacity culling) before the highlight math gets weird at the rim?
 *
 * Z-sort uses the bead's t=0 depth — SVG/SMIL doesn't reorder dynamically, so
 * crossovers will be visible. That's a known cosmetic limitation of the
 * medium, not a lighting bug.
 *
 * Usage: pnpm tsx scripts/banner-experiments-v2/gen-step4-beads-spin.mts [N] [dur] [Lx] [Ly] [Lz]
 *   Lx, Ly, Lz are the world-frame point-light position (default -90 110 220).
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
const TILT_X = Math.atan(44 / 140);
const TILT_Z = 0;
const DEFAULT_P: [number, number, number] = [-90, 110, 220];
const P_LIGHT: [number, number, number] = [
  Number(process.argv[4] ?? DEFAULT_P[0]),
  Number(process.argv[5] ?? DEFAULT_P[1]),
  Number(process.argv[6] ?? DEFAULT_P[2]),
];

function project(
  x: number,
  y: number,
  z: number,
): { x: number; y: number; s: number; z1: number } {
  const cosX = Math.cos(TILT_X);
  const sinX = Math.sin(TILT_X);
  const cosZ = Math.cos(TILT_Z);
  const sinZ = Math.sin(TILT_Z);
  const y1 = y * cosX - z * sinX;
  const z1 = y * sinX + z * cosX;
  const x2 = x * cosZ - y1 * sinZ;
  const y2 = x * sinZ + y1 * cosZ;
  const s = D / (D - z1);
  return { x: x2 * s, y: -y2 * s, s, z1 };
}

const BC = 0.5522847498;

function beadPath(
  cx3: number,
  cy3: number,
  cz3: number,
  theta: number,
  sinLat: number,
  cosLat: number,
): {
  path: string;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  culling: number;
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

  const pts = [P0, A0, B0, P1, A1, B1, P2, A2, B2, P3, A3, B3].map((p) =>
    project(p[0], p[1], p[2]),
  );
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
  const culling = sinLat * Math.sin(TILT_X) + cosLat * ct * Math.cos(TILT_X);
  return { path, bbox: { minX, minY, maxX, maxY }, culling };
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
const cosX0 = Math.cos(TILT_X);
const sinX0 = Math.sin(TILT_X);
const keyTimes = buildKeyTimes(N_KF);

for (let i = 0; i < samples.length; i++) {
  const { lat, lon } = samples[i]!;
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);

  const paths: string[] = [];
  const ops: string[] = [];
  const cxs: string[] = [];
  const cys: string[] = [];

  for (let k = 0; k <= N_KF; k++) {
    const t = k / N_KF;
    const theta = lon + t * 2 * Math.PI;
    const cx3 = RX * cosLat * Math.sin(theta);
    const cy3 = RX * sinLat;
    const cz3 = RX * cosLat * Math.cos(theta);

    const dx = P_LIGHT[0] - cx3;
    const dy = P_LIGHT[1] - cy3;
    const dz = P_LIGHT[2] - cz3;
    const dm = Math.hypot(dx, dy, dz);
    const Lx = dx / dm;
    const Ly = dy / dm;
    const Lz = dz / dm;

    const { path, bbox, culling } = beadPath(cx3, cy3, cz3, theta, sinLat, cosLat);
    const highlightProj = project(cx3 + R * Lx, cy3 + R * Ly, cz3 + R * Lz);
    const bbW = Math.max(0.01, bbox.maxX - bbox.minX);
    const bbH = Math.max(0.01, bbox.maxY - bbox.minY);

    paths.push(path);
    cxs.push((((highlightProj.x - bbox.minX) / bbW) * 100).toFixed(1));
    cys.push((((highlightProj.y - bbox.minY) / bbH) * 100).toFixed(1));
    ops.push(Math.max(0, culling).toFixed(3));
  }

  const cx0 = RX * cosLat * Math.sin(lon);
  const cy0 = RX * sinLat;
  const cz0 = RX * cosLat * Math.cos(lon);
  const z1 = cy0 * sinX0 + cz0 * cosX0;
  const hue = ((lat / Math.PI) + 0.5) * 360;

  beads.push({
    initZ: z1,
    paths,
    ops,
    cxs,
    cys,
    gradId: `b${i}`,
    hue,
  });
}

beads.sort((a, b) => a.initZ - b.initZ);

const iconProj = project(P_LIGHT[0], P_LIGHT[1], P_LIGHT[2]);

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

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 320" width="800" height="320" role="img" aria-label="Step 4 — beads spin, static light">
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

  <text class="label" x="40" y="40">v2 · Step 4</text>
  <text class="title" x="40" y="68">Beads spin · static sphere · static light</text>
  <text class="sub"   x="40" y="92">N=${N}, dur=${DUR}. θ walks 0→2π. L recomputed per keyframe. Highlights should stay pinned to the icon.</text>

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
  `public/banner-experiments-v2/step4-beads-spin${nTag}${lightTag}.svg`,
);
writeFileSync(outPath, svg);
console.log(`Wrote ${(svg.length / 1024).toFixed(1)} KB → ${outPath}  (N=${N}, dur=${DUR}, P=${P_LIGHT.join(",")})`);
