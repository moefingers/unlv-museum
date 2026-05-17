/**
 * 3D-rotation variants for atoms 06, 13, 14.
 *
 * Same pattern as 11.x: bake per-keyframe positions under true 3D rotation
 * around body axes (Y, X, tilted), then tiltX + perspective project, then
 * animate via SMIL.
 *
 * Variants generated:
 *   06.1 06.2 06.3 — Fibonacci dot cloud spinning
 *   13.1 13.2 13.3 — Icosahedron wireframe spinning
 *   14.1 14.2 14.3 — Fibonacci k-NN organic mesh spinning
 *
 * Usage: pnpm tsx scripts/verified-banner-experiments/gen-3d-variants.mts
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
const TILT_X = Math.atan(44 / 140);
const N_KF = 48;

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
function rotateAxis(p: Vec3, axis: Vec3, ang: number): Vec3 {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const k = 1 - c;
  const [ux, uy, uz] = axis;
  const [x, y, z] = p;
  return [
    x * (c + ux * ux * k) + y * (ux * uy * k - uz * s) + z * (ux * uz * k + uy * s),
    x * (uy * ux * k + uz * s) + y * (c + uy * uy * k) + z * (uy * uz * k - ux * s),
    x * (uz * ux * k - uy * s) + y * (uz * uy * k + ux * s) + z * (c + uz * uz * k),
  ];
}

interface Projected {
  x: number; // screen x relative to scene origin
  y: number; // screen y relative to scene origin
  z: number; // post-tiltX depth (used for culling/scale)
  s: number; // perspective scale
}
function tiltAndProject(p: Vec3): Projected {
  const cosX = Math.cos(TILT_X);
  const sinX = Math.sin(TILT_X);
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
  const kt: string[] = [];
  for (let k = 0; k <= n; k++) kt.push((k / n).toFixed(5));
  return kt.join("; ");
}

const keyTimes = buildKeyTimes(N_KF);

interface Axis {
  suffix: string;
  label: string;
  rotate: (p: Vec3, t: number) => Vec3;
  dur: string;
}
const AXES: Axis[] = [
  { suffix: "y-axis", label: "body Y", rotate: (p, t) => rotateY(p, 2 * Math.PI * t), dur: "12s" },
  { suffix: "x-axis", label: "body X", rotate: (p, t) => rotateX(p, 2 * Math.PI * t), dur: "16s" },
  {
    suffix: "yz45",
    label: "tilted (Y+Z)/√2",
    rotate: (p, t) => rotateAxis(p, [0, Math.SQRT1_2, Math.SQRT1_2], 2 * Math.PI * t),
    dur: "14s",
  },
];

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

const cx0 = W / 2;
const cy0 = 220;

// ─── 06.x — Fibonacci dot cloud, 3D-rotating ────────────────────────────────
const N06 = 100;
const basePts06: Vec3[] = fibonacciSphere(N06).map(({ lat, lon }) => [
  RX * Math.cos(lat) * Math.sin(lon),
  RX * Math.sin(lat),
  RX * Math.cos(lat) * Math.cos(lon),
]);
for (const ax of AXES) {
  const elems: string[] = [];
  for (let i = 0; i < basePts06.length; i++) {
    const cxs: string[] = [];
    const cys: string[] = [];
    const rs: string[] = [];
    const ops: string[] = [];
    for (let kf = 0; kf <= N_KF; kf++) {
      const t = kf / N_KF;
      const rotated = ax.rotate(basePts06[i]!, t);
      const proj = tiltAndProject(rotated);
      // Opacity = z-based face culling: visible side has z > 0 (toward camera).
      const opacity = Math.max(0, proj.z / RX);
      cxs.push((cx0 + proj.x).toFixed(1));
      cys.push((cy0 + proj.y).toFixed(1));
      rs.push((2 * proj.s).toFixed(2));
      ops.push(opacity.toFixed(2));
    }
    elems.push(
      `<circle cx="${cxs[0]}" cy="${cys[0]}" r="${rs[0]}" fill="#fafafa" opacity="${ops[0]}"><animate attributeName="cx" values="${cxs.join("; ")}" keyTimes="${keyTimes}" dur="${ax.dur}" repeatCount="indefinite"/><animate attributeName="cy" values="${cys.join("; ")}" keyTimes="${keyTimes}" dur="${ax.dur}" repeatCount="indefinite"/><animate attributeName="r" values="${rs.join("; ")}" keyTimes="${keyTimes}" dur="${ax.dur}" repeatCount="indefinite"/><animate attributeName="opacity" values="${ops.join("; ")}" keyTimes="${keyTimes}" dur="${ax.dur}" repeatCount="indefinite"/></circle>`,
    );
  }
  const id = `06.${AXES.indexOf(ax) + 1}-fibonacci-dots-${ax.suffix}`;
  const titleAxis = ax.label;
  const svg = card({
    id,
    title: `Fibonacci dot cloud — true 3D rotation around ${titleAxis}`,
    expected: `${N06} dots orbit smoothly along elliptical 2D paths. Back beads fade (opacity → 0); front beads grow slightly (perspective).`,
    failure: "Dots stay in a single screen-plane rotation, or sizes don't vary with depth.",
    body: elems.join("\n  "),
  });
  writeFileSync(resolve(outDir, `${id}.svg`), svg);
  console.log(`  ${id}.svg — ${(svg.length / 1024).toFixed(1)} KB`);
}

// ─── 13.x — Icosahedron wireframe, 3D-rotating ──────────────────────────────
const phi = (1 + Math.sqrt(5)) / 2;
const norm = Math.hypot(1, phi);
const k = RX / norm;
const v13: Vec3[] = (
  [
    [0, +1, +phi], [0, +1, -phi], [0, -1, +phi], [0, -1, -phi],
    [+1, +phi, 0], [+1, -phi, 0], [-1, +phi, 0], [-1, -phi, 0],
    [+phi, 0, +1], [+phi, 0, -1], [-phi, 0, +1], [-phi, 0, -1],
  ] as [number, number, number][]
).map(([x, y, z]) => [x * k, y * k, z * k] as Vec3);
const edges13: [number, number][] = [
  [0, 2], [0, 4], [0, 6], [0, 8], [0, 10],
  [1, 3], [1, 4], [1, 6], [1, 9], [1, 11],
  [2, 5], [2, 7], [2, 8], [2, 10],
  [3, 5], [3, 7], [3, 9], [3, 11],
  [4, 6], [4, 8], [4, 9],
  [5, 7], [5, 8], [5, 9],
  [6, 10], [6, 11],
  [7, 10], [7, 11],
  [8, 9],
  [10, 11],
];
for (const ax of AXES) {
  const elems: string[] = [];
  // Per-keyframe projected vertex positions
  const framesVerts: Projected[][] = [];
  for (let kf = 0; kf <= N_KF; kf++) {
    const t = kf / N_KF;
    framesVerts.push(v13.map((p) => tiltAndProject(ax.rotate(p, t))));
  }
  // Vertex dots
  for (let i = 0; i < v13.length; i++) {
    const cxs = framesVerts.map((vs) => (cx0 + vs[i]!.x).toFixed(1));
    const cys = framesVerts.map((vs) => (cy0 + vs[i]!.y).toFixed(1));
    const ops = framesVerts.map((vs) => Math.max(0, vs[i]!.z / RX + 0.5).toFixed(2));
    elems.push(
      `<circle cx="${cxs[0]}" cy="${cys[0]}" r="2" fill="#fafafa" opacity="${ops[0]}"><animate attributeName="cx" values="${cxs.join("; ")}" keyTimes="${keyTimes}" dur="${ax.dur}" repeatCount="indefinite"/><animate attributeName="cy" values="${cys.join("; ")}" keyTimes="${keyTimes}" dur="${ax.dur}" repeatCount="indefinite"/><animate attributeName="opacity" values="${ops.join("; ")}" keyTimes="${keyTimes}" dur="${ax.dur}" repeatCount="indefinite"/></circle>`,
    );
  }
  // Edges as polylines
  for (const [a, b] of edges13) {
    const pts = framesVerts.map(
      (vs) =>
        `${(cx0 + vs[a]!.x).toFixed(1)},${(cy0 + vs[a]!.y).toFixed(1)} ${(cx0 + vs[b]!.x).toFixed(1)},${(cy0 + vs[b]!.y).toFixed(1)}`,
    );
    const ops = framesVerts.map((vs) => Math.max(0, Math.min(1, (vs[a]!.z + vs[b]!.z) / (2 * RX) + 0.5)).toFixed(2));
    elems.push(
      `<polyline points="${pts[0]}" fill="none" stroke="#fafafa" stroke-width="0.8" opacity="${ops[0]}"><animate attributeName="points" values="${pts.join("; ")}" keyTimes="${keyTimes}" dur="${ax.dur}" repeatCount="indefinite"/><animate attributeName="opacity" values="${ops.join("; ")}" keyTimes="${keyTimes}" dur="${ax.dur}" repeatCount="indefinite"/></polyline>`,
    );
  }
  const id = `13.${AXES.indexOf(ax) + 1}-icosahedron-${ax.suffix}`;
  const svg = card({
    id,
    title: `Icosahedron — true 3D rotation around ${ax.label}`,
    expected:
      "12 vertices and 30 edges of a regular icosahedron rotating in 3D. Edges/vertices on the far side fade.",
    failure: "Polyhedron stays static or rotates as a flat 2D shape.",
    body: elems.join("\n  "),
  });
  writeFileSync(resolve(outDir, `${id}.svg`), svg);
  console.log(`  ${id}.svg — ${(svg.length / 1024).toFixed(1)} KB`);
}

// ─── 14.x — Fibonacci k-NN organic mesh, 3D-rotating ────────────────────────
const N14 = 80;
const K14 = 6;
const basePts14: Vec3[] = fibonacciSphere(N14).map(({ lat, lon }) => [
  RX * Math.cos(lat) * Math.sin(lon),
  RX * Math.sin(lat),
  RX * Math.cos(lat) * Math.cos(lon),
]);
const edgeSet14 = new Set<string>();
for (let i = 0; i < basePts14.length; i++) {
  const di = basePts14.map((q, j) => ({
    j,
    d: Math.hypot(q[0] - basePts14[i]![0], q[1] - basePts14[i]![1], q[2] - basePts14[i]![2]),
  }));
  di.sort((a, b) => a.d - b.d);
  for (let kk = 1; kk <= K14; kk++) {
    const j = di[kk]!.j;
    edgeSet14.add(i < j ? `${i},${j}` : `${j},${i}`);
  }
}
const edges14 = Array.from(edgeSet14).map((s) => s.split(",").map(Number) as [number, number]);
for (const ax of AXES) {
  const elems: string[] = [];
  const framesVerts: Projected[][] = [];
  for (let kf = 0; kf <= N_KF; kf++) {
    const t = kf / N_KF;
    framesVerts.push(basePts14.map((p) => tiltAndProject(ax.rotate(p, t))));
  }
  // Vertex dots
  for (let i = 0; i < basePts14.length; i++) {
    const cxs = framesVerts.map((vs) => (cx0 + vs[i]!.x).toFixed(1));
    const cys = framesVerts.map((vs) => (cy0 + vs[i]!.y).toFixed(1));
    const ops = framesVerts.map((vs) => Math.max(0, vs[i]!.z / RX + 0.3).toFixed(2));
    elems.push(
      `<circle cx="${cxs[0]}" cy="${cys[0]}" r="1.5" fill="#fafafa" opacity="${ops[0]}"><animate attributeName="cx" values="${cxs.join("; ")}" keyTimes="${keyTimes}" dur="${ax.dur}" repeatCount="indefinite"/><animate attributeName="cy" values="${cys.join("; ")}" keyTimes="${keyTimes}" dur="${ax.dur}" repeatCount="indefinite"/><animate attributeName="opacity" values="${ops.join("; ")}" keyTimes="${keyTimes}" dur="${ax.dur}" repeatCount="indefinite"/></circle>`,
    );
  }
  // Edges
  for (const [a, b] of edges14) {
    const pts = framesVerts.map(
      (vs) =>
        `${(cx0 + vs[a]!.x).toFixed(1)},${(cy0 + vs[a]!.y).toFixed(1)} ${(cx0 + vs[b]!.x).toFixed(1)},${(cy0 + vs[b]!.y).toFixed(1)}`,
    );
    const ops = framesVerts.map((vs) =>
      Math.max(0, Math.min(0.6, (vs[a]!.z + vs[b]!.z) / (2 * RX) + 0.2)).toFixed(2),
    );
    elems.push(
      `<polyline points="${pts[0]}" fill="none" stroke="#fafafa" stroke-width="0.5" opacity="${ops[0]}"><animate attributeName="points" values="${pts.join("; ")}" keyTimes="${keyTimes}" dur="${ax.dur}" repeatCount="indefinite"/><animate attributeName="opacity" values="${ops.join("; ")}" keyTimes="${keyTimes}" dur="${ax.dur}" repeatCount="indefinite"/></polyline>`,
    );
  }
  const id = `14.${AXES.indexOf(ax) + 1}-fibonacci-knn-${ax.suffix}`;
  const svg = card({
    id,
    title: `Fibonacci k-NN organic mesh — 3D rotation around ${ax.label}`,
    expected:
      `${N14} vertices + ~${edges14.length} edges, organic spherical mesh, rotating in 3D. Back-facing edges fade.`,
    failure: "Mesh rotates flat or edges tear/reorder.",
    body: elems.join("\n  "),
  });
  writeFileSync(resolve(outDir, `${id}.svg`), svg);
  console.log(`  ${id}.svg — ${(svg.length / 1024).toFixed(1)} KB`);
}

console.log("Done.");
