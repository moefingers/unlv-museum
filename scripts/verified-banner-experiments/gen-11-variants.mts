/**
 * 11.x — globe lat/lon wireframe rotating around true 3D axes.
 *
 * #12 in the base set rotates the 2D-rendered group around the screen-Z
 * axis (record spin). These variants do GENUINE 3D rotation around body
 * axes, baked per keyframe, then projected. The result is a wireframe globe
 * actually rotating in 3D.
 *
 *   11.1 — body-Y (the sphere's polar axis): classic globe spinning, like
 *          turning a globe on its stand. Parallels stay still; meridians
 *          sweep past.
 *   11.2 — body-X (horizontal axis through equator): tumble forward/back,
 *          like a roll. Both parallels and meridians move.
 *   11.3 — tilted axis (45° between body-Y and body-Z): off-axis rotation,
 *          to verify arbitrary axes work too.
 *
 * Each variant uses ~48 keyframes for a smooth bezier-ish loop.
 *
 * Wireframe lines stay full (no per-segment culling) — back-of-globe lines
 * are visible as faint strokes. That's the "transparent wireframe globe"
 * look. Per-segment culling could be added later if desired.
 *
 * Usage: pnpm tsx scripts/verified-banner-experiments/gen-11-variants.mts
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "..", "..", "public", "verified-banner-experiments");

const W = 800;
const H = 320;
const RX = 90;
const D = 4 * RX;
const TILT_X = Math.atan(44 / 140); // ~17.6°
const N_KF = 48;
const SAMPLES_PER_CURVE = 48;

type Vec3 = [number, number, number];

function rotateY(p: Vec3, ang: number): Vec3 {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}

function rotateX(p: Vec3, ang: number): Vec3 {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
}

/** Rodrigues rotation around an arbitrary unit-vector axis. */
function rotateAxis(p: Vec3, axis: Vec3, ang: number): Vec3 {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const k = 1 - c;
  const [ux, uy, uz] = axis;
  const [x, y, z] = p;
  return [
    p[0] * (c + ux * ux * k) + y * (ux * uy * k - uz * s) + z * (ux * uz * k + uy * s),
    x * (uy * ux * k + uz * s) + y * (c + uy * uy * k) + z * (uy * uz * k - ux * s),
    x * (uz * ux * k - uy * s) + y * (uz * uy * k + ux * s) + z * (c + uz * uz * k),
  ];
}

function tiltAndProject(p: Vec3): { x: number; y: number } {
  const cosX = Math.cos(TILT_X);
  const sinX = Math.sin(TILT_X);
  const y1 = p[1] * cosX - p[2] * sinX;
  const z1 = p[1] * sinX + p[2] * cosX;
  const s = D / (D - z1);
  return { x: p[0] * s, y: -y1 * s };
}

function buildKeyTimes(n: number): string {
  const kt: string[] = [];
  for (let k = 0; k <= n; k++) kt.push((k / n).toFixed(5));
  return kt.join("; ");
}

interface Variant {
  id: string;
  title: string;
  expected: string;
  failure: string;
  rotate: (p: Vec3, t: number) => Vec3;
  dur: string;
}

const variants: Variant[] = [
  {
    id: "11.1-globe-spin-y-axis",
    title: "Globe wireframe — true 3D spin around body Y",
    expected:
      "Wireframe globe rotates around its (tilted) polar axis. Meridians sweep past; the polar regions stay fixed. Real 3D motion, not a 2D group rotation.",
    failure:
      "Parallels visibly move with the rotation (= it's actually a Z-axis spin, not Y).",
    rotate: (p, t) => rotateY(p, 2 * Math.PI * t),
    dur: "12s",
  },
  {
    id: "11.2-tumble-x-axis",
    title: "Globe wireframe — true 3D rotation around body X",
    expected:
      "Wireframe globe tumbles forward/back around the horizontal X axis. Poles swing through the front face.",
    failure: "Sphere just spins flat in the screen plane (= Z rotation again).",
    rotate: (p, t) => rotateX(p, 2 * Math.PI * t),
    dur: "16s",
  },
  {
    id: "11.3-tilted-axis-yz45",
    title: "Globe wireframe — rotation around tilted (Y+Z) axis",
    expected:
      "Wireframe globe rotates around an axis 45° between body Y and body Z. Off-axis spin, more chaotic than pure-Y.",
    failure: "Same look as 11.1 — means the axis isn't actually tilted.",
    rotate: (p, t) =>
      rotateAxis(
        p,
        [0, Math.SQRT1_2, Math.SQRT1_2],
        2 * Math.PI * t,
      ),
    dur: "14s",
  },
];

const keyTimes = buildKeyTimes(N_KF);
const N_LAT = 7;
const N_LON = 12;
const lats: number[] = [];
for (let i = 1; i < N_LAT; i++) lats.push(-Math.PI / 2 + (i / N_LAT) * Math.PI);
const lons: number[] = [];
for (let i = 0; i < N_LON; i++) lons.push((i / N_LON) * 2 * Math.PI);

function card(opts: {
  id: string;
  title: string;
  expected: string;
  failure: string;
  body: string;
}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${opts.title}">
  <defs>
    <style>
      .bg { fill: #050505; }
      .label { font: 600 12px ui-monospace, "Segoe UI Mono", Menlo, monospace; fill: #6b7280; letter-spacing: 0.04em; text-transform: uppercase; }
      .title { font: 700 19px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #fafafa; }
      .ok { font: 500 13px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #86efac; }
      .fail { font: 500 13px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #fca5a5; }
    </style>
  </defs>
  <rect class="bg" width="${W}" height="${H}"/>
  <text class="label" x="24" y="32">${opts.id}</text>
  <text class="title" x="24" y="58">${opts.title}</text>
  <text class="ok"    x="24" y="84">✓ Expected: ${opts.expected}</text>
  <text class="fail"  x="24" y="104">✗ If broken: ${opts.failure}</text>
  ${opts.body}
</svg>`;
}

for (const v of variants) {
  const cx0 = W / 2;
  const cy0 = 220;
  const polylines: string[] = [];

  // Parallels (constant latitude curves)
  for (const lat of lats) {
    const baseSamples: Vec3[] = [];
    for (let k = 0; k <= SAMPLES_PER_CURVE; k++) {
      const lon = (k / SAMPLES_PER_CURVE) * 2 * Math.PI;
      baseSamples.push([
        RX * Math.cos(lat) * Math.sin(lon),
        RX * Math.sin(lat),
        RX * Math.cos(lat) * Math.cos(lon),
      ]);
    }
    const frames: string[] = [];
    for (let kf = 0; kf <= N_KF; kf++) {
      const t = kf / N_KF;
      const pts = baseSamples
        .map((p) => v.rotate(p, t))
        .map((p) => tiltAndProject(p))
        .map((q) => `${(cx0 + q.x).toFixed(1)},${(cy0 + q.y).toFixed(1)}`)
        .join(" ");
      frames.push(pts);
    }
    polylines.push(
      `<polyline points="${frames[0]}" fill="none" stroke="#fafafa" stroke-width="0.6" opacity="0.35"><animate attributeName="points" values="${frames.join("; ")}" keyTimes="${keyTimes}" dur="${v.dur}" repeatCount="indefinite"/></polyline>`,
    );
  }

  // Meridians (constant longitude curves)
  for (const lon of lons) {
    const baseSamples: Vec3[] = [];
    for (let k = 0; k <= SAMPLES_PER_CURVE; k++) {
      const lat = -Math.PI / 2 + (k / SAMPLES_PER_CURVE) * Math.PI;
      baseSamples.push([
        RX * Math.cos(lat) * Math.sin(lon),
        RX * Math.sin(lat),
        RX * Math.cos(lat) * Math.cos(lon),
      ]);
    }
    const frames: string[] = [];
    for (let kf = 0; kf <= N_KF; kf++) {
      const t = kf / N_KF;
      const pts = baseSamples
        .map((p) => v.rotate(p, t))
        .map((p) => tiltAndProject(p))
        .map((q) => `${(cx0 + q.x).toFixed(1)},${(cy0 + q.y).toFixed(1)}`)
        .join(" ");
      frames.push(pts);
    }
    polylines.push(
      `<polyline points="${frames[0]}" fill="none" stroke="#fafafa" stroke-width="0.6" opacity="0.35"><animate attributeName="points" values="${frames.join("; ")}" keyTimes="${keyTimes}" dur="${v.dur}" repeatCount="indefinite"/></polyline>`,
    );
  }

  const svg = card({
    id: v.id,
    title: v.title,
    expected: v.expected,
    failure: v.failure,
    body: polylines.join("\n  "),
  });
  writeFileSync(resolve(outDir, `${v.id}.svg`), svg);
  console.log(`  ${v.id}.svg — ${(svg.length / 1024).toFixed(1)} KB`);
}

console.log(`Wrote ${variants.length} variant SVGs to ${outDir}`);
