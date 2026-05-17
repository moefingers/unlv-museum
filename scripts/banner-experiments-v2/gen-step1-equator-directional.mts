/**
 * v2 / Step 1 — equator row, static sphere, static directional light.
 *
 * Goal: visually confirm the *raw* highlight math is correct on a clean,
 * minimal case before adding any further effect. Every formula is inline (no
 * sphere-math import) so each step can be audited in one file.
 *
 * What you should see:
 *   - 7 beads in a horizontal arc across the front of the sphere.
 *   - A red line from each bead's projected center to a small white "expected
 *     highlight" dot. This is the projected point C + r·L_world — where the
 *     light hits the bead's surface in 3D.
 *   - Inside each bead, a radial gradient whose bright spot should sit on top
 *     of the white dot (the gradient is driven by the same projected
 *     highlight, expressed as % of the bead's 2D bbox).
 *   - Light icon (yellow glow) projected from L_world × ICON_DIST.
 *
 * Verification questions:
 *   Q1: Does every white dot fall inside its bead's projected circle?
 *   Q2: Does the gradient highlight inside each bead align with the white dot?
 *   Q3: Do the red lines all visually point toward the same light direction?
 *
 * No Lambert masking, no animation, no per-shell orientation, no perspective
 * complication. If this step is wrong, the bug is in the highlight projection
 * itself, not in any later layer.
 *
 * Usage: pnpm tsx scripts/banner-experiments-v2/gen-step1-equator-directional.mts
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

// World-frame light direction (normalized). Upper-front-left.
function norm3(v: [number, number, number]): [number, number, number] {
  const m = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / m, v[1] / m, v[2] / m];
}
const L: [number, number, number] = norm3([-0.5, 0.6, 0.7]);

// Project a 3D body-frame point through the orient + perspective pipeline.
// Returns [x2d, y2d_svg_down, perspScale, z_after_tiltX].
function project(
  x: number,
  y: number,
  z: number,
): { x: number; y: number; s: number; z1: number } {
  const cosX = Math.cos(TILT_X);
  const sinX = Math.sin(TILT_X);
  const cosZ = Math.cos(TILT_Z);
  const sinZ = Math.sin(TILT_Z);
  // tiltX: rotate (y,z) about X
  const y1 = y * cosX - z * sinX;
  const z1 = y * sinX + z * cosX;
  // tiltZ: rotate (x,y1) about Z
  const x2 = x * cosZ - y1 * sinZ;
  const y2 = x * sinZ + y1 * cosZ;
  const s = D / (D - z1);
  return { x: x2 * s, y: -y2 * s, s, z1 };
}

// Bezier circle constant — 4-segment cubic approximating a circle.
const BC = 0.5522847498;

function beadPath(cx3: number, cy3: number, cz3: number, theta: number, sinLat: number, cosLat: number): {
  path: string;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  culling: number;
} {
  const st = Math.sin(theta);
  const ct = Math.cos(theta);
  // Local tangent basis at the bead center on the sphere surface.
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

  // Face-culling: z-component of outward normal AFTER tiltX (tiltZ preserves z).
  const culling = sinLat * Math.sin(TILT_X) + cosLat * ct * Math.cos(TILT_X);
  return { path, bbox: { minX, minY, maxX, maxY }, culling };
}

interface Bead {
  // Body-frame data
  theta: number;
  cx3: number;
  cy3: number;
  cz3: number;
  // 2D rendered data
  path: string;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  centerProj: { x: number; y: number };
  highlightProj: { x: number; y: number };
  gradCxPct: number;
  gradCyPct: number;
  litDot: number;
  culling: number;
  gradId: string;
}

// 7 beads on the equator (lat = 0), evenly spaced across the FRONT 180°.
// theta = -π/2 .. +π/2  →  cos(theta) > 0  →  beads face +Z.
const sinLat = 0;
const cosLat = 1;
const beads: Bead[] = [];
for (let i = 0; i < N_BEADS; i++) {
  const t = N_BEADS === 1 ? 0.5 : i / (N_BEADS - 1);
  const theta = -Math.PI / 2 + t * Math.PI;
  const cx3 = RX * cosLat * Math.sin(theta);
  const cy3 = RX * sinLat;
  const cz3 = RX * cosLat * Math.cos(theta);

  const { path, bbox, culling } = beadPath(cx3, cy3, cz3, theta, sinLat, cosLat);
  const centerProj = project(cx3, cy3, cz3);
  const highlightProj = project(cx3 + R * L[0], cy3 + R * L[1], cz3 + R * L[2]);

  const bbW = bbox.maxX - bbox.minX;
  const bbH = bbox.maxY - bbox.minY;
  const gradCxPct = ((highlightProj.x - bbox.minX) / bbW) * 100;
  const gradCyPct = ((highlightProj.y - bbox.minY) / bbH) * 100;

  // Lambert dot product (bead's outward normal · light direction).
  // For lat=0, normal = (cosθ·... wait, normal = (cosLat·sinθ, sinLat, cosLat·cosθ).
  // We do NOT mask the gradient yet — we want to see the raw highlight position.
  const litDot =
    cosLat * Math.sin(theta) * L[0] +
    sinLat * L[1] +
    cosLat * Math.cos(theta) * L[2];

  beads.push({
    theta,
    cx3,
    cy3,
    cz3,
    path,
    bbox,
    centerProj: { x: centerProj.x, y: centerProj.y },
    highlightProj: { x: highlightProj.x, y: highlightProj.y },
    gradCxPct,
    gradCyPct,
    litDot,
    culling,
    gradId: `b${i}`,
  });
}

// Light icon position — project L × ICON_DIST.
const iconProj = project(L[0] * ICON_DIST, L[1] * ICON_DIST, L[2] * ICON_DIST);

const gradients = beads
  .map(
    (b) =>
      `<radialGradient id="${b.gradId}" cx="${b.gradCxPct.toFixed(1)}%" cy="${b.gradCyPct.toFixed(1)}%" r="75%"><stop offset="0%" stop-color="#fff"/><stop offset="55%" stop-color="#6366f1"/><stop offset="100%" stop-color="#0f0f1f"/></radialGradient>`,
  )
  .join("\n    ");

const beadEls = beads
  .map((b) => `<path fill="url(#${b.gradId})" d="${b.path}"/>`)
  .join("\n    ");

// No debug overlay — the light icon on screen is the reference.

// Diagnostics table — printed per-bead so we can sanity check the numbers.
const rows = beads
  .map(
    (b, i) =>
      `θ=${((b.theta * 180) / Math.PI).toFixed(0)}°  ` +
      `bbox=[${b.bbox.minX.toFixed(1)},${b.bbox.minY.toFixed(1)} → ${b.bbox.maxX.toFixed(1)},${b.bbox.maxY.toFixed(1)}]  ` +
      `cx/cy=${b.gradCxPct.toFixed(1)}%/${b.gradCyPct.toFixed(1)}%  ` +
      `N·L=${b.litDot.toFixed(3)}  ` +
      `cull=${b.culling.toFixed(3)}`,
  )
  .map((s, i) => `[bead ${i}] ${s}`)
  .join("\n");
console.log(rows);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 320" width="800" height="320" role="img" aria-label="Step 1 — equator row, directional light">
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

  <text class="label" x="40" y="40">v2 · Step 1</text>
  <text class="title" x="40" y="68">Equator row · static sphere · directional light</text>
  <text class="sub"   x="40" y="92">L_world=(${L[0].toFixed(2)},${L[1].toFixed(2)},${L[2].toFixed(2)}). No Lambert mask — raw gradient cx/cy from projected highlight.</text>

  <g transform="translate(500 200)">
    <ellipse class="sphereGuide" cx="0" cy="0" rx="${RX}" ry="${(RX * Math.cos(TILT_X)).toFixed(2)}"/>
    ${beadEls}
    <circle cx="${iconProj.x.toFixed(2)}" cy="${iconProj.y.toFixed(2)}" r="${(40 * iconProj.s).toFixed(2)}" fill="url(#lightIcon)"/>
    <circle cx="${iconProj.x.toFixed(2)}" cy="${iconProj.y.toFixed(2)}" r="${(5 * iconProj.s).toFixed(2)}" fill="#fffbeb"/>
  </g>
</svg>`;

const outPath = resolve(
  projectRoot,
  "public/banner-experiments-v2/step1-equator-directional.svg",
);
writeFileSync(outPath, svg);
console.log(`Wrote ${(svg.length / 1024).toFixed(1)} KB → ${outPath}`);
