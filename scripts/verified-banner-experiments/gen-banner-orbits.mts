/**
 * Museum-header banner prototype — KNN mesh sphere on the right with
 * orbiting colored points, transparent background, project text + stats
 * on the left.
 *
 * Project data is hardcoded for js-dom-events while we iterate on the
 * visual; once it lands we'll parametrise and mount as /github-banners/[slug].
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

// ─── Canvas + sphere placement ────────────────────────────────────────────
const W = 1280;
const H = 360;
const RX = 100;
const D = 4 * RX;
const TILT_X = Math.atan(44 / 140);
const N_KF = 32; // keyframes — fewer = smaller SVG

const sphereCx = W - 200; // graphic anchored on the right
const sphereCy = H / 2;

type Vec3 = [number, number, number];

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
function unit(v: Vec3): Vec3 {
  const m = Math.hypot(...v);
  return [v[0] / m, v[1] / m, v[2] / m];
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

const keyTimes = Array.from({ length: N_KF + 1 }, (_, k) =>
  (k / N_KF).toFixed(4),
).join("; ");

// ─── Mesh (14.3 KNN, tilted-axis rotation) ────────────────────────────────
const N14 = 60;
const K14 = 5;
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
const meshDur = "22s";

// ─── Orbiting points ──────────────────────────────────────────────────────
interface Orbit {
  color: string;
  radius: number;
  axis: Vec3;
  phase: number;
  dur: string;
  size: number;
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

// ─── Sphere-side elements ─────────────────────────────────────────────────
const elems: string[] = [];

const meshFrames: Projected[][] = [];
for (let kf = 0; kf <= N_KF; kf++) {
  const t = kf / N_KF;
  meshFrames.push(
    meshPts.map((p) =>
      tiltAndProject(rotateAxis(p, meshAxis, 2 * Math.PI * t)),
    ),
  );
}

for (let i = 0; i < meshPts.length; i++) {
  const cxs = meshFrames.map((vs) => (sphereCx + vs[i]!.x).toFixed(1));
  const cys = meshFrames.map((vs) => (sphereCy + vs[i]!.y).toFixed(1));
  const ops = meshFrames.map((vs) =>
    Math.max(0, vs[i]!.z / RX + 0.3).toFixed(2),
  );
  elems.push(
    `<circle class="mesh-dot" cx="${cxs[0]}" cy="${cys[0]}" r="1.6" opacity="${ops[0]}"><animate attributeName="cx" values="${cxs.join("; ")}" keyTimes="${keyTimes}" dur="${meshDur}" repeatCount="indefinite"/><animate attributeName="cy" values="${cys.join("; ")}" keyTimes="${keyTimes}" dur="${meshDur}" repeatCount="indefinite"/><animate attributeName="opacity" values="${ops.join("; ")}" keyTimes="${keyTimes}" dur="${meshDur}" repeatCount="indefinite"/></circle>`,
  );
}

for (const [a, b] of meshEdges) {
  const pts = meshFrames.map(
    (vs) =>
      `${(sphereCx + vs[a]!.x).toFixed(1)},${(sphereCy + vs[a]!.y).toFixed(1)} ${(sphereCx + vs[b]!.x).toFixed(1)},${(sphereCy + vs[b]!.y).toFixed(1)}`,
  );
  const ops = meshFrames.map((vs) =>
    Math.max(0, Math.min(0.6, (vs[a]!.z + vs[b]!.z) / (2 * RX) + 0.2)).toFixed(
      2,
    ),
  );
  elems.push(
    `<polyline class="mesh-edge" points="${pts[0]}" opacity="${ops[0]}"><animate attributeName="points" values="${pts.join("; ")}" keyTimes="${keyTimes}" dur="${meshDur}" repeatCount="indefinite"/><animate attributeName="opacity" values="${ops.join("; ")}" keyTimes="${keyTimes}" dur="${meshDur}" repeatCount="indefinite"/></polyline>`,
  );
}

for (const orb of orbits) {
  const ref: Vec3 = Math.abs(orb.axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
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
    const t = (kf / N_KF + orb.phase) % 1;
    const proj = tiltAndProject(rotateAxis(start, orb.axis, 2 * Math.PI * t));
    cxs.push((sphereCx + proj.x).toFixed(1));
    cys.push((sphereCy + proj.y).toFixed(1));
    rs.push((orb.size * proj.s).toFixed(2));
    const op = Math.max(0, Math.min(1, (proj.z + RX) / (2 * RX)));
    ops.push((op * op).toFixed(3));
  }
  // Glow (larger, dimmer)
  elems.push(
    `<circle cx="${cxs[0]}" cy="${cys[0]}" r="${(parseFloat(rs[0]!) * 2.4).toFixed(2)}" fill="${orb.color}" opacity="${(parseFloat(ops[0]!) * 0.22).toFixed(3)}"><animate attributeName="cx" values="${cxs.join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/><animate attributeName="cy" values="${cys.join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/><animate attributeName="r" values="${rs.map((r) => (parseFloat(r) * 2.4).toFixed(2)).join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/><animate attributeName="opacity" values="${ops.map((o) => (parseFloat(o) * 0.22).toFixed(3)).join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/></circle>`,
  );
  // Main dot
  elems.push(
    `<circle cx="${cxs[0]}" cy="${cys[0]}" r="${rs[0]}" fill="${orb.color}" opacity="${ops[0]}"><animate attributeName="cx" values="${cxs.join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/><animate attributeName="cy" values="${cys.join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/><animate attributeName="r" values="${rs.join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/><animate attributeName="opacity" values="${ops.join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/></circle>`,
  );
}

// ─── Text content (hardcoded for js-dom-events while iterating) ───────────
const project = {
  title: "JavaScript & DOM",
  synopsis:
    "This project demonstrates JavaScript event handling, DOM manipulation, and OOP fundamentals through interactive web page demos.",
  stats: [
    { label: "UNLV Assignment", value: "Jan 2024" },
    { label: "Primary lang", value: "JavaScript" },
    { label: "Status", value: "Starter fork" },
  ],
};

// Word-wrap synopsis to ~52 chars per line (rough).
function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length <= maxChars) {
      line = line ? line + " " + w : w;
    } else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}
const synopsisLines = wrap(project.synopsis, 52);

const textX = 48;
const titleY = 96;
const synopsisStart = 138;
const synopsisLineHeight = 26;
const statsY = H - 56;

const titleSvg = `<text class="banner-title" x="${textX}" y="${titleY}">${project.title}</text>`;
const synopsisSvg = synopsisLines
  .map(
    (line, i) =>
      `<text class="banner-synopsis" x="${textX}" y="${synopsisStart + i * synopsisLineHeight}">${line}</text>`,
  )
  .join("\n  ");

// Stats laid out as label/value pairs, each in its own column.
const statCols = project.stats.map((s, i) => {
  const colX = textX + i * 220;
  return `<g>
    <text class="banner-stat-label" x="${colX}" y="${statsY}">${s.label}</text>
    <text class="banner-stat-value" x="${colX}" y="${statsY + 22}">${s.value}</text>
  </g>`;
});

// "Now hosted in" label at the very top
const eyebrow = `<text class="banner-eyebrow" x="${textX}" y="58">Hosted in the UNLV Museum</text>`;

// ─── Final SVG ────────────────────────────────────────────────────────────
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${project.title} — ${project.synopsis}">
  <defs>
    <style>
      .banner-eyebrow { font: 600 12px ui-monospace, "Segoe UI Mono", Menlo, monospace; letter-spacing: 0.08em; text-transform: uppercase; fill: #71717a; }
      .banner-title { font: 700 36px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #18181b; }
      .banner-synopsis { font: 400 17px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #3f3f46; }
      .banner-stat-label { font: 600 11px ui-monospace, "Segoe UI Mono", Menlo, monospace; letter-spacing: 0.06em; text-transform: uppercase; fill: #71717a; }
      .banner-stat-value { font: 500 15px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #18181b; }
      .mesh-dot  { fill: #18181b; }
      .mesh-edge { fill: none; stroke: #18181b; stroke-width: 0.5; }
      @media (prefers-color-scheme: dark) {
        .banner-title       { fill: #fafafa; }
        .banner-synopsis    { fill: #d4d4d8; }
        .banner-stat-value  { fill: #fafafa; }
        .mesh-dot           { fill: #fafafa; }
        .mesh-edge          { stroke: #fafafa; }
      }
    </style>
  </defs>
  ${eyebrow}
  ${titleSvg}
  ${synopsisSvg}
  ${statCols.join("\n  ")}
  ${elems.join("\n  ")}
</svg>`;

const id = "banner-02-orbiting-knn-with-stats";
writeFileSync(resolve(outDir, `${id}.svg`), svg);
console.log(`  ${id}.svg — ${(svg.length / 1024).toFixed(1)} KB`);
