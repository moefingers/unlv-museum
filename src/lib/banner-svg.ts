/**
 * Museum-header banner renderer. Pure functions — no fs, no fetch, no
 * runtime side effects. Consumed by both the gen script (for gallery
 * preview SVGs) and the /github-banners/[slug] route (for live banners).
 *
 * Layout: 1280×360 transparent banner. Eyebrow + tech chips + title +
 * synopsis on the left, KNN mesh with orbiting colored points anchored
 * on the right, tier indicators + stat strip across the lower-left.
 *
 * Theme-responsive via prefers-color-scheme media query inside the SVG —
 * works through <img> embedding (GitHub camo respects it).
 */

// ─── Canvas + sphere math ────────────────────────────────────────────────
// Narrower aspect (3:1) helps on small displays — the README scales the
// banner to its container width, so a too-wide intrinsic ratio crushes
// the rendered height to illegible at mobile widths.
const W = 1080;
const H = 360;
const RX = 100;
const D = 4 * RX;
const TILT_X = Math.atan(44 / 140);
const N_KF = 32;
const sphereCx = W - 170;
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

// Mesh + edges computed once at module load (deterministic).
const N14 = 60;
const K14 = 5;
const meshPts: Vec3[] = fibonacciSphere(N14).map(({ lat, lon }) => [
  RX * Math.cos(lat) * Math.sin(lon),
  RX * Math.sin(lat),
  RX * Math.cos(lat) * Math.cos(lon),
]);
const _edgeSet = new Set<string>();
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
    _edgeSet.add(i < j ? `${i},${j}` : `${j},${i}`);
  }
}
const meshEdges = Array.from(_edgeSet).map(
  (s) => s.split(",").map(Number) as [number, number],
);
const meshAxis: Vec3 = [0, Math.SQRT1_2, Math.SQRT1_2];
const meshDur = "22s";

interface Orbit {
  color: string;
  /** Radial-gradient id; one per orbit color, defined in the SVG <defs>. */
  glowId: string;
  radius: number;
  axis: Vec3;
  phase: number;
  dur: string;
  size: number;
}
const orbits: Orbit[] = [
  {
    color: "#22d3ee",
    glowId: "orbGlowCyan",
    radius: RX * 1.32,
    axis: unit([0.1, 0.9, 0.1]),
    phase: 0.0,
    dur: "11s",
    size: 4.5,
  },
  {
    color: "#f472b6",
    glowId: "orbGlowPink",
    radius: RX * 1.45,
    axis: unit([0.6, 0.3, -0.7]),
    phase: 0.33,
    dur: "13s",
    size: 3.8,
  },
  {
    color: "#fbbf24",
    glowId: "orbGlowAmber",
    radius: RX * 1.25,
    axis: unit([-0.4, 0.6, 0.6]),
    phase: 0.66,
    dur: "9s",
    size: 5.0,
  },
  {
    color: "#a78bfa",
    glowId: "orbGlowViolet",
    radius: RX * 1.55,
    axis: unit([0.5, -0.4, 0.7]),
    phase: 0.18,
    dur: "16s",
    size: 4.0,
  },
];

/** Radial-gradient defs for the four orbit colors, emitted into the SVG <defs>. */
const ORBIT_GLOW_DEFS = orbits
  .map(
    (o) =>
      `<radialGradient id="${o.glowId}" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${o.color}" stop-opacity="1"/>
      <stop offset="0.45" stop-color="${o.color}" stop-opacity="0.5"/>
      <stop offset="1" stop-color="${o.color}" stop-opacity="0"/>
    </radialGradient>`,
  )
  .join("\n    ");

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
    const ops = frames.map((vs) => Math.max(0, vs[i]!.z / RX + 0.3).toFixed(2));
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
    // Glow uses a radial gradient (bright center → transparent edge) so the
    // halo blends softly into the background instead of presenting a hard
    // disk edge. r is enlarged ~3.4x and opacity tracks the depth-fade.
    elems.push(
      `<circle cx="${cxs[0]}" cy="${cys[0]}" r="${(parseFloat(rs[0]!) * 3.4).toFixed(2)}" fill="url(#${orb.glowId})" opacity="${(parseFloat(ops[0]!) * 0.55).toFixed(3)}"><animate attributeName="cx" values="${cxs.join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/><animate attributeName="cy" values="${cys.join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/><animate attributeName="r" values="${rs.map((r) => (parseFloat(r) * 3.4).toFixed(2)).join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/><animate attributeName="opacity" values="${ops.map((o) => (parseFloat(o) * 0.55).toFixed(3)).join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/></circle>`,
    );
    elems.push(
      `<circle cx="${cxs[0]}" cy="${cys[0]}" r="${rs[0]}" fill="${orb.color}" opacity="${ops[0]}"><animate attributeName="cx" values="${cxs.join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/><animate attributeName="cy" values="${cys.join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/><animate attributeName="r" values="${rs.join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/><animate attributeName="opacity" values="${ops.join("; ")}" keyTimes="${keyTimes}" dur="${orb.dur}" repeatCount="indefinite"/></circle>`,
    );
  }
  return elems.join("\n  ");
}

// ─── Banner-level types + template ───────────────────────────────────────
export type TierState = "live" | "in-progress" | "coming-soon";

export interface BannerLanguage {
  name: string;
  pct: number;
  color: string;
}

export interface BannerInput {
  title: string;
  synopsis: string;
  techStack: string[];
  dateLabel: string;
  commitsByMe: number;
  languages: BannerLanguage[];
  tiers: { label: string; state: TierState }[];
  /** owner/repo of the upstream when this repo is a fork; null otherwise. */
  forkedFrom: string | null;
  /**
   * Lock the banner palette to a specific theme. When omitted, the SVG
   * includes a prefers-color-scheme media query and adapts automatically.
   * GitHub's camo proxy doesn't propagate the host page's color scheme to
   * `<img>`-loaded SVGs reliably, so READMEs serve two themed variants via
   * `<picture>` and use this knob to pin each one.
   */
  theme?: "light" | "dark";
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

// Palette per theme — used either inside @media (when theme is undefined) or
// emitted unconditionally (when theme is pinned via `?theme=light|dark`).
const LIGHT_PALETTE = {
  svgColor: "#18181b",
  eyebrow: "#71717a",
  title: "#18181b",
  synopsis: "#3f3f46",
  tierLabel: "#71717a",
  stat: "#52525b",
  statSep: "#a1a1aa",
  starter: "#71717a",
  forkPath: "#71717a",
  chipFill: "#f4f4f5",
  chipStroke: "#e4e4e7",
  chipText: "#3f3f46",
  meshDot: "#18181b",
  meshEdge: "#18181b",
};
const DARK_PALETTE: typeof LIGHT_PALETTE = {
  svgColor: "#fafafa",
  eyebrow: "#a1a1aa",
  title: "#fafafa",
  synopsis: "#d4d4d8",
  tierLabel: "#a1a1aa",
  stat: "#a1a1aa",
  statSep: "#52525b",
  starter: "#a1a1aa",
  forkPath: "#a1a1aa",
  chipFill: "#27272a",
  chipStroke: "#3f3f46",
  chipText: "#d4d4d8",
  meshDot: "#fafafa",
  meshEdge: "#fafafa",
};

function paletteCss(p: typeof LIGHT_PALETTE, indent = "      "): string {
  const i = indent;
  return [
    `svg                 { color: ${p.svgColor}; }`,
    `.banner-eyebrow     { fill: ${p.eyebrow}; }`,
    `.banner-title       { fill: ${p.title}; }`,
    `.banner-synopsis    { fill: ${p.synopsis}; }`,
    `.tier-label         { fill: ${p.tierLabel}; }`,
    `.banner-stat        { fill: ${p.stat}; }`,
    `.banner-stat-sep    { fill: ${p.statSep}; }`,
    `.banner-starter     { fill: ${p.starter}; }`,
    `.banner-fork path   { fill: ${p.forkPath}; }`,
    `.chip rect          { fill: ${p.chipFill}; stroke: ${p.chipStroke}; }`,
    `.chip text          { fill: ${p.chipText}; }`,
    `.mesh-dot           { fill: ${p.meshDot}; }`,
    `.mesh-edge          { stroke: ${p.meshEdge}; }`,
  ]
    .map((line) => i + line)
    .join("\n");
}

/**
 * When a theme is pinned, emit the palette unconditionally so the rendered
 * SVG is theme-locked (no @media query) — needed because `<img>`-loaded SVGs
 * on github.com don't reliably honour prefers-color-scheme. When theme is
 * undefined, emit the responsive variant (light default + dark override).
 */
function themeRules(theme: "light" | "dark" | undefined): string {
  if (theme === "light") return paletteCss(LIGHT_PALETTE);
  if (theme === "dark") return paletteCss(DARK_PALETTE);
  return `${paletteCss(LIGHT_PALETTE)}
      @media (prefers-color-scheme: dark) {
${paletteCss(DARK_PALETTE, "        ")}
      }`;
}

const TEXT_X = 48;
const EYEBROW_Y = 48;
const TITLE_Y = 100;
const SYNOPSIS_Y = 138;
const TIER_Y = 224;
const TIER_LABEL_Y = 250;
const STAT_Y = 304;
const STARTER_Y = 334;

export function renderBanner(p: BannerInput): string {
  const synopsisLines = wrap(p.synopsis, 72).slice(0, 2);
  const synopsisSvg = synopsisLines
    .map(
      (line, i) =>
        `<text class="banner-synopsis" x="${TEXT_X}" y="${SYNOPSIS_Y + i * 24}">${esc(line)}</text>`,
    )
    .join("\n  ");

  // Tech chips on eyebrow line, just after the "Hosted in..." text.
  // Eyebrow text is ~210px wide; chips start at TEXT_X + 240.
  const chipFontPx = 11;
  const chipPadX = 10;
  const chipGap = 6;
  let chipX = TEXT_X + 240;
  const chipSvg = p.techStack
    .slice(0, 3)
    .map((tech) => {
      const w = Math.round(tech.length * chipFontPx * 0.62) + chipPadX * 2;
      const x = chipX;
      chipX += w + chipGap;
      return `<g class="chip"><rect x="${x}" y="${EYEBROW_Y - 14}" rx="9" ry="9" width="${w}" height="20"/><text x="${x + chipPadX}" y="${EYEBROW_Y + 1}">${esc(tech)}</text></g>`;
    })
    .join("\n  ");

  // Tier indicators.
  const tierStartX = TEXT_X + 4;
  const tierStepX = 130;
  const tierLineEnd = tierStartX + (p.tiers.length - 1) * tierStepX;
  const tierLine = `<line x1="${tierStartX}" y1="${TIER_Y}" x2="${tierLineEnd}" y2="${TIER_Y}" stroke="currentColor" stroke-opacity="0.15" stroke-width="1"/>`;
  const tierDots = p.tiers
    .map((t, i) => {
      const cx = tierStartX + i * tierStepX;
      const lbl = `<text class="tier-label" x="${cx}" y="${TIER_LABEL_Y}" text-anchor="middle">${esc(t.label)}</text>`;
      if (t.state === "live") {
        return `<g>
    <circle cx="${cx}" cy="${TIER_Y}" r="13" fill="url(#liveDotHalo)"><animate attributeName="r" values="11;16;11" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.55;1;0.55" dur="2.4s" repeatCount="indefinite"/></circle>
    <circle cx="${cx}" cy="${TIER_Y}" r="6" fill="url(#liveDotCore)"><animate attributeName="opacity" values="0.9;1;0.9" dur="2.4s" repeatCount="indefinite"/></circle>
    ${lbl}
  </g>`;
      }
      if (t.state === "in-progress") {
        return `<g>
    <circle cx="${cx}" cy="${TIER_Y}" r="13" fill="url(#wipDotHalo)"><animate attributeName="r" values="11;16;11" dur="1.8s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.55;1;0.55" dur="1.8s" repeatCount="indefinite"/></circle>
    <circle cx="${cx}" cy="${TIER_Y}" r="6" fill="url(#wipDotCore)"><animate attributeName="opacity" values="0.9;1;0.9" dur="1.8s" repeatCount="indefinite"/></circle>
    ${lbl}
  </g>`;
      }
      return `<g>
    <circle cx="${cx}" cy="${TIER_Y}" r="5.5" fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.5"/>
    ${lbl}
  </g>`;
    })
    .join("\n  ");

  // Stat strip: smart-date · [languages] · [N commits]
  const statSegments: string[] = [];
  let statX = TEXT_X;

  statSegments.push(
    `<text class="banner-stat" x="${statX}" y="${STAT_Y}">${esc(p.dateLabel)}</text>`,
  );
  statX += Math.round(p.dateLabel.length * 7.6) + 12;

  if (p.languages.length > 0) {
    statSegments.push(
      `<text class="banner-stat-sep" x="${statX}" y="${STAT_Y}">·</text>`,
    );
    statX += 14;
    const barW = 110;
    const barH = 8;
    const barY = STAT_Y - 9;
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
      .slice(0, 3)
      .map((l) => `${l.name} ${l.pct.toFixed(0)}%`)
      .join("  ");
    statSegments.push(
      `<text class="banner-stat" x="${statX}" y="${STAT_Y}">${esc(legend)}</text>`,
    );
    statX += Math.round(legend.length * 7.2) + 12;
  }

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

  // GitHub fork glyph (16×16 viewBox) — author: GitHub Primer
  const FORK_PATH =
    "M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z";
  const forkSvg = p.forkedFrom
    ? `<g transform="translate(${TEXT_X}, ${STARTER_Y - 12})" class="banner-fork"><path d="${FORK_PATH}"/></g><text class="banner-starter" x="${TEXT_X + 22}" y="${STARTER_Y}">Forked from ${esc(p.forkedFrom)}</text>`
    : "";

  const sphereSvg = buildSphereElems();

  // Hollow halo around the sphere: faint ring, transparent center.
  const sphereHalo = `<circle cx="${sphereCx}" cy="${sphereCy}" r="${RX * 1.85}" fill="url(#sphereHalo)"/>`;

  // Banner-wide shimmer: a soft highlight slides across every 9s, masked
  // to fade out before reaching the sphere on the right.
  const shimmer = `<rect width="${W}" height="${H}" fill="url(#bannerShimmer)" mask="url(#shimmerEdgeMask)" pointer-events="none"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(p.title + " — " + p.synopsis)}">
  <defs>
    ${ORBIT_GLOW_DEFS}
    <radialGradient id="sphereHalo" cx="50%" cy="50%" r="50%">
      <stop offset="0.45" stop-color="currentColor" stop-opacity="0"/>
      <stop offset="0.82" stop-color="currentColor" stop-opacity="0.08"/>
      <stop offset="1" stop-color="currentColor" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="liveDotCore" cx="35%" cy="35%" r="65%">
      <stop offset="0" stop-color="#bbf7d0"/>
      <stop offset="0.45" stop-color="#4ade80"/>
      <stop offset="1" stop-color="#15803d"/>
    </radialGradient>
    <radialGradient id="liveDotHalo" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#22c55e" stop-opacity="0.55"/>
      <stop offset="0.5" stop-color="#22c55e" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#22c55e" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="wipDotCore" cx="35%" cy="35%" r="65%">
      <stop offset="0" stop-color="#fef08a"/>
      <stop offset="0.45" stop-color="#eab308"/>
      <stop offset="1" stop-color="#a16207"/>
    </radialGradient>
    <radialGradient id="wipDotHalo" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#eab308" stop-opacity="0.5"/>
      <stop offset="0.5" stop-color="#eab308" stop-opacity="0.15"/>
      <stop offset="1" stop-color="#eab308" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bannerShimmer" x1="-30%" y1="0" x2="-10%" y2="0">
      <stop offset="0" stop-color="#fafafa" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#fafafa" stop-opacity="0.07"/>
      <stop offset="1" stop-color="#fafafa" stop-opacity="0"/>
      <animate attributeName="x1" values="-30%;120%" dur="9s" repeatCount="indefinite"/>
      <animate attributeName="x2" values="-10%;140%" dur="9s" repeatCount="indefinite"/>
    </linearGradient>
    <!--
      Soft cutoff before the sphere area: the shimmer rect is masked so it
      fades to black (= invisible) by ~75% of banner width, leaving the
      sphere's right-side region untouched by the sweep.
    -->
    <linearGradient id="shimmerEdgeFade" x1="0" y1="0" x2="100%" y2="0">
      <stop offset="0.55" stop-color="white" stop-opacity="1"/>
      <stop offset="0.78" stop-color="white" stop-opacity="0"/>
    </linearGradient>
    <mask id="shimmerEdgeMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
      <rect width="${W}" height="${H}" fill="url(#shimmerEdgeFade)"/>
    </mask>
    <style>
      .banner-eyebrow { font: 600 11px ui-monospace, "Segoe UI Mono", Menlo, monospace; letter-spacing: 0.1em; text-transform: uppercase; }
      .banner-title { font: 700 34px system-ui, -apple-system, "Segoe UI", sans-serif; }
      .banner-synopsis { font: 400 17px system-ui, -apple-system, "Segoe UI", sans-serif; }
      .tier-label { font: 600 11px ui-monospace, "Segoe UI Mono", Menlo, monospace; letter-spacing: 0.06em; text-transform: uppercase; }
      .banner-stat { font: 500 13px ui-monospace, "Segoe UI Mono", Menlo, monospace; }
      .banner-stat-sep { font: 500 13px ui-monospace, "Segoe UI Mono", Menlo, monospace; }
      .banner-starter { font: 400 12px ui-monospace, "Segoe UI Mono", Menlo, monospace; font-style: italic; }
      .chip rect { stroke-width: 1; }
      .chip text { font: 500 11px ui-monospace, "Segoe UI Mono", Menlo, monospace; }
      .mesh-edge { fill: none; stroke-width: 0.5; }
      ${themeRules(p.theme)}
    </style>
  </defs>
  ${sphereHalo}
  <text class="banner-eyebrow" x="${TEXT_X}" y="${EYEBROW_Y}">Hosted in the UNLV Museum</text>
  ${chipSvg}
  <text class="banner-title" x="${TEXT_X}" y="${TITLE_Y}">${esc(p.title)}</text>
  ${synopsisSvg}
  ${tierLine}
  ${tierDots}
  ${statSegments.join("\n  ")}
  ${forkSvg}
  ${sphereSvg}
  ${shimmer}
</svg>`;
}
