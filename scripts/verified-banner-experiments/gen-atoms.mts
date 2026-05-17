/**
 * Generates every atomic test in public/verified-banner-experiments/.
 *
 * Each atom proves ONE technique in isolation, with the success criterion
 * embedded in the SVG itself. If the visual doesn't match the "Expected"
 * line, that primitive doesn't work in this environment.
 *
 * Atoms grouped:
 *   01–05: SVG SMIL animation primitives
 *   06–08: 3D → 2D projection of points
 *   09–14: Triangulation / wireframe
 *   15–16: Breathing animations
 *   17–18: 2D rim density (no 3D)
 *
 * Usage: pnpm tsx scripts/verified-banner-experiments/gen-atoms.mts
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "..", "..", "public", "verified-banner-experiments");

const W = 800;
const H = 320;

/**
 * Wrap content in a labeled SVG card. `expected` is the success criterion
 * shown to the human inspector. `body` is the SVG payload (no <svg> wrapper).
 */
function card(opts: {
  id: string;
  title: string;
  expected: string;
  failure?: string;
  body: string;
}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${opts.title}">
  <defs>
    <style>
      .bg { fill: #050505; }
      .label { font: 600 12px ui-monospace, "Segoe UI Mono", Menlo, monospace; fill: #6b7280; letter-spacing: 0.04em; text-transform: uppercase; }
      .title { font: 700 20px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #fafafa; }
      .ok { font: 500 13px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #86efac; }
      .fail { font: 500 13px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #fca5a5; }
      .frame-edge { fill: none; stroke: #1f1f23; stroke-width: 1; }
    </style>
  </defs>
  <rect class="bg" width="${W}" height="${H}"/>
  <text class="label" x="24" y="32">${opts.id}</text>
  <text class="title" x="24" y="60">${opts.title}</text>
  <text class="ok"    x="24" y="86">✓ Expected: ${opts.expected}</text>
  ${opts.failure ? `<text class="fail"  x="24" y="106">✗ If broken: ${opts.failure}</text>` : ""}
  ${opts.body}
</svg>`;
}

function write(id: string, svg: string): void {
  const path = resolve(outDir, `${id}.svg`);
  writeFileSync(path, svg);
}

// ─── Reusable math ──────────────────────────────────────────────────────────

const RX = 90; // sphere radius for atom panels (smaller than v3 to fit panel)
const D = 4 * RX;
const TILT_X = Math.atan(44 / 140);

function fibonacciSphere(n: number): { lat: number; lon: number }[] {
  const ga = Math.PI * (3 - Math.sqrt(5));
  const out: { lat: number; lon: number }[] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * i + 1) / n;
    out.push({ lat: Math.asin(y), lon: ga * i });
  }
  return out;
}

function project(x: number, y: number, z: number, tiltX = TILT_X): {
  x: number;
  y: number;
  s: number;
} {
  const cosX = Math.cos(tiltX);
  const sinX = Math.sin(tiltX);
  const y1 = y * cosX - z * sinX;
  const z1 = y * sinX + z * cosX;
  const s = D / (D - z1);
  return { x: x * s, y: -y1 * s, s };
}

// ─── 01: dot translates left → right via <animate cx> ──────────────────────
write(
  "01-dot-translates-lr",
  card({
    id: "01 · animate cx",
    title: "Dot translates left → right",
    expected: "A single white dot slides left → right and snaps back, repeating.",
    failure: "Dot is missing, static, or jumping erratically.",
    body: `
  <line x1="100" y1="220" x2="700" y2="220" class="frame-edge"/>
  <circle cx="100" cy="220" r="10" fill="#fafafa">
    <animate attributeName="cx" from="100" to="700" dur="3s" repeatCount="indefinite"/>
  </circle>`,
  }),
);

// ─── 02: dot orbits via <animateMotion> ─────────────────────────────────────
{
  const cx0 = W / 2;
  const cy0 = 220;
  const r = 60;
  // 4-cubic-bezier circle path centered at (cx0, cy0).
  const BC = 0.5522847498;
  const p = (x: number, y: number) => `${(cx0 + x).toFixed(1)},${(cy0 + y).toFixed(1)}`;
  const orbitPath =
    `M${p(r, 0)} C${p(r, BC * r)} ${p(BC * r, r)} ${p(0, r)}` +
    ` C${p(-BC * r, r)} ${p(-r, BC * r)} ${p(-r, 0)}` +
    ` C${p(-r, -BC * r)} ${p(-BC * r, -r)} ${p(0, -r)}` +
    ` C${p(BC * r, -r)} ${p(r, -BC * r)} ${p(r, 0)} Z`;
  write(
    "02-dot-orbits-motion-path",
    card({
      id: "02 · animateMotion",
      title: "Dot follows a bezier circular path",
      expected: "A white dot smoothly orbits a clockwise circle.",
      failure: "Dot moves in a square, jumps, or stays put.",
      body: `
  <path d="${orbitPath}" fill="none" stroke="#222" stroke-dasharray="2 4"/>
  <circle r="8" fill="#fafafa">
    <animateMotion dur="4s" repeatCount="indefinite" path="${orbitPath}" rotate="0"/>
  </circle>`,
    }),
  );
}

// ─── 03: dot pulses radius via <animate r> ─────────────────────────────────
write(
  "03-dot-pulses-r",
  card({
    id: "03 · animate r",
    title: "Dot pulses its radius",
    expected: "A single dot smoothly grows and shrinks (r=6 → 18 → 6).",
    failure: "Dot doesn't change size, or sizes are wrong.",
    body: `
  <circle cx="${W / 2}" cy="220" r="6" fill="#fafafa">
    <animate attributeName="r" values="6; 18; 6" keyTimes="0; 0.5; 1" dur="2.5s" repeatCount="indefinite"/>
  </circle>`,
  }),
);

// ─── 04: group of dots rotates via animateTransform ─────────────────────────
write(
  "04-group-rotates",
  card({
    id: "04 · animateTransform rotate",
    title: "Group of 4 dots rotates around the center",
    expected: "Four colored dots in a cross pattern rotate together around the center.",
    failure: "Dots stay still or rotate around the wrong pivot.",
    body: `
  <g transform="translate(${W / 2} 220)">
    <g>
      <circle cx="60" cy="0" r="8" fill="#ef4444"/>
      <circle cx="0" cy="60" r="8" fill="#22c55e"/>
      <circle cx="-60" cy="0" r="8" fill="#3b82f6"/>
      <circle cx="0" cy="-60" r="8" fill="#eab308"/>
      <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="4s" repeatCount="indefinite"/>
    </g>
  </g>`,
  }),
);

// ─── 05: phase-offset siblings ──────────────────────────────────────────────
write(
  "05-phase-offset-dots",
  card({
    id: "05 · begin offset",
    title: "Five dots pulse with phase-offset timing",
    expected: "Five dots pulse in sequence (left → right wave), then loop.",
    failure: "All dots pulse in unison or stay still.",
    body: (() => {
      const n = 5;
      const baseY = 220;
      const xs = Array.from({ length: n }, (_, i) => 200 + i * 100);
      return xs
        .map(
          (x, i) =>
            `<circle cx="${x}" cy="${baseY}" r="6" fill="#fafafa"><animate attributeName="r" values="6; 16; 6" keyTimes="0; 0.5; 1" dur="2.5s" begin="${(i * 0.2).toFixed(1)}s" repeatCount="indefinite"/></circle>`,
        )
        .join("\n  ");
    })(),
  }),
);

// ─── 06: static Fibonacci sphere dots ───────────────────────────────────────
{
  const N = 120;
  const cx0 = W / 2;
  const cy0 = 220;
  const dots = fibonacciSphere(N)
    .map(({ lat, lon }) => {
      const p = project(
        RX * Math.cos(lat) * Math.sin(lon),
        RX * Math.sin(lat),
        RX * Math.cos(lat) * Math.cos(lon),
      );
      const culling =
        Math.sin(lat) * Math.sin(TILT_X) +
        Math.cos(lat) * Math.cos(lon) * Math.cos(TILT_X);
      const op = Math.max(0, culling).toFixed(2);
      return `<circle cx="${(cx0 + p.x).toFixed(1)}" cy="${(cy0 + p.y).toFixed(1)}" r="${(2 * p.s).toFixed(1)}" fill="#fafafa" opacity="${op}"/>`;
    })
    .join("");
  write(
    "06-fibonacci-static-dots",
    card({
      id: "06 · 3D → 2D projection",
      title: "Static Fibonacci sphere — visible hemisphere only",
      expected:
        "A sphere of dots; visibly denser around the silhouette rim and sparser near the front-center. Back beads faded out.",
      failure: "Dots in a flat grid, or uniform density (= no foreshortening).",
      body: `<g transform="translate(0 0)">${dots}</g>`,
    }),
  );
}

// ─── 07: rotating Fibonacci dots via animateTransform (2D rotation only) ────
{
  const N = 80;
  const cx0 = W / 2;
  const cy0 = 220;
  const dots = fibonacciSphere(N)
    .map(({ lat, lon }) => {
      const p = project(
        RX * Math.cos(lat) * Math.sin(lon),
        RX * Math.sin(lat),
        RX * Math.cos(lat) * Math.cos(lon),
      );
      const culling =
        Math.sin(lat) * Math.sin(TILT_X) +
        Math.cos(lat) * Math.cos(lon) * Math.cos(TILT_X);
      const op = Math.max(0, culling).toFixed(2);
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(2 * p.s).toFixed(1)}" fill="#fafafa" opacity="${op}"/>`;
    })
    .join("");
  write(
    "07-fibonacci-rotates-2d",
    card({
      id: "07 · 2D spin (NOT 3D)",
      title: "Fibonacci dots, 2D-rotated as a group (caveat)",
      expected:
        "Whole sphere of dots spins like a record around the center. Honest record-spin look, NOT a 3D globe.",
      failure:
        "Dots disconnect from each other, or the whole rotation is jittery / not a smooth rotation.",
      body: `<g transform="translate(${cx0} ${cy0})">
    <g>
      ${dots}
      <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="12s" repeatCount="indefinite"/>
    </g>
  </g>`,
    }),
  );
}

// ─── 08: perspective depth — 5 dots at varying z ────────────────────────────
{
  const cx0 = W / 2;
  const cy0 = 220;
  const zs = [-80, -40, 0, 40, 80];
  const dots = zs
    .map((z, i) => {
      const x = (i - 2) * 80;
      const p = project(x, 0, z, 0);
      return `<circle cx="${(cx0 + p.x).toFixed(1)}" cy="${cy0.toFixed(1)}" r="${(10 * p.s).toFixed(1)}" fill="#fafafa"/>
  <text x="${(cx0 + p.x).toFixed(1)}" y="${(cy0 + 28).toFixed(1)}" font-family="ui-monospace, monospace" font-size="11" fill="#737373" text-anchor="middle">z=${z}</text>`;
    })
    .join("\n  ");
  write(
    "08-perspective-depth-sizes",
    card({
      id: "08 · perspective scale",
      title: "5 dots at z = −80…+80, projected with D=360",
      expected:
        "Dots at higher z (forward) are bigger; at lower z (back) are smaller. Sizes vary monotonically left → right.",
      failure: "All dots same size, or sizes increase backwards.",
      body: `<line x1="100" y1="${cy0}" x2="700" y2="${cy0}" class="frame-edge"/>
  ${dots}`,
    }),
  );
}

// ─── 09: single triangle ────────────────────────────────────────────────────
write(
  "09-single-triangle",
  card({
    id: "09 · path Z",
    title: "A single closed triangle (stroke only)",
    expected: "An equilateral-ish triangle outlined in white.",
    failure: "Filled shape, missing edge, or no triangle at all.",
    body: `<polygon points="400,140 470,260 330,260" fill="none" stroke="#fafafa" stroke-width="1.5"/>`,
  }),
);

// ─── 10: static 2D triangle mesh ────────────────────────────────────────────
{
  const cx0 = W / 2;
  const cy0 = 220;
  const cols = 6;
  const rows = 3;
  const dx = 50;
  const dy = 40;
  const pts: { x: number; y: number }[] = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const off = r % 2 === 0 ? 0 : dx / 2;
      pts.push({ x: cx0 - (cols * dx) / 2 + c * dx + off, y: cy0 - (rows * dy) / 2 + r * dy });
    }
  }
  // Triangle strips between rows
  const tris: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c;
      const b = a + 1;
      const cc = a + (cols + 1);
      const dd = cc + 1;
      tris.push(
        `<polygon points="${pts[a]!.x},${pts[a]!.y} ${pts[b]!.x},${pts[b]!.y} ${pts[cc]!.x},${pts[cc]!.y}" fill="none" stroke="#fafafa" stroke-width="0.75" opacity="0.7"/>`,
        `<polygon points="${pts[b]!.x},${pts[b]!.y} ${pts[dd]!.x},${pts[dd]!.y} ${pts[cc]!.x},${pts[cc]!.y}" fill="none" stroke="#fafafa" stroke-width="0.75" opacity="0.7"/>`,
      );
    }
  }
  write(
    "10-static-2d-triangle-mesh",
    card({
      id: "10 · triangle grid",
      title: "Flat 2D triangle mesh (no 3D)",
      expected: "An offset-rows triangle grid (alternating up/down triangles), drawn as wireframe.",
      failure: "Disconnected lines, missing rows, or no triangles.",
      body: tris.join("\n  "),
    }),
  );
}

// ─── 11: globe lat/lon wireframe, static ────────────────────────────────────
{
  const cx0 = W / 2;
  const cy0 = 220;
  const nLat = 7; // horizontal slices (excluding poles)
  const nLon = 16; // vertical slices
  const lats: number[] = [];
  for (let i = 1; i < nLat; i++) lats.push(-Math.PI / 2 + (i / nLat) * Math.PI);
  const lons: number[] = [];
  for (let i = 0; i < nLon; i++) lons.push((i / nLon) * 2 * Math.PI);

  // Sample each parallel + meridian as a polyline
  const SAMPLES_PER = 48;
  const lines: string[] = [];

  for (const lat of lats) {
    const pts: string[] = [];
    for (let k = 0; k <= SAMPLES_PER; k++) {
      const lon = (k / SAMPLES_PER) * 2 * Math.PI;
      const px = RX * Math.cos(lat) * Math.sin(lon);
      const py = RX * Math.sin(lat);
      const pz = RX * Math.cos(lat) * Math.cos(lon);
      const p = project(px, py, pz);
      const culling =
        Math.sin(lat) * Math.sin(TILT_X) +
        Math.cos(lat) * Math.cos(lon) * Math.cos(TILT_X);
      if (culling > 0) pts.push(`${(cx0 + p.x).toFixed(1)},${(cy0 + p.y).toFixed(1)}`);
      else if (pts.length > 0) {
        lines.push(
          `<polyline points="${pts.join(" ")}" fill="none" stroke="#fafafa" stroke-width="0.6" opacity="0.5"/>`,
        );
        pts.length = 0;
      }
    }
    if (pts.length > 0) {
      lines.push(
        `<polyline points="${pts.join(" ")}" fill="none" stroke="#fafafa" stroke-width="0.6" opacity="0.5"/>`,
      );
    }
  }

  for (const lon of lons) {
    const pts: string[] = [];
    for (let k = 0; k <= SAMPLES_PER; k++) {
      const lat = -Math.PI / 2 + (k / SAMPLES_PER) * Math.PI;
      const px = RX * Math.cos(lat) * Math.sin(lon);
      const py = RX * Math.sin(lat);
      const pz = RX * Math.cos(lat) * Math.cos(lon);
      const p = project(px, py, pz);
      const culling =
        Math.sin(lat) * Math.sin(TILT_X) +
        Math.cos(lat) * Math.cos(lon) * Math.cos(TILT_X);
      if (culling > 0) pts.push(`${(cx0 + p.x).toFixed(1)},${(cy0 + p.y).toFixed(1)}`);
      else if (pts.length > 0) {
        lines.push(
          `<polyline points="${pts.join(" ")}" fill="none" stroke="#fafafa" stroke-width="0.6" opacity="0.5"/>`,
        );
        pts.length = 0;
      }
    }
    if (pts.length > 0) {
      lines.push(
        `<polyline points="${pts.join(" ")}" fill="none" stroke="#fafafa" stroke-width="0.6" opacity="0.5"/>`,
      );
    }
  }

  write(
    "11-globe-latlon-static",
    card({
      id: "11 · lat/lon wireframe",
      title: "Classic globe wireframe — visible hemisphere",
      expected:
        "Latitude curves (horizontal) and longitude curves (vertical) form a globe wireframe, visible-side only.",
      failure: "Lines extend through the back, or the shape isn't a globe.",
      body: lines.join("\n  "),
    }),
  );
}

// ─── 12: globe lat/lon, 2D-rotating ─────────────────────────────────────────
{
  const cx0 = W / 2;
  const cy0 = 220;
  const nLat = 7;
  const nLon = 12;
  const lats: number[] = [];
  for (let i = 1; i < nLat; i++) lats.push(-Math.PI / 2 + (i / nLat) * Math.PI);
  const lons: number[] = [];
  for (let i = 0; i < nLon; i++) lons.push((i / nLon) * 2 * Math.PI);

  const SAMPLES_PER = 48;
  const lines: string[] = [];

  const polyOf = (samples: { px: number; py: number; pz: number; lat: number; lon: number }[]) => {
    const out: string[] = [];
    const acc: string[] = [];
    for (const s of samples) {
      const culling =
        Math.sin(s.lat) * Math.sin(TILT_X) +
        Math.cos(s.lat) * Math.cos(s.lon) * Math.cos(TILT_X);
      if (culling > 0) {
        const p = project(s.px, s.py, s.pz);
        acc.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
      } else if (acc.length > 0) {
        out.push(
          `<polyline points="${acc.join(" ")}" fill="none" stroke="#fafafa" stroke-width="0.6" opacity="0.5"/>`,
        );
        acc.length = 0;
      }
    }
    if (acc.length > 0)
      out.push(
        `<polyline points="${acc.join(" ")}" fill="none" stroke="#fafafa" stroke-width="0.6" opacity="0.5"/>`,
      );
    return out;
  };

  for (const lat of lats) {
    const samples = [];
    for (let k = 0; k <= SAMPLES_PER; k++) {
      const lon = (k / SAMPLES_PER) * 2 * Math.PI;
      samples.push({
        px: RX * Math.cos(lat) * Math.sin(lon),
        py: RX * Math.sin(lat),
        pz: RX * Math.cos(lat) * Math.cos(lon),
        lat,
        lon,
      });
    }
    lines.push(...polyOf(samples));
  }
  for (const lon of lons) {
    const samples = [];
    for (let k = 0; k <= SAMPLES_PER; k++) {
      const lat = -Math.PI / 2 + (k / SAMPLES_PER) * Math.PI;
      samples.push({
        px: RX * Math.cos(lat) * Math.sin(lon),
        py: RX * Math.sin(lat),
        pz: RX * Math.cos(lat) * Math.cos(lon),
        lat,
        lon,
      });
    }
    lines.push(...polyOf(samples));
  }

  write(
    "12-globe-latlon-rotates-2d",
    card({
      id: "12 · 2D spin caveat",
      title: "Globe wireframe, 2D-rotated as a group",
      expected:
        "Visible-side globe wireframe rotates as a flat group; lines stay connected. Not a 3D globe — record-spin only.",
      failure: "Lines tear apart, or the visible hemisphere wraps around incorrectly.",
      body: `<g transform="translate(${cx0} ${cy0})">
    <g>
      ${lines.join("\n      ")}
      <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="14s" repeatCount="indefinite"/>
    </g>
  </g>`,
    }),
  );
}

// ─── 13: icosahedron wireframe, static ──────────────────────────────────────
{
  const phi = (1 + Math.sqrt(5)) / 2;
  // 12 vertices of icosahedron, scaled so the circumradius = RX.
  const norm = Math.hypot(1, phi);
  const k = RX / norm;
  const v: [number, number, number][] = [
    [0, +1, +phi], [0, +1, -phi], [0, -1, +phi], [0, -1, -phi],
    [+1, +phi, 0], [+1, -phi, 0], [-1, +phi, 0], [-1, -phi, 0],
    [+phi, 0, +1], [+phi, 0, -1], [-phi, 0, +1], [-phi, 0, -1],
  ].map(([x, y, z]) => [x * k, y * k, z * k]);
  // 30 edges
  const edges: [number, number][] = [
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
  const cx0 = W / 2;
  const cy0 = 220;
  const projVerts = v.map(([x, y, z]) => {
    const p = project(x, y, z);
    return { x: cx0 + p.x, y: cy0 + p.y, z };
  });
  const lines = edges
    .map(([a, b]) => {
      const A = projVerts[a]!;
      const B = projVerts[b]!;
      const culling = Math.max(0, Math.min(1, (A.z + B.z) / (2 * RX) + 0.5));
      const op = culling.toFixed(2);
      return `<line x1="${A.x.toFixed(1)}" y1="${A.y.toFixed(1)}" x2="${B.x.toFixed(1)}" y2="${B.y.toFixed(1)}" stroke="#fafafa" stroke-width="0.8" opacity="${op}"/>`;
    })
    .join("\n  ");
  const verts = projVerts
    .map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2" fill="#fafafa"/>`)
    .join("");
  write(
    "13-icosahedron-static",
    card({
      id: "13 · icosphere edges",
      title: "Icosahedron wireframe (12 verts, 30 edges)",
      expected:
        "A roughly spherical wireframe of 30 white edges between 12 vertex dots. Back-facing edges faded.",
      failure: "Wrong vertex count, missing edges, or no spherical structure.",
      body: `${lines}
  ${verts}`,
    }),
  );
}

// ─── 14: Fibonacci k-NN edges ───────────────────────────────────────────────
{
  const N = 80;
  const K = 6;
  const cx0 = W / 2;
  const cy0 = 220;
  const samples = fibonacciSphere(N);
  const verts3 = samples.map(({ lat, lon }) => ({
    x3: RX * Math.cos(lat) * Math.sin(lon),
    y3: RX * Math.sin(lat),
    z3: RX * Math.cos(lat) * Math.cos(lon),
    lat,
    lon,
  }));
  // For each vertex, find the K nearest others by 3D distance, emit edges.
  const edgeSet = new Set<string>();
  for (let i = 0; i < verts3.length; i++) {
    const v = verts3[i]!;
    const dists = verts3.map((u, j) => ({
      j,
      d: Math.hypot(u.x3 - v.x3, u.y3 - v.y3, u.z3 - v.z3),
    }));
    dists.sort((a, b) => a.d - b.d);
    for (let kk = 1; kk <= K; kk++) {
      const j = dists[kk]!.j;
      const key = i < j ? `${i},${j}` : `${j},${i}`;
      edgeSet.add(key);
    }
  }
  const projVerts = verts3.map((v) => {
    const p = project(v.x3, v.y3, v.z3);
    const culling =
      Math.sin(v.lat) * Math.sin(TILT_X) +
      Math.cos(v.lat) * Math.cos(v.lon) * Math.cos(TILT_X);
    return { x: cx0 + p.x, y: cy0 + p.y, op: Math.max(0, culling) };
  });
  const lines = Array.from(edgeSet)
    .map((key) => {
      const [a, b] = key.split(",").map(Number) as [number, number];
      const A = projVerts[a]!;
      const B = projVerts[b]!;
      const op = Math.min(A.op, B.op);
      return `<line x1="${A.x.toFixed(1)}" y1="${A.y.toFixed(1)}" x2="${B.x.toFixed(1)}" y2="${B.y.toFixed(1)}" stroke="#fafafa" stroke-width="0.5" opacity="${(op * 0.6).toFixed(2)}"/>`;
    })
    .join("\n  ");
  const vDots = projVerts
    .map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="1.5" fill="#fafafa" opacity="${p.op.toFixed(2)}"/>`)
    .join("");
  write(
    "14-fibonacci-knn-edges",
    card({
      id: "14 · k-NN mesh",
      title: "Fibonacci dots + 6-nearest-neighbor edges",
      expected:
        "Organic, mostly-triangulated wireframe across the front hemisphere; denser look near the rim.",
      failure: "Edges criss-cross randomly through the sphere or all dots are connected (over-meshed).",
      body: `${lines}
  ${vDots}`,
    }),
  );
}

// ─── 15: whole-scale breathing ──────────────────────────────────────────────
{
  const N = 80;
  const cx0 = W / 2;
  const cy0 = 220;
  const dots = fibonacciSphere(N)
    .map(({ lat, lon }) => {
      const p = project(
        RX * Math.cos(lat) * Math.sin(lon),
        RX * Math.sin(lat),
        RX * Math.cos(lat) * Math.cos(lon),
      );
      const culling =
        Math.sin(lat) * Math.sin(TILT_X) +
        Math.cos(lat) * Math.cos(lon) * Math.cos(TILT_X);
      const op = Math.max(0, culling).toFixed(2);
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(2 * p.s).toFixed(1)}" fill="#fafafa" opacity="${op}"/>`;
    })
    .join("");
  write(
    "15-whole-scale-breathing",
    card({
      id: "15 · scale breathing",
      title: "Whole sphere subtle scale pulse (±3%)",
      expected: "Sphere of dots subtly pulses bigger/smaller, like breathing. No rotation.",
      failure: "No size change, or jittery non-smooth motion.",
      body: `<g transform="translate(${cx0} ${cy0})">
    <g>
      ${dots}
      <animateTransform attributeName="transform" type="scale" values="1; 1.03; 1" keyTimes="0; 0.5; 1" dur="4s" repeatCount="indefinite"/>
    </g>
  </g>`,
    }),
  );
}

// ─── 16: per-vertex radial wobble (phase offset breathing) ──────────────────
{
  const N = 40;
  const cx0 = W / 2;
  const cy0 = 220;
  const dots = fibonacciSphere(N)
    .map(({ lat, lon }, i) => {
      const cx = RX * Math.cos(lat) * Math.sin(lon);
      const cy = RX * Math.sin(lat);
      const cz = RX * Math.cos(lat) * Math.cos(lon);
      const p = project(cx, cy, cz);
      const culling =
        Math.sin(lat) * Math.sin(TILT_X) +
        Math.cos(lat) * Math.cos(lon) * Math.cos(TILT_X);
      if (culling <= 0) return "";
      // Each dot pulses its own radius with a unique begin offset (phase).
      const phase = (i / N).toFixed(2);
      return `<circle cx="${(cx0 + p.x).toFixed(1)}" cy="${(cy0 + p.y).toFixed(1)}" r="3" fill="#fafafa"><animate attributeName="r" values="2; 4.5; 2" keyTimes="0; 0.5; 1" dur="3s" begin="-${(Number(phase) * 3).toFixed(2)}s" repeatCount="indefinite"/></circle>`;
    })
    .filter(Boolean)
    .join("\n  ");
  write(
    "16-per-vertex-wobble",
    card({
      id: "16 · per-vertex phase",
      title: "Each vertex breathes on its own phase",
      expected:
        "Different dots pulse in and out at different times — a shimmering / rippling sphere of dots.",
      failure: "All dots pulse together (no phase offset) or none pulse.",
      body: dots,
    }),
  );
}

// ─── 17: 2D rim-bias Poisson-like points ────────────────────────────────────
{
  // Simple rim-bias sampling: r = sqrt(u) gives uniform area in disk;
  // r = u^(1/4) biases toward rim. We use r = u^(0.25) for strong rim bias.
  const N = 250;
  const cx0 = W / 2;
  const cy0 = 220;
  const rMax = 110;
  // Seeded pseudo-random
  let seed = 0xdeadbeef;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const dots: string[] = [];
  for (let i = 0; i < N; i++) {
    const u = rnd();
    const r = rMax * Math.pow(u, 0.3); // rim bias
    const theta = rnd() * 2 * Math.PI;
    const x = cx0 + r * Math.cos(theta);
    const y = cy0 + r * Math.sin(theta) * 0.55; // vertical squash, sphere-ish
    dots.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.5" fill="#fafafa" opacity="0.85"/>`);
  }
  write(
    "17-2d-rim-bias-dots",
    card({
      id: "17 · radial density bias",
      title: "Pure 2D rim-biased point cloud (no 3D)",
      expected:
        "Dots in an oval cloud, much denser near the outer rim than near the center.",
      failure: "Uniform density across the cloud, or random scatter.",
      body: dots.join(""),
    }),
  );
}

// ─── 18: 2D rim points + nearest-neighbor edges ─────────────────────────────
{
  const N = 200;
  const cx0 = W / 2;
  const cy0 = 220;
  const rMax = 110;
  let seed = 0xc0ffee;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < N; i++) {
    const u = rnd();
    const r = rMax * Math.pow(u, 0.3);
    const theta = rnd() * 2 * Math.PI;
    pts.push({
      x: cx0 + r * Math.cos(theta),
      y: cy0 + r * Math.sin(theta) * 0.55,
    });
  }
  const K = 4;
  const edgeSet = new Set<string>();
  for (let i = 0; i < pts.length; i++) {
    const di = pts
      .map((q, j) => ({ j, d: Math.hypot(q.x - pts[i]!.x, q.y - pts[i]!.y) }))
      .sort((a, b) => a.d - b.d);
    for (let k = 1; k <= K; k++) {
      const j = di[k]!.j;
      edgeSet.add(i < j ? `${i},${j}` : `${j},${i}`);
    }
  }
  const lines = Array.from(edgeSet)
    .map((k) => {
      const [a, b] = k.split(",").map(Number) as [number, number];
      const A = pts[a]!;
      const B = pts[b]!;
      return `<line x1="${A.x.toFixed(1)}" y1="${A.y.toFixed(1)}" x2="${B.x.toFixed(1)}" y2="${B.y.toFixed(1)}" stroke="#fafafa" stroke-width="0.4" opacity="0.4"/>`;
    })
    .join("\n  ");
  const vDots = pts
    .map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="1" fill="#fafafa" opacity="0.7"/>`)
    .join("");
  write(
    "18-2d-rim-knn-mesh",
    card({
      id: "18 · 2D mesh",
      title: "Rim-biased 2D points + 4-NN edges",
      expected:
        "A wireframe oval cloud — denser, more chaotic mesh near the rim, sparser triangulation near center.",
      failure: "Edges cross dispersedly with no rim-density pattern.",
      body: `${lines}
  ${vDots}`,
    }),
  );
}

console.log(`Wrote 18 atom SVGs to ${outDir}`);
