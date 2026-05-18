/**
 * Museum-header banner — one template, conditional sections.
 *
 * Top row: eyebrow + tech-stack chips.
 * Main: title + wrapped synopsis.
 * Tier indicators: Original / Enhanced / Reimagined dots with state.
 * Stat strip: smart date · languages bar · N commits (conditional).
 * Optional: "Starter from owner/repo" line when fork with 0 owner commits.
 * Right side: KNN mesh sphere with colored points orbiting on outer radius.
 *
 * Renders multiple example projects so the template can be visually
 * compared across cases (fork starter vs own substantive work) before
 * we wire real data via /github-banners/[slug].
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

// ─── Canvas + sphere ──────────────────────────────────────────────────────
const W = 1280;
const H = 360;
const RX = 100;
const D = 4 * RX;
const TILT_X = Math.atan(44 / 140);
const N_KF = 32;
const sphereCx = W - 200;
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

// ─── Build mesh once (shared across all renders) ──────────────────────────
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

function buildSphereElems(): string {
  const elems: string[] = [];
  const frames: Projected[][] = [];
  for (let kf = 0; kf <= N_KF; kf++) {
    const t = kf / N_KF;
    frames.push(
      meshPts.map((p) =>
        tiltAndProject(rotateAxis(p, meshAxis, 2 * Math.PI * t)),
      ),
    );
  }
  for (let i = 0; i < meshPts.length; i++) {
    const cxs = frames.map((vs) => (sphereCx + vs[i]!.x).toFixed(1));
    const cys = frames.map((vs) => (sphereCy + vs[i]!.y).toFixed(1));
    const ops = frames.map((vs) =>
      Math.max(0, vs[i]!.z / RX + 0.3).toFixed(2),
    );
    elems.push(
      `<circle class="mesh-dot" cx="${cxs[0]}" cy="${cys[0]}" r="1.6" opacity="${ops[0]}"><animate attributeName="cx" values="${cxs.join("; ")}" keyTimes="${keyTimes}" dur="${meshDur}" repeatCount="indefinite"/><animate attributeName="cy" values="${cys.join("; ")}" keyTimes="${keyTimes}" dur="${meshDur}" repeatCount="indefinite"/><animate attributeName="opacity" values="${ops.join("; ")}" keyTimes="${keyTimes}" dur="${meshDur}" repeatCount="indefinite"/></circle>`,
    );
  }
  for (const [a, b] of meshEdges) {
    const pts = frames.map(
      (vs) =>
        `${(sphereCx + vs[a]!.x).toFixed(1)},${(sphereCy + vs[a]!.y).toFixed(1)} ${(sphereCx + vs[b]!.x).toFixed(1)},${(sphereCy + vs[b]!.y).toFixed(1)}`,
    );
    const ops = frames.map((vs) =>
      Math.max(
        0,
        Math.min(0.6, (vs[a]!.z + vs[b]!.z) / (2 * RX) + 0.2),
      ).toFixed(2),
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
    elems.push(
      `<circle cx="${cxs[0]}" cy="${cys[0]}" r="${(parseFloat(rs[0]!) * 2.4).toFixed(2)}" fill="${orb.color}" opacity="${(parseFloat(ops[0]!) * 0.22).toFixed(3)}"><animate attributeName="cx" values="${cxs.join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/><animate attributeName="cy" values="${cys.join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/><animate attributeName="r" values="${rs.map((r) => (parseFloat(r) * 2.4).toFixed(2)).join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/><animate attributeName="opacity" values="${ops.map((o) => (parseFloat(o) * 0.22).toFixed(3)).join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/></circle>`,
    );
    elems.push(
      `<circle cx="${cxs[0]}" cy="${cys[0]}" r="${rs[0]}" fill="${orb.color}" opacity="${ops[0]}"><animate attributeName="cx" values="${cxs.join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/><animate attributeName="cy" values="${cys.join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/><animate attributeName="r" values="${rs.join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/><animate attributeName="opacity" values="${ops.join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/></circle>`,
    );
  }
  return elems.join("\n  ");
}

// ─── Template ─────────────────────────────────────────────────────────────
type TierState = "live" | "in-progress" | "coming-soon";
interface Project {
  outputId: string;
  title: string;
  synopsis: string;
  techStack: string[]; // top 3 chips
  /** Smart-derived label ("Forked Jan 2024" vs "Active Aug–Dec 2024"). */
  dateLabel: string;
  /** Owner commit count on `original`; 0 hides the stat. */
  commitsByMe: number;
  /** GitHub-derived languages, summing ≤ 100. Empty hides the bar. */
  languages: { name: string; pct: number; color: string }[];
  tiers: { label: string; state: TierState }[];
  /** "owner/repo" when fork with 0 owner commits; otherwise null. */
  starterFrom: string | null;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

const TEXT_X = 48;
const EYEBROW_Y = 48;
const TITLE_Y = 88;
const SYNOPSIS_Y = 124;
const TIER_Y = 218;
const TIER_LABEL_Y = 244;
const STAT_Y = 296;
const STARTER_Y = 326;

function renderBanner(p: Project): string {
  const synopsisLines = wrap(p.synopsis, 52).slice(0, 2);
  const synopsisSvg = synopsisLines
    .map(
      (line, i) =>
        `<text class="banner-synopsis" x="${TEXT_X}" y="${SYNOPSIS_Y + i * 24}">${esc(line)}</text>`,
    )
    .join("\n  ");

  // Tech chips (top-right area of the text column, near the eyebrow).
  const chipsY = EYEBROW_Y;
  const chipPadX = 10;
  const chipFontSize = 11;
  let chipX = TEXT_X;
  const chipSvg = p.techStack
    .slice(0, 3)
    .map((tech) => {
      const w = Math.round(tech.length * chipFontSize * 0.62) + chipPadX * 2;
      // Position chips on a 2nd line below eyebrow? No — eyebrow is short,
      // chips go on the same eyebrow-Y line with offset from eyebrow text.
      const x = chipX;
      chipX += w + 8;
      return `<g class="chip"><rect x="${x}" y="${chipsY - 14}" rx="9" ry="9" width="${w}" height="20"/><text x="${x + chipPadX}" y="${chipsY + 1}">${esc(tech)}</text></g>`;
    })
    .join("\n  ");

  // Tier indicators: dots + labels + connecting line behind.
  const tierStartX = TEXT_X + 4;
  const tierStepX = 130;
  const tierLineEnd = tierStartX + (p.tiers.length - 1) * tierStepX;
  const tierLine = `<line x1="${tierStartX}" y1="${TIER_Y}" x2="${tierLineEnd}" y2="${TIER_Y}" stroke="currentColor" stroke-opacity="0.15" stroke-width="1"/>`;
  const tierDots = p.tiers
    .map((t, i) => {
      const cx = tierStartX + i * tierStepX;
      const lbl = `<text class="tier-label" x="${cx}" y="${TIER_LABEL_Y}" text-anchor="middle">${esc(t.label)}</text>`;
      if (t.state === "live") {
        // Pulsing green dot with subtle glow.
        return `<g>
          <circle cx="${cx}" cy="${TIER_Y}" r="11" fill="#22c55e" opacity="0.18">
            <animate attributeName="opacity" values="0.12;0.28;0.12" dur="2.4s" repeatCount="indefinite"/>
            <animate attributeName="r" values="10;13;10" dur="2.4s" repeatCount="indefinite"/>
          </circle>
          <circle cx="${cx}" cy="${TIER_Y}" r="6" fill="#22c55e">
            <animate attributeName="opacity" values="0.85;1;0.85" dur="2.4s" repeatCount="indefinite"/>
          </circle>
          ${lbl}
        </g>`;
      }
      if (t.state === "in-progress") {
        return `<g>
          <circle cx="${cx}" cy="${TIER_Y}" r="6" fill="#eab308">
            <animate attributeName="opacity" values="0.6;1;0.6" dur="1.8s" repeatCount="indefinite"/>
          </circle>
          ${lbl}
        </g>`;
      }
      // coming-soon: hollow circle
      return `<g>
        <circle cx="${cx}" cy="${TIER_Y}" r="5.5" fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.5"/>
        ${lbl}
      </g>`;
    })
    .join("\n  ");

  // Stat strip: smart-date · languages · [N commits]
  let statX = TEXT_X;
  const statSegments: string[] = [];

  // Date label
  statSegments.push(
    `<text class="banner-stat" x="${statX}" y="${STAT_Y}">${esc(p.dateLabel)}</text>`,
  );
  statX += Math.round(p.dateLabel.length * 8) + 12; // crude width estimate

  // Separator + languages
  if (p.languages.length > 0) {
    statSegments.push(
      `<text class="banner-stat-sep" x="${statX}" y="${STAT_Y}">·</text>`,
    );
    statX += 14;
    // Build a small horizontal bar with segments, with a text legend after.
    const barW = 110;
    const barH = 8;
    const barY = STAT_Y - 8;
    let segX = statX;
    const segs: string[] = [];
    for (const lang of p.languages) {
      const w = (lang.pct / 100) * barW;
      segs.push(
        `<rect x="${segX.toFixed(1)}" y="${barY}" width="${w.toFixed(1)}" height="${barH}" fill="${lang.color}" rx="2" ry="2"/>`,
      );
      segX += w;
    }
    statSegments.push(`<g>${segs.join("")}</g>`);
    statX += barW + 10;
    const legend = p.languages
      .map((l) => `${l.name} ${l.pct.toFixed(0)}%`)
      .join("  ");
    statSegments.push(
      `<text class="banner-stat" x="${statX}" y="${STAT_Y}">${esc(legend)}</text>`,
    );
    statX += Math.round(legend.length * 7.2) + 12;
  }

  // Commits (conditional)
  if (p.commitsByMe > 0) {
    statSegments.push(
      `<text class="banner-stat-sep" x="${statX}" y="${STAT_Y}">·</text>`,
    );
    statX += 14;
    const commitLabel = `${p.commitsByMe} commit${p.commitsByMe === 1 ? "" : "s"} by moefingers`;
    statSegments.push(
      `<text class="banner-stat" x="${statX}" y="${STAT_Y}">${esc(commitLabel)}</text>`,
    );
  }

  // Optional "starter from" line
  const starterSvg = p.starterFrom
    ? `<text class="banner-starter" x="${TEXT_X}" y="${STARTER_Y}">Starter from ${esc(p.starterFrom)}</text>`
    : "";

  const sphereSvg = buildSphereElems();

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(p.title + " — " + p.synopsis)}">
  <defs>
    <style>
      .banner-eyebrow { font: 600 11px ui-monospace, "Segoe UI Mono", Menlo, monospace; letter-spacing: 0.1em; text-transform: uppercase; fill: #71717a; }
      .banner-title { font: 700 34px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #18181b; }
      .banner-synopsis { font: 400 17px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #3f3f46; }
      .tier-label { font: 600 11px ui-monospace, "Segoe UI Mono", Menlo, monospace; letter-spacing: 0.06em; text-transform: uppercase; fill: #71717a; }
      .banner-stat { font: 500 13px ui-monospace, "Segoe UI Mono", Menlo, monospace; fill: #52525b; }
      .banner-stat-sep { font: 500 13px ui-monospace, "Segoe UI Mono", Menlo, monospace; fill: #a1a1aa; }
      .banner-starter { font: 400 12px ui-monospace, "Segoe UI Mono", Menlo, monospace; fill: #71717a; font-style: italic; }
      .chip rect { fill: #f4f4f5; stroke: #e4e4e7; stroke-width: 1; }
      .chip text { font: 500 11px ui-monospace, "Segoe UI Mono", Menlo, monospace; fill: #3f3f46; }
      .mesh-dot  { fill: #18181b; color: #18181b; }
      .mesh-edge { fill: none; stroke: #18181b; stroke-width: 0.5; }
      svg { color: #18181b; }
      @media (prefers-color-scheme: dark) {
        .banner-title       { fill: #fafafa; }
        .banner-synopsis    { fill: #d4d4d8; }
        .banner-stat        { fill: #a1a1aa; }
        .banner-stat-sep    { fill: #52525b; }
        .banner-starter     { fill: #a1a1aa; }
        .chip rect          { fill: #27272a; stroke: #3f3f46; }
        .chip text          { fill: #d4d4d8; }
        .mesh-dot           { fill: #fafafa; }
        .mesh-edge          { stroke: #fafafa; }
        svg                 { color: #fafafa; }
      }
    </style>
  </defs>
  <text class="banner-eyebrow" x="${TEXT_X}" y="${EYEBROW_Y - 22}">Hosted in the UNLV Museum</text>
  ${chipSvg}
  <text class="banner-title" x="${TEXT_X}" y="${TITLE_Y}">${esc(p.title)}</text>
  ${synopsisSvg}
  ${tierLine}
  ${tierDots}
  ${statSegments.join("\n  ")}
  ${starterSvg}
  ${sphereSvg}
</svg>`;
}

// ─── Example projects ────────────────────────────────────────────────────
const examples: Project[] = [
  {
    outputId: "banner-03-fork-starter-js-dom-events",
    title: "JavaScript & DOM",
    synopsis:
      "Demonstrates JavaScript event handling, DOM manipulation, and OOP fundamentals through interactive web page demos.",
    techStack: ["JavaScript", "DOM API", "Fetch"],
    dateLabel: "Forked Jan 2024",
    commitsByMe: 0,
    languages: [
      { name: "JavaScript", pct: 58, color: "#f7df1e" },
      { name: "HTML", pct: 32, color: "#e34c26" },
      { name: "CSS", pct: 10, color: "#563d7c" },
    ],
    tiers: [
      { label: "Original", state: "live" },
      { label: "Enhanced", state: "coming-soon" },
      { label: "Reimagined", state: "coming-soon" },
    ],
    starterFrom: "NikoPoliarco/HackerUSA-CE-Lab-5.6.5-Events-StarterCode",
  },
  {
    outputId: "banner-03-own-work-admin-portal",
    title: "Admin Portal",
    synopsis:
      "Admin interface with dynamic form fields. Frontend, Express backend, and Fetch-driven CRUD against a starter API.",
    techStack: ["JavaScript", "Express", "Fetch API"],
    dateLabel: "Active Dec 2023 – Feb 2024",
    commitsByMe: 14,
    languages: [
      { name: "JavaScript", pct: 72, color: "#f7df1e" },
      { name: "HTML", pct: 22, color: "#e34c26" },
      { name: "CSS", pct: 6, color: "#563d7c" },
    ],
    tiers: [
      { label: "Original", state: "live" },
      { label: "Enhanced", state: "coming-soon" },
      { label: "Reimagined", state: "coming-soon" },
    ],
    starterFrom: null,
  },
];

for (const p of examples) {
  const svg = renderBanner(p);
  writeFileSync(resolve(outDir, `${p.outputId}.svg`), svg);
  console.log(`  ${p.outputId}.svg — ${(svg.length / 1024).toFixed(1)} KB`);
}
