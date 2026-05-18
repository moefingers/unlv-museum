/**
 * Prototype: 14.3 KNN mesh + a few colored points orbiting on an outer
 * radius with backface fade, so they read as travelling behind the sphere.
 *
 * Each orbiting point has its own:
 *   - orbit axis (tilt the orbit plane independently from the mesh)
 *   - orbit radius (slightly > sphere R)
 *   - period
 *   - phase offset
 *   - color
 *
 * Same projection math as gen-3d-variants — keyframed positions, perspective
 * scale, opacity from depth.
 *
 * Usage: pnpm tsx scripts/verified-banner-experiments/gen-banner-orbits.mts
 */

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(
  __dirname,
  "..",
  "..",
  "public",
  "verified-banner-experiments",
);

const W = 800;
const H = 320;
const RX = 90;
const D = 4 * RX;
const TILT_X = Math.atan(44 / 140);
const N_KF = 64;

type Vec3 = [number, number, number];

function rotateY(p: Vec3, ang: number): Vec3 {
  const c = Math.cos(ang),
    s = Math.sin(ang);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}
function rotateAxis(p: Vec3, axis: Vec3, ang: number): Vec3 {
  const c = Math.cos(ang),
    s = Math.sin(ang),
    k = 1 - c;
  const [ux, uy, uz] = axis;
  const [x, y, z] = p;
  return [
    x * (c + ux * ux * k) +
      y * (ux * uy * k - uz * s) +
      z * (ux * uz * k + uy * s),
    x * (uy * ux * k + uz * s) +
      y * (c + uy * uy * k) +
      z * (uy * uz * k - ux * s),
    x * (uz * ux * k - uy * s) +
      y * (uz * uy * k + ux * s) +
      z * (c + uz * uz * k),
  ];
}

interface Projected {
  x: number;
  y: number;
  z: number;
  s: number;
}
function tiltAndProject(p: Vec3): Projected {
  const cosX = Math.cos(TILT_X),
    sinX = Math.sin(TILT_X);
  const y1 = p[1] * cosX - p[2] * sinX;
  const z1 = p[1] * sinX + p[2] * cosX;
  const s = D / (D - z1);
  return { x: p[0] * s, y: -y1 * s, z: z1, s };
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
  return Array.from({ length: n + 1 }, (_, k) => (k / n).toFixed(5)).join("; ");
}

const keyTimes = buildKeyTimes(N_KF);
const cx0 = W / 2;
const cy0 = H / 2 + 30;

// ─── Mesh: same as 14.3 (KNN, tilted-axis rotation) ───────────────────────
const N14 = 80;
const K14 = 6;
const meshPts: Vec3[] = fibonacciSphere(N14).map(({ lat, lon }) => [
  RX * Math.cos(lat) * Math.sin(lon),
  RX * Math.sin(lat),
  RX * Math.cos(lat) * Math.cos(lon),
]);
const edgeSet = new Set<string>();
for (let i = 0; i < meshPts.length; i++) {
  const di = meshPts.map((q, j) => ({
    j,
    d: Math.hypot(
      q[0] - meshPts[i]![0],
      q[1] - meshPts[i]![1],
      q[2] - meshPts[i]![2],
    ),
  }));
  di.sort((a, b) => a.d - b.d);
  for (let k = 1; k <= K14; k++) {
    const j = di[k]!.j;
    edgeSet.add(i < j ? `${i},${j}` : `${j},${i}`);
  }
}
const meshEdges = Array.from(edgeSet).map(
  (s) => s.split(",").map(Number) as [number, number],
);

const meshAxis: Vec3 = [0, Math.SQRT1_2, Math.SQRT1_2];
const meshDur = "18s";

// ─── Orbiting points ──────────────────────────────────────────────────────
interface Orbit {
  color: string;
  radius: number;
  axis: Vec3; // orbit-plane normal (unit vector)
  phase: number; // 0..1
  dur: string;
  size: number;
}

function unit(v: Vec3): Vec3 {
  const m = Math.hypot(...v);
  return [v[0] / m, v[1] / m, v[2] / m];
}

const orbits: Orbit[] = [
  {
    color: "#22d3ee",
    radius: RX * 1.32,
    axis: unit([0.1, 0.9, 0.1]),
    phase: 0.0,
    dur: "11s",
    size: 4.5,
  },
  {
    color: "#f472b6",
    radius: RX * 1.45,
    axis: unit([0.6, 0.3, -0.7]),
    phase: 0.33,
    dur: "13s",
    size: 3.8,
  },
  {
    color: "#fbbf24",
    radius: RX * 1.25,
    axis: unit([-0.4, 0.6, 0.6]),
    phase: 0.66,
    dur: "9s",
    size: 5.0,
  },
  {
    color: "#a78bfa",
    radius: RX * 1.55,
    axis: unit([0.5, -0.4, 0.7]),
    phase: 0.18,
    dur: "16s",
    size: 4.0,
  },
];

// ─── Build SVG ────────────────────────────────────────────────────────────
const elems: string[] = [];

// Mesh frames
const meshFrames: Projected[][] = [];
for (let kf = 0; kf <= N_KF; kf++) {
  const t = kf / N_KF;
  meshFrames.push(
    meshPts.map((p) => tiltAndProject(rotateAxis(p, meshAxis, 2 * Math.PI * t))),
  );
}

// Vertex dots
for (let i = 0; i < meshPts.length; i++) {
  const cxs = meshFrames.map((vs) => (cx0 + vs[i]!.x).toFixed(1));
  const cys = meshFrames.map((vs) => (cy0 + vs[i]!.y).toFixed(1));
  const ops = meshFrames.map((vs) =>
    Math.max(0, vs[i]!.z / RX + 0.3).toFixed(2),
  );
  elems.push(
    `<circle cx="${cxs[0]}" cy="${cys[0]}" r="1.5" fill="#fafafa" opacity="${ops[0]}"><animate attributeName="cx" values="${cxs.join("; ")}" keyTimes="${keyTimes}" dur="${meshDur}" repeatCount="indefinite"/><animate attributeName="cy" values="${cys.join("; ")}" keyTimes="${keyTimes}" dur="${meshDur}" repeatCount="indefinite"/><animate attributeName="opacity" values="${ops.join("; ")}" keyTimes="${keyTimes}" dur="${meshDur}" repeatCount="indefinite"/></circle>`,
  );
}

// Edges
for (const [a, b] of meshEdges) {
  const pts = meshFrames.map(
    (vs) =>
      `${(cx0 + vs[a]!.x).toFixed(1)},${(cy0 + vs[a]!.y).toFixed(1)} ${(cx0 + vs[b]!.x).toFixed(1)},${(cy0 + vs[b]!.y).toFixed(1)}`,
  );
  const ops = meshFrames.map((vs) =>
    Math.max(0, Math.min(0.6, (vs[a]!.z + vs[b]!.z) / (2 * RX) + 0.2)).toFixed(
      2,
    ),
  );
  elems.push(
    `<polyline points="${pts[0]}" fill="none" stroke="#fafafa" stroke-width="0.5" opacity="${ops[0]}"><animate attributeName="points" values="${pts.join("; ")}" keyTimes="${keyTimes}" dur="${meshDur}" repeatCount="indefinite"/><animate attributeName="opacity" values="${ops.join("; ")}" keyTimes="${keyTimes}" dur="${meshDur}" repeatCount="indefinite"/></polyline>`,
  );
}

// Orbiting points
for (const orb of orbits) {
  // Start vector perpendicular to orbit axis: pick any non-parallel ref,
  // cross-product with axis, normalize, scale by radius.
  const ref: Vec3 =
    Math.abs(orb.axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const perp: Vec3 = [
    orb.axis[1] * ref[2] - orb.axis[2] * ref[1],
    orb.axis[2] * ref[0] - orb.axis[0] * ref[2],
    orb.axis[0] * ref[1] - orb.axis[1] * ref[0],
  ];
  const startVec = unit(perp);
  const start: Vec3 = [
    startVec[0] * orb.radius,
    startVec[1] * orb.radius,
    startVec[2] * orb.radius,
  ];

  const cxs: string[] = [];
  const cys: string[] = [];
  const rs: string[] = [];
  const ops: string[] = [];
  for (let kf = 0; kf <= N_KF; kf++) {
    const t = ((kf / N_KF) + orb.phase) % 1;
    const rotated = rotateAxis(start, orb.axis, 2 * Math.PI * t);
    const proj = tiltAndProject(rotated);
    cxs.push((cx0 + proj.x).toFixed(1));
    cys.push((cy0 + proj.y).toFixed(1));
    rs.push((orb.size * proj.s).toFixed(2));
    // Backface fade: opacity drops smoothly as z goes negative.
    // 1.0 at z >= RX (front), 0.0 at z <= -RX (back).
    const op = Math.max(0, Math.min(1, (proj.z + RX) / (2 * RX)));
    // Square the curve so the "behind the sphere" portion fades faster,
    // emphasising the occlusion illusion.
    ops.push((op * op).toFixed(3));
  }
  // Trailing glow under the main dot, larger and dimmer
  elems.push(
    `<circle cx="${cxs[0]}" cy="${cys[0]}" r="${(parseFloat(rs[0]!) * 2.4).toFixed(2)}" fill="${orb.color}" opacity="${(parseFloat(ops[0]!) * 0.25).toFixed(3)}"><animate attributeName="cx" values="${cxs.join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/><animate attributeName="cy" values="${cys.join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/><animate attributeName="r" values="${rs.map((r) => (parseFloat(r) * 2.4).toFixed(2)).join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/><animate attributeName="opacity" values="${ops.map((o) => (parseFloat(o) * 0.25).toFixed(3)).join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/></circle>`,
  );
  // Main dot
  elems.push(
    `<circle cx="${cxs[0]}" cy="${cys[0]}" r="${rs[0]}" fill="${orb.color}" opacity="${ops[0]}"><animate attributeName="cx" values="${cxs.join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/><animate attributeName="cy" values="${cys.join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/><animate attributeName="r" values="${rs.join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/><animate attributeName="opacity" values="${ops.join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/></circle>`,
  );
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Banner prototype: KNN mesh with orbiting colored points">
  <rect width="${W}" height="${H}" fill="#050505"/>
  ${elems.join("\n  ")}
</svg>`;

const id = "banner-01-orbiting-knn-yz45";
writeFileSync(resolve(outDir, `${id}.svg`), svg);
console.log(`  ${id}.svg — ${(svg.length / 1024).toFixed(1)} KB`);
