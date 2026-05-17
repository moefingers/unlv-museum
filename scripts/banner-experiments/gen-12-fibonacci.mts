/**
 * Generates experiment 12 — N markers Fibonacci-distributed on a rotating
 * sphere. Each marker has its own latitude-based color and a static radial
 * gradient (objectBoundingBox cx="35%" cy="30%") so they look shaded for free
 * by the bbox-follows-marker trick (see explanation in BANNER-EXPERIMENTS.md).
 *
 * Usage:
 *   pnpm tsx scripts/banner-experiments/gen-12-fibonacci.mts [N] [dur]
 *
 * Examples:
 *   pnpm tsx scripts/banner-experiments/gen-12-fibonacci.mts            # 25 markers, 18s
 *   pnpm tsx scripts/banner-experiments/gen-12-fibonacci.mts 300        # 300 markers
 *   pnpm tsx scripts/banner-experiments/gen-12-fibonacci.mts 400 24s    # 400 markers, 24s rotation
 *
 * Output filename includes N when overridden from default, e.g.
 *   public/banner-experiments/12-fibonacci-circles.svg          (N=25)
 *   public/banner-experiments/12-fibonacci-circles-300.svg      (N=300)
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
} from "./sphere-math.mts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

const N = Number(process.argv[2] ?? 25);
const DUR = process.argv[3] ?? "18s";
const N_KF = 60;

const SPHERE_RX = 140;
const BEAD_R = 8;
const scene = makeScene({ D: 4 * SPHERE_RX });
const { frame } = scene;
const orient = DEFAULT_ORIENTATION;
const sinB = Math.sin(orient.tiltX);
const cosB = Math.cos(orient.tiltX);
const keyTimes = buildKeyTimes(N_KF);

interface Marker {
  paths: string[];
  ops: string[];
  initial: string;
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
  for (let k = 0; k <= N_KF; k++) {
    const theta = lon + (k / N_KF) * 2 * Math.PI;
    const f = frame(theta, sinL, cosL, SPHERE_RX, BEAD_R, [0, 0, 0], orient);
    paths.push(f.path);
    ops.push(Math.max(0, f.culling).toFixed(3));
  }
  const hue = ((lat / Math.PI) + 0.5) * 360;
  markers.push({
    paths,
    ops,
    initial: paths[0]!,
    gradId: `m${idx}`,
    cBright: `hsl(${hue.toFixed(0)}, 75%, 70%)`,
    cMid: `hsl(${hue.toFixed(0)}, 80%, 50%)`,
    cDark: `hsl(${hue.toFixed(0)}, 80%, 20%)`,
    initZ: SPHERE_RX * cosL * Math.cos(lon) * cosB + SPHERE_RX * sinL * sinB,
  });
}

// Z-sort: deeper first, so closer markers paint on top.
markers.sort((a, b) => a.initZ - b.initZ);

const gradients = markers
  .map(
    (m) =>
      `<radialGradient id="${m.gradId}" cx="35%" cy="30%" r="65%"><stop offset="0%" stop-color="${m.cBright}"/><stop offset="60%" stop-color="${m.cMid}"/><stop offset="100%" stop-color="${m.cDark}"/></radialGradient>`,
  )
  .join("\n    ");

const markerEls = markers
  .map(
    (m) =>
      `<path fill="url(#${m.gradId})" d="${m.initial}"><animate attributeName="d" values="${m.paths.join("; ")}" keyTimes="${keyTimes}" dur="${DUR}" repeatCount="indefinite"/><animate attributeName="opacity" values="${m.ops.join("; ")}" keyTimes="${keyTimes}" dur="${DUR}" repeatCount="indefinite"/></path>`,
  )
  .join("\n    ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 280" width="800" height="280" role="img" aria-label="${N} circles Fibonacci-distributed on a tilted rotating sphere">
  <defs>
    ${gradients}
    <style>
      .bg     { fill: #0a0a0a; }
      .label  { font: 600 13px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #a3a3a3; letter-spacing: 0.05em; text-transform: uppercase; }
      .title  { font: 700 24px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #fafafa; }
      .sub    { font: 500 13px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #737373; }
      .sphere { fill: none; stroke: #1a1a1a; stroke-width: 1; stroke-dasharray: 2 4; }
    </style>
  </defs>

  <rect class="bg" width="800" height="280"/>

  <text class="label" x="40" y="40">Experiment 12</text>
  <text class="title" x="40" y="72">${N} markers — Fibonacci-distributed on a rotating sphere</text>
  <text class="sub"   x="40" y="100">Each marker has fixed (latitude, longitude). Sphere rotates around Y; every marker traces its own parallel.</text>
  <text class="sub"   x="40" y="120">Golden-angle longitudes + linear y-spacing → optimal spherical coverage. Hue varies by latitude.</text>

  <g transform="translate(500 180)">
    <circle class="sphere" cx="0" cy="0" r="140"/>
    ${markerEls}
  </g>
</svg>`;

const suffix = N === 25 ? "" : `-${N}`;
const outPath = resolve(
  projectRoot,
  `public/banner-experiments/12-fibonacci-circles${suffix}.svg`,
);
writeFileSync(outPath, svg);
console.log(`Wrote ${(svg.length / 1024).toFixed(1)} KB → ${outPath}`);
