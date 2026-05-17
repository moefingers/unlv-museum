/**
 * v2 / Step 2 — equator row, static sphere, static POINT light.
 *
 * Same setup as Step 1, but the light is a fixed point in 3D rather than a
 * direction. Each bead computes its own L_unit = normalize(P_light - C), so
 * neighboring beads get *different* light directions. With the light placed
 * close in front, highlights should visibly fan out from the projected light
 * position — i.e. the gradient bright-spot on every bead should point AT the
 * light icon.
 *
 * Verification:
 *   Q1: Do the gradient bright-spots on the front beads all visibly point
 *       toward the on-screen light icon? (the "convergence" the user expects)
 *   Q2: Do beads farther from the light direction (sides) still pick up a
 *       sensible highlight position, given they're still partially lit?
 *
 * Light is in WORLD frame (= camera frame here, since the sphere has a static
 * orient; world ≡ camera until we add per-shell body frames). No Lambert mask.
 *
 * Usage: pnpm tsx scripts/banner-experiments-v2/gen-step2-equator-point-light.mts
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

const RX = 140;
const R = 12;
const D = 4 * RX;
const TILT_X = Math.atan(44 / 140);
const TILT_Z = 0;
const N_BEADS = 7;
const ICON_DIST = 220;

// Point-light world position. Place close in front + slightly upper-left so
// the convergence is visually obvious. Keep it OUTSIDE the sphere (|P| > RX).
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

interface Bead {
  theta: number;
  Lx: number;
  Ly: number;
  Lz: number;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  path: string;
  gradCxPct: number;
  gradCyPct: number;
  litDot: number;
  culling: number;
  gradId: string;
}

const sinLat = 0;
const cosLat = 1;
const beads: Bead[] = [];
for (let i = 0; i < N_BEADS; i++) {
  const t = N_BEADS === 1 ? 0.5 : i / (N_BEADS - 1);
  const theta = -Math.PI / 2 + t * Math.PI;
  const cx3 = RX * cosLat * Math.sin(theta);
  const cy3 = RX * sinLat;
  const cz3 = RX * cosLat * Math.cos(theta);

  // Per-bead light direction = normalized (P_light - C).
  const dx = P_LIGHT[0] - cx3;
  const dy = P_LIGHT[1] - cy3;
  const dz = P_LIGHT[2] - cz3;
  const dm = Math.hypot(dx, dy, dz);
  const Lx = dx / dm;
  const Ly = dy / dm;
  const Lz = dz / dm;

  const { path, bbox, culling } = beadPath(cx3, cy3, cz3, theta, sinLat, cosLat);
  const highlightProj = project(cx3 + R * Lx, cy3 + R * Ly, cz3 + R * Lz);

  const bbW = bbox.maxX - bbox.minX;
  const bbH = bbox.maxY - bbox.minY;
  const gradCxPct = ((highlightProj.x - bbox.minX) / bbW) * 100;
  const gradCyPct = ((highlightProj.y - bbox.minY) / bbH) * 100;

  const litDot =
    cosLat * Math.sin(theta) * Lx + sinLat * Ly + cosLat * Math.cos(theta) * Lz;

  beads.push({
    theta,
    Lx,
    Ly,
    Lz,
    bbox,
    path,
    gradCxPct,
    gradCyPct,
    litDot,
    culling,
    gradId: `b${i}`,
  });
}

// Light icon: project the actual world-frame point light position.
const iconProj = project(P_LIGHT[0], P_LIGHT[1], P_LIGHT[2]);

const gradients = beads
  .map(
    (b) =>
      `<radialGradient id="${b.gradId}" cx="${b.gradCxPct.toFixed(1)}%" cy="${b.gradCyPct.toFixed(1)}%" r="75%"><stop offset="0%" stop-color="#fff"/><stop offset="55%" stop-color="#6366f1"/><stop offset="100%" stop-color="#0f0f1f"/></radialGradient>`,
  )
  .join("\n    ");

const beadEls = beads
  .map((b) => `<path fill="url(#${b.gradId})" d="${b.path}"/>`)
  .join("\n    ");

const rows = beads
  .map(
    (b, i) =>
      `[bead ${i}] θ=${((b.theta * 180) / Math.PI).toFixed(0)}°  ` +
      `L=(${b.Lx.toFixed(2)},${b.Ly.toFixed(2)},${b.Lz.toFixed(2)})  ` +
      `cx/cy=${b.gradCxPct.toFixed(1)}%/${b.gradCyPct.toFixed(1)}%  ` +
      `N·L=${b.litDot.toFixed(3)}  ` +
      `cull=${b.culling.toFixed(3)}`,
  )
  .join("\n");
console.log(rows);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 320" width="800" height="320" role="img" aria-label="Step 2 — equator row, point light">
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
      .sphereGuide { fill: none; stroke: #1f1f23; stroke-width: 1; stroke-dasharray: 2 4; }
    </style>
  </defs>

  <rect class="bg" width="800" height="320"/>

  <text class="label" x="40" y="40">v2 · Step 2</text>
  <text class="title" x="40" y="68">Equator row · static sphere · point light</text>
  <text class="sub"   x="40" y="92">P_light=(${P_LIGHT[0]},${P_LIGHT[1]},${P_LIGHT[2]}). Each bead computes its own L = normalize(P − C). No Lambert mask.</text>

  <g transform="translate(500 200)">
    <ellipse class="sphereGuide" cx="0" cy="0" rx="${RX}" ry="${(RX * Math.cos(TILT_X)).toFixed(2)}"/>
    ${beadEls}
    <circle cx="${iconProj.x.toFixed(2)}" cy="${iconProj.y.toFixed(2)}" r="${(40 * iconProj.s).toFixed(2)}" fill="url(#lightIcon)"/>
    <circle cx="${iconProj.x.toFixed(2)}" cy="${iconProj.y.toFixed(2)}" r="${(5 * iconProj.s).toFixed(2)}" fill="#fffbeb"/>
  </g>
</svg>`;

const outPath = resolve(
  projectRoot,
  "public/banner-experiments-v2/step2-equator-point-light.svg",
);
writeFileSync(outPath, svg);
console.log(`Wrote ${(svg.length / 1024).toFixed(1)} KB → ${outPath}`);
