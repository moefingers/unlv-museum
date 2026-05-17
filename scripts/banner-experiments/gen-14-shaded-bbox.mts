/**
 * Generates experiment 14 — N markers with bbox-relative light-tracking
 * shading. Each marker's gradient cx/cy are animated as percentages of its
 * current bbox, computed from a 3D light direction projected through the
 * same pipeline as the marker geometry.
 *
 * Usage:
 *   pnpm tsx scripts/banner-experiments/gen-14-shaded-bbox.mts [N] [Lx] [Ly] [Lz] [dur]
 *
 * Args (all optional):
 *   N    = marker count            (default 25)
 *   Lx,Ly,Lz = light direction     (default -0.4, 1.0, 0.5; will be normalized)
 *   dur  = SMIL animation duration (default 18s)
 *
 * Examples:
 *   pnpm tsx scripts/banner-experiments/gen-14-shaded-bbox.mts
 *   pnpm tsx scripts/banner-experiments/gen-14-shaded-bbox.mts 400 -10 10 0
 *   pnpm tsx scripts/banner-experiments/gen-14-shaded-bbox.mts 100 0.4 1 0.5 12s
 *
 * Output filename embeds N and a light-direction hint when overridden.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import {
  buildKeyTimes,
  DEFAULT_ORIENTATION,
  fibonacciSphere,
  makeScene,
  normalize,
} from "./sphere-math.mts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

const N = Number(process.argv[2] ?? 25);
const Lx = Number(process.argv[3] ?? -0.4);
const Ly = Number(process.argv[4] ?? 1.0);
const Lz = Number(process.argv[5] ?? 0.5);
const DUR = process.argv[6] ?? "18s";
const N_KF = 60;

const SPHERE_RX = 140;
const BEAD_R = 9;
const scene = makeScene({ D: 4 * SPHERE_RX });
const { project, frame } = scene;
const orient = DEFAULT_ORIENTATION;
const sinB = Math.sin(orient.tiltX);
const cosB = Math.cos(orient.tiltX);
const L = normalize([Lx, Ly, Lz]);
const keyTimes = buildKeyTimes(N_KF);

interface Marker {
  paths: string[];
  ops: string[];
  cxs: string[];
  cys: string[];
  initial: string;
  initCx: string;
  initCy: string;
  gradId: string;
  cBright: string;
  cMid: string;
  cDark: string;
  initZ: number;
}

const markers: Marker[] = [];
for (const { lat, lon, idx } of fibonacciSphere(N)) {
  const sinL = Math.sin(lat);
  const cosL = Math.cos(lat);
  const paths: string[] = [];
  const ops: string[] = [];
  const cxs: string[] = [];
  const cys: string[] = [];
  for (let k = 0; k <= N_KF; k++) {
    const theta = lon + (k / N_KF) * 2 * Math.PI;
    const f = frame(theta, sinL, cosL, SPHERE_RX, BEAD_R, L, orient);
    paths.push(f.path);
    cxs.push(f.cxPct);
    cys.push(f.cyPct);
    ops.push(Math.max(0, f.culling).toFixed(3));
  }
  const hue = ((lat / Math.PI) + 0.5) * 360;
  markers.push({
    paths,
    ops,
    cxs,
    cys,
    initial: paths[0]!,
    initCx: cxs[0]!,
    initCy: cys[0]!,
    gradId: `m${idx}`,
    cBright: `hsl(${hue.toFixed(0)}, 80%, 85%)`,
    cMid: `hsl(${hue.toFixed(0)}, 80%, 45%)`,
    cDark: `hsl(${hue.toFixed(0)}, 85%, 10%)`,
    initZ: SPHERE_RX * cosL * Math.cos(lon) * cosB + SPHERE_RX * sinL * sinB,
  });
}

markers.sort((a, b) => a.initZ - b.initZ);

const gradients = markers
  .map(
    (m) =>
      `<radialGradient id="${m.gradId}" cx="${m.initCx}%" cy="${m.initCy}%" r="75%"><stop offset="0%" stop-color="${m.cBright}"/><stop offset="55%" stop-color="${m.cMid}"/><stop offset="100%" stop-color="${m.cDark}"/><animate attributeName="cx" values="${m.cxs.join("%; ")}%" keyTimes="${keyTimes}" dur="${DUR}" repeatCount="indefinite"/><animate attributeName="cy" values="${m.cys.join("%; ")}%" keyTimes="${keyTimes}" dur="${DUR}" repeatCount="indefinite"/></radialGradient>`,
  )
  .join("\n    ");

const markerEls = markers
  .map(
    (m) =>
      `<path fill="url(#${m.gradId})" d="${m.initial}"><animate attributeName="d" values="${m.paths.join("; ")}" keyTimes="${keyTimes}" dur="${DUR}" repeatCount="indefinite"/><animate attributeName="opacity" values="${m.ops.join("; ")}" keyTimes="${keyTimes}" dur="${DUR}" repeatCount="indefinite"/></path>`,
  )
  .join("\n    ");

const lightProj = project(L[0] * 300, L[1] * 300, L[2] * 300, orient);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 280" width="800" height="280" role="img" aria-label="${N} markers with bbox-relative light-tracking shading, light=(${Lx},${Ly},${Lz})">
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
      .title { font: 700 24px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #fafafa; }
      .sub { font: 500 13px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #737373; }
      .sphere { fill: none; stroke: #1a1a1a; stroke-width: 1; stroke-dasharray: 2 4; }
    </style>
  </defs>

  <rect class="bg" width="800" height="280"/>

  <text class="label" x="40" y="40">Experiment 14</text>
  <text class="title" x="40" y="72">Bbox-relative light tracking — N=${N}, L=(${Lx},${Ly},${Lz})</text>
  <text class="sub"   x="40" y="100">Keep objectBoundingBox gradient (auto-scales with marker); animate cx/cy as % of bbox.</text>
  <text class="sub"   x="40" y="120">Each keyframe: project the 3D highlight, derive its position inside the current bbox, bake.</text>

  <g transform="translate(500 180)">
    <circle class="sphere" cx="0" cy="0" r="140"/>
    <circle cx="${lightProj[0].toFixed(2)}" cy="${lightProj[1].toFixed(2)}" r="40" fill="url(#lightIcon)"/>
    <circle cx="${lightProj[0].toFixed(2)}" cy="${lightProj[1].toFixed(2)}" r="5" fill="#fffbeb"/>
    ${markerEls}
  </g>
</svg>`;

const lightTag =
  Lx === -0.4 && Ly === 1.0 && Lz === 0.5
    ? ""
    : `-L${Lx}_${Ly}_${Lz}`.replace(/\./g, "p");
const countTag = N === 25 ? "" : `-${N}`;
const outPath = resolve(
  projectRoot,
  `public/banner-experiments/14-bbox-light-shading${countTag}${lightTag}.svg`,
);
writeFileSync(outPath, svg);
console.log(`Wrote ${(svg.length / 1024).toFixed(1)} KB → ${outPath}`);
