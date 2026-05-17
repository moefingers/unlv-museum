/**
 * v2 / Step 3 — full Fibonacci sphere, static sphere, static POINT light.
 *
 * Extends Step 2 to all latitudes/longitudes. Per-bead L = normalize(P − C).
 * Face-culling via opacity hides the back hemisphere entirely.
 *
 * Verification:
 *   Q1: Across the entire visible (front) hemisphere, do all bead highlights
 *       visibly point toward the on-screen light icon? In particular at top,
 *       sides, and bottom — not just the equator.
 *
 * Usage: pnpm tsx scripts/banner-experiments-v2/gen-step3-fibonacci-point-light.mts [N]
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

const N = Number(process.argv[2] ?? 150);
const RX = 140;
const R = 9;
const D = 4 * RX;
const TILT_X = Math.atan(44 / 140);
const TILT_Z = 0;

// Point-light world position — same as Step 2, upper-front-left.
const P_LIGHT: [number, number, number] = [-90, 110, 220];

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

// Fibonacci-sphere lat/lon generator.
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
  initZ: number;
  path: string;
  gradId: string;
  gradCxPct: number;
  gradCyPct: number;
  opacity: number;
  hue: number;
}

const beads: Bead[] = [];
const samples = fibonacciSphere(N);
const cosX0 = Math.cos(TILT_X);
const sinX0 = Math.sin(TILT_X);

for (let i = 0; i < samples.length; i++) {
  const { lat, lon } = samples[i]!;
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const theta = lon;
  const cx3 = RX * cosLat * Math.sin(theta);
  const cy3 = RX * sinLat;
  const cz3 = RX * cosLat * Math.cos(theta);

  // Per-bead L = normalize(P_light - C).
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
  const gradCxPct = ((highlightProj.x - bbox.minX) / bbW) * 100;
  const gradCyPct = ((highlightProj.y - bbox.minY) / bbH) * 100;

  // Z-depth (post-orient) for back-to-front sort and face-culling opacity.
  const z1 = cy3 * sinX0 + cz3 * cosX0;
  const opacity = Math.max(0, culling);
  const hue = ((lat / Math.PI) + 0.5) * 360;

  beads.push({
    initZ: z1,
    path,
    gradId: `b${i}`,
    gradCxPct,
    gradCyPct,
    opacity,
    hue,
  });
}

beads.sort((a, b) => a.initZ - b.initZ);

const iconProj = project(P_LIGHT[0], P_LIGHT[1], P_LIGHT[2]);

const gradients = beads
  .map(
    (b) =>
      `<radialGradient id="${b.gradId}" cx="${b.gradCxPct.toFixed(1)}%" cy="${b.gradCyPct.toFixed(1)}%" r="75%"><stop offset="0%" stop-color="hsl(${b.hue.toFixed(0)},80%,88%)"/><stop offset="55%" stop-color="hsl(${b.hue.toFixed(0)},75%,45%)"/><stop offset="100%" stop-color="hsl(${b.hue.toFixed(0)},85%,10%)"/></radialGradient>`,
  )
  .join("\n    ");

const beadEls = beads
  .map((b) => `<path fill="url(#${b.gradId})" d="${b.path}" opacity="${b.opacity.toFixed(3)}"/>`)
  .join("\n    ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 320" width="800" height="320" role="img" aria-label="Step 3 — fibonacci sphere, point light">
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

  <text class="label" x="40" y="40">v2 · Step 3</text>
  <text class="title" x="40" y="68">Fibonacci sphere · static · point light</text>
  <text class="sub"   x="40" y="92">N=${N}. P_light=(${P_LIGHT[0]},${P_LIGHT[1]},${P_LIGHT[2]}). Per-bead L = normalize(P − C). Back-face culling via opacity. No Lambert mask.</text>

  <g transform="translate(500 200)">
    ${beadEls}
    <circle cx="${iconProj.x.toFixed(2)}" cy="${iconProj.y.toFixed(2)}" r="${(40 * iconProj.s).toFixed(2)}" fill="url(#lightIcon)"/>
    <circle cx="${iconProj.x.toFixed(2)}" cy="${iconProj.y.toFixed(2)}" r="${(5 * iconProj.s).toFixed(2)}" fill="#fffbeb"/>
  </g>
</svg>`;

const outPath = resolve(
  projectRoot,
  `public/banner-experiments-v2/step3-fibonacci-point-light${N === 150 ? "" : `-${N}`}.svg`,
);
writeFileSync(outPath, svg);
console.log(`Wrote ${(svg.length / 1024).toFixed(1)} KB → ${outPath}  (N=${N})`);
