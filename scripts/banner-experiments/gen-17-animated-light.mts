/**
 * Generates experiment 17 — animated LIGHT on a static-axis sphere series.
 * Separate from gen-16 (axis animation) per "one concept per script".
 *
 * Light paths all stay in the +z half-space (front of sphere depth midplane)
 * so the light icon never has to "cross through" the sphere — SVG/SMIL has no
 * dynamic z-sort, and crossing would reveal the 2D nature of the trick.
 *
 * Usage:
 *   pnpm tsx scripts/banner-experiments/gen-17-animated-light.mts <count:rx:r[:dur[:tiltXdeg[:tiltZdeg]]]> ...
 *
 * Light patterns (env LIGHT_ANIM):
 *   tilted-orbit  — tilted circular orbit in front of sphere (default)
 *   arc-front     — half-arc sweep overhead, both endpoints in front
 *   pendulum      — side-to-side sway, stays in front
 *   static        — constant L (no animation)
 *
 * Optional env:
 *   LIGHT_ANIM        — pattern name (default tilted-orbit)
 *   LIGHT_CYCLES      — orbits per render cycle (default 1)
 *   ORBIT_RADIUS      — orbit radius in 3D units (relative, default 0.5)
 *   ORBIT_CENTER_Z    — offset of orbit center in +Z (default 0.7)
 *   ORBIT_TILT_DEG    — tilt of orbit plane from horizontal (default 30°)
 *   POINT_LIGHT       — "1" or "true" → point light (per-marker direction)
 *   LIGHT_DIST        — point-light distance scale (default = 3×rxOuter)
 *   DUR               — render cycle SMIL duration (default 18s)
 *
 * Examples:
 *   pnpm tsx scripts/banner-experiments/gen-17-animated-light.mts 200:140:9 100:80:6 50:35:4
 *   LIGHT_ANIM=arc-front pnpm tsx scripts/banner-experiments/gen-17-animated-light.mts 300:140:9
 *   POINT_LIGHT=1 LIGHT_DIST=240 pnpm tsx scripts/banner-experiments/gen-17-animated-light.mts 200:140:9 100:80:6
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import {
  bodyToWorld,
  buildKeyTimes,
  DEFAULT_TILT_X,
  fibonacciSphere,
  makeScene,
  normalize,
  orientationFromDegrees,
  worldToBody,
  type Orientation,
} from "./sphere-math.mts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

interface ShellSpec {
  count: number;
  rx: number;
  r: number;
  dur: string;
  orient: Orientation;
}

const shellArgs: string[] = (process as { argv: string[] }).argv.slice(2);
if (shellArgs.length === 0) {
  console.error(
    "Usage: gen-17-animated-light.mts <count:rx:r[:dur[:tiltXdeg[:tiltZdeg]]]> [...]",
  );
  (process as { exit: (code: number) => never }).exit(1);
}

const env = (process as { env: Record<string, string | undefined> }).env;
const DEFAULT_DUR = env.DUR ?? "18s";
const DEFAULT_TILT_X_DEG = (DEFAULT_TILT_X * 180) / Math.PI;

const shells: ShellSpec[] = shellArgs.map((arg: string): ShellSpec => {
  const parts = arg.split(":");
  if (parts.length < 3 || parts.length > 6) {
    throw new Error(
      `Bad shell spec "${arg}" — expected count:rx:r[:dur[:tiltX[:tiltZ]]]`,
    );
  }
  const [cS, rxS, rS, durS, txS, tzS] = parts;
  const count = Number(cS);
  const rx = Number(rxS);
  const r = Number(rS);
  if ([count, rx, r].some(Number.isNaN)) {
    throw new Error(`Bad numeric in shell spec "${arg}"`);
  }
  const tx = txS === undefined || txS === "" ? DEFAULT_TILT_X_DEG : Number(txS);
  const tz = tzS === undefined || tzS === "" ? 0 : Number(tzS);
  return {
    count,
    rx,
    r,
    dur: durS || DEFAULT_DUR,
    orient: orientationFromDegrees(tx, tz),
  };
});

const N_KF = 60;
const LIGHT_ANIM = env.LIGHT_ANIM ?? "tilted-orbit";
const LIGHT_CYCLES = Number(env.LIGHT_CYCLES ?? 1);
const ORBIT_RADIUS = Number(env.ORBIT_RADIUS ?? 0.5);
const ORBIT_CENTER_Z = Number(env.ORBIT_CENTER_Z ?? 0.7);
const ORBIT_TILT_RAD = (Number(env.ORBIT_TILT_DEG ?? 30) * Math.PI) / 180;
const POINT_LIGHT =
  env.POINT_LIGHT === "1" || env.POINT_LIGHT === "true";
const RX_OUTER = Math.max(...shells.map((s) => s.rx));
const LIGHT_DIST = Number(env.LIGHT_DIST ?? 3 * RX_OUTER);

// Light path: returns a position in 3D space. Used either as a direction
// (normalized) for directional light, or as a point-light origin.
type LightPath = (t: number) => [number, number, number];

const LIGHT_PATHS: Record<string, LightPath> = {
  // Constant — single direction in upper-front-left
  static: (_t: number) => [-0.9, 0.4, 0.5],

  // Tilted circular orbit in front. Orbit plane tilted by ORBIT_TILT_RAD,
  // center offset in +Z by ORBIT_CENTER_Z so the entire orbit stays in +z.
  "tilted-orbit": (t: number) => {
    const ang = 2 * Math.PI * LIGHT_CYCLES * t;
    const r = ORBIT_RADIUS;
    const α = ORBIT_TILT_RAD;
    return [
      r * Math.sin(ang),
      r * Math.cos(ang) * Math.sin(α),
      ORBIT_CENTER_Z + r * Math.cos(ang) * Math.cos(α),
    ];
  },

  // Arc-front round-trip — angle goes 0 → π → 0 over the cycle. Smooth loop,
  // no snap-back at the boundary.
  "arc-front": (t: number) => {
    const ang = Math.PI * Math.sin(Math.PI * LIGHT_CYCLES * t);
    return [Math.cos(ang), 0.3 + 0.5 * Math.sin(ang), 0.5];
  },

  // Side-to-side pendulum — Z held positive throughout.
  pendulum: (t: number) => {
    const ang = 2 * Math.PI * LIGHT_CYCLES * t;
    return [Math.sin(ang) * 0.9, 0.4, 0.5];
  },
};

const lightPath = LIGHT_PATHS[LIGHT_ANIM];
if (!lightPath) {
  console.error(`Unknown LIGHT_ANIM "${LIGHT_ANIM}"`);
  console.error(`Valid: ${Object.keys(LIGHT_PATHS).join(", ")}`);
  (process as { exit: (code: number) => never }).exit(1);
}

const scene = makeScene({ D: 4 * RX_OUTER });
const { project, frame } = scene;
const keyTimes = buildKeyTimes(N_KF);

/**
 * Compute the light direction vector at time t for a marker at given center.
 *
 * - Directional mode: lightPath(t) is a direction, same for all markers.
 *   Returns normalized lightPath(t).
 * - Point-light mode: lightPath(t) scaled by LIGHT_DIST is a 3D position.
 *   Returns (L_pos - marker_center) normalized — per-marker direction.
 */
/**
 * Light direction in the SHELL'S BODY FRAME so frame() (which works in body
 * frame) sees the correct relative direction even if shells have different
 * orient tilts.
 */
function lightDirBody(
  t: number,
  centerX: number,
  centerY: number,
  centerZ: number,
  orient: Orientation,
): [number, number, number] {
  const lp = lightPath(t);
  if (POINT_LIGHT) {
    const [wx, wy, wz] = bodyToWorld([centerX, centerY, centerZ], orient);
    const dirWorld = normalize([
      lp[0] * LIGHT_DIST - wx,
      lp[1] * LIGHT_DIST - wy,
      lp[2] * LIGHT_DIST - wz,
    ]);
    return worldToBody(dirWorld, orient);
  }
  return worldToBody(normalize(lp), orient);
}

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
  shellRx: number;
  dur: string;
}

const markers: Marker[] = [];
let globalIdx = 0;

for (const shell of shells) {
  for (const { lat, lon } of fibonacciSphere(shell.count)) {
    const sinL = Math.sin(lat);
    const cosL = Math.cos(lat);
    const paths: string[] = [];
    const ops: string[] = [];
    const cxs: string[] = [];
    const cys: string[] = [];
    for (let k = 0; k <= N_KF; k++) {
      const t = k / N_KF;
      const theta = lon + t * 2 * Math.PI;
      // Marker 3D center (pre-orientation) — for point-light direction calc
      const cx3 = shell.rx * cosL * Math.sin(theta);
      const cy3 = shell.rx * sinL;
      const cz3 = shell.rx * cosL * Math.cos(theta);
      const Ldir = lightDirBody(t, cx3, cy3, cz3, shell.orient);
      const f = frame(theta, sinL, cosL, shell.rx, shell.r, Ldir, shell.orient);
      paths.push(f.path);
      cxs.push(f.cxPct);
      cys.push(f.cyPct);
      ops.push(Math.max(0, f.culling).toFixed(3));
    }
    const hue = ((lat / Math.PI) + 0.5) * 360;
    const cosX0 = Math.cos(shell.orient.tiltX);
    const sinX0 = Math.sin(shell.orient.tiltX);
    markers.push({
      paths,
      ops,
      cxs,
      cys,
      initial: paths[0]!,
      initCx: cxs[0]!,
      initCy: cys[0]!,
      gradId: `m${globalIdx++}`,
      cBright: `hsl(${hue.toFixed(0)}, 80%, 85%)`,
      cMid: `hsl(${hue.toFixed(0)}, 80%, 45%)`,
      cDark: `hsl(${hue.toFixed(0)}, 85%, 10%)`,
      initZ:
        shell.rx * cosL * Math.cos(lon) * cosX0 + shell.rx * sinL * sinX0,
      shellRx: shell.rx,
      dur: shell.dur,
    });
  }
}

markers.sort(
  (a: Marker, b: Marker) => a.shellRx - b.shellRx || a.initZ - b.initZ,
);

const gradients = markers
  .map(
    (m: Marker) =>
      `<radialGradient id="${m.gradId}" cx="${m.initCx}%" cy="${m.initCy}%" r="75%"><stop offset="0%" stop-color="${m.cBright}"/><stop offset="55%" stop-color="${m.cMid}"/><stop offset="100%" stop-color="${m.cDark}"/><animate attributeName="cx" values="${m.cxs.join("%; ")}%" keyTimes="${keyTimes}" dur="${m.dur}" repeatCount="indefinite"/><animate attributeName="cy" values="${m.cys.join("%; ")}%" keyTimes="${keyTimes}" dur="${m.dur}" repeatCount="indefinite"/></radialGradient>`,
  )
  .join("\n    ");

const markerEls = markers
  .map(
    (m: Marker) =>
      `<path fill="url(#${m.gradId})" d="${m.initial}"><animate attributeName="d" values="${m.paths.join("; ")}" keyTimes="${keyTimes}" dur="${m.dur}" repeatCount="indefinite"/><animate attributeName="opacity" values="${m.ops.join("; ")}" keyTimes="${keyTimes}" dur="${m.dur}" repeatCount="indefinite"/></path>`,
  )
  .join("\n    ");

// Animated light icon — projected with the outer shell's static orient (light
// is world-fixed; the icon's depth varies with lightPath, not with any
// time-varying shell rotation). Per-keyframe perspective scale is captured so
// the icon's radius animates with depth too.
const outerShell = shells.reduce((a: ShellSpec, b: ShellSpec) =>
  a.rx >= b.rx ? a : b,
);
const iconOrient = outerShell.orient;
const ICON_DIST = 220;
const SCENE_D = 4 * RX_OUTER;
const lightIconKeys: { cx: number; cy: number; scale: number }[] = [];
for (let k = 0; k <= N_KF; k++) {
  const t = k / N_KF;
  const lp = lightPath(t);
  const x3 = lp[0] * ICON_DIST;
  const y3 = lp[1] * ICON_DIST;
  const z3 = lp[2] * ICON_DIST;
  const cosX = Math.cos(iconOrient.tiltX);
  const sinX = Math.sin(iconOrient.tiltX);
  const cosZ = Math.cos(iconOrient.tiltZ);
  const sinZ = Math.sin(iconOrient.tiltZ);
  const y1 = y3 * cosX - z3 * sinX;
  const z1 = y3 * sinX + z3 * cosX;
  const x2 = x3 * cosZ - y1 * sinZ;
  const y2 = x3 * sinZ + y1 * cosZ;
  const scale = SCENE_D / (SCENE_D - z1);
  lightIconKeys.push({ cx: x2 * scale, cy: -y2 * scale, scale });
}
const iconCx = lightIconKeys.map((p) => p.cx.toFixed(2)).join("; ");
const iconCy = lightIconKeys.map((p) => p.cy.toFixed(2)).join("; ");
const iconGlowR = lightIconKeys.map((p) => (40 * p.scale).toFixed(2)).join("; ");
const iconDotR = lightIconKeys.map((p) => (5 * p.scale).toFixed(2)).join("; ");
const lightAnimated = LIGHT_ANIM !== "static";

const shellSummary = shells
  .map((s: ShellSpec) => `${s.count}@rx=${s.rx}×r=${s.r}`)
  .join(" + ");
const totalMarkers = shells.reduce((a: number, s: ShellSpec) => a + s.count, 0);
const lightMode = POINT_LIGHT ? `point @ dist=${LIGHT_DIST}` : "directional";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 280" width="800" height="280" role="img" aria-label="Animated light — ${LIGHT_ANIM}, ${shellSummary}">
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
      .sub { font: 500 13px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #737373; }
    </style>
  </defs>

  <rect class="bg" width="800" height="280"/>

  <text class="label" x="40" y="40">Experiment 17</text>
  <text class="title" x="40" y="70">Animated light — ${LIGHT_ANIM.toUpperCase()}</text>
  <text class="sub"   x="40" y="98">${totalMarkers} beads, ${shellSummary}. Light: ${lightMode}.</text>
  <text class="sub"   x="40" y="118">Light path stays in +z half-space — never crosses behind the sphere depth.</text>

  <g transform="translate(500 180)">
    ${markerEls}
    <!-- Light icon AFTER markers — renders on top. r animates with perspective scale. -->
    <circle cx="${lightIconKeys[0]!.cx.toFixed(2)}" cy="${lightIconKeys[0]!.cy.toFixed(2)}" r="${(40 * lightIconKeys[0]!.scale).toFixed(2)}" fill="url(#lightIcon)">${
      lightAnimated
        ? `<animate attributeName="cx" values="${iconCx}" keyTimes="${keyTimes}" dur="${outerShell.dur}" repeatCount="indefinite"/><animate attributeName="cy" values="${iconCy}" keyTimes="${keyTimes}" dur="${outerShell.dur}" repeatCount="indefinite"/><animate attributeName="r" values="${iconGlowR}" keyTimes="${keyTimes}" dur="${outerShell.dur}" repeatCount="indefinite"/>`
        : ""
    }</circle>
    <circle cx="${lightIconKeys[0]!.cx.toFixed(2)}" cy="${lightIconKeys[0]!.cy.toFixed(2)}" r="${(5 * lightIconKeys[0]!.scale).toFixed(2)}" fill="#fffbeb">${
      lightAnimated
        ? `<animate attributeName="cx" values="${iconCx}" keyTimes="${keyTimes}" dur="${outerShell.dur}" repeatCount="indefinite"/><animate attributeName="cy" values="${iconCy}" keyTimes="${keyTimes}" dur="${outerShell.dur}" repeatCount="indefinite"/><animate attributeName="r" values="${iconDotR}" keyTimes="${keyTimes}" dur="${outerShell.dur}" repeatCount="indefinite"/>`
        : ""
    }</circle>
  </g>
</svg>`;

const shellTag = shells
  .map((s: ShellSpec) =>
    s.dur !== DEFAULT_DUR
      ? `${s.count}x${s.rx}x${s.r}@${s.dur}`
      : `${s.count}x${s.rx}x${s.r}`,
  )
  .join("_");
const cyclesTag = LIGHT_CYCLES !== 1 ? `x${LIGHT_CYCLES}` : "";
const distTag = POINT_LIGHT ? `-point${LIGHT_DIST}` : "";
const lightTag = `${LIGHT_ANIM}${cyclesTag}${distTag}`;
const outPath = resolve(
  projectRoot,
  `public/banner-experiments/17-light-${lightTag}_${shellTag}.svg`,
);
writeFileSync(outPath, svg);
console.log(
  `Wrote ${(svg.length / 1024).toFixed(1)} KB → ${outPath}\n  light=${LIGHT_ANIM} cycles=${LIGHT_CYCLES} mode=${lightMode}`,
);
