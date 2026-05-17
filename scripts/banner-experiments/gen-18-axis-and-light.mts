/**
 * Experiment 18 — full kitchen sink: per-shell axis animation + animated light.
 *
 * Combines gen-16 (per-shell axis pattern, spins, dur, reverse) with gen-17
 * (animated light path, optional point-light). The light icon renders ON TOP
 * of markers (after them in document order), so any light path works — no
 * depth-crossing problem.
 *
 * Usage:
 *   pnpm tsx scripts/banner-experiments/gen-18-axis-and-light.mts <count:rx:r[:dur[:pattern[:spins]]]> ...
 *
 * Axis patterns (per-shell, 5th position): precess | wobble | nutate | tumble | nod | static
 *
 * Light patterns (env LIGHT_ANIM):
 *   tilted-orbit  — circular orbit in front (default)
 *   orbit         — full revolution around the sphere (NOW SAFE: icon renders on top)
 *   arc-front     — overhead sweep, smoothly round-trips (no snap-back)
 *   pendulum      — side-to-side sway
 *   static        — constant
 *
 * Env vars:
 *   LIGHT_ANIM, LIGHT_CYCLES, ORBIT_RADIUS, ORBIT_CENTER_Z, ORBIT_TILT_DEG,
 *   POINT_LIGHT, LIGHT_DIST, TILT_X, TILT_Z, AMP, AXIS_CYCLES, DUR, N_KF
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import {
  bodyToWorld,
  buildKeyTimes,
  DEFAULT_ORIENTATION,
  fibonacciSphere,
  makeScene,
  normalize,
  orientationFromDegrees,
  worldToBody,
  type Orientation,
} from "./sphere-math.mts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

const env = (process as { env: Record<string, string | undefined> }).env;
const N_KF = Number(env.N_KF ?? 60);
const DEFAULT_DUR = env.DUR ?? "18s";
const TILT_X_BASE = Number(env.TILT_X ?? 25);
const TILT_Z_BASE = Number(env.TILT_Z ?? 0);
const AMP = Number(env.AMP ?? 12);
const AXIS_CYCLES = Number(env.AXIS_CYCLES ?? 1);

const LIGHT_ANIM = env.LIGHT_ANIM ?? "tilted-orbit";
const LIGHT_CYCLES = Number(env.LIGHT_CYCLES ?? 1);
const ORBIT_RADIUS = Number(env.ORBIT_RADIUS ?? 0.5);
const ORBIT_CENTER_Z = Number(env.ORBIT_CENTER_Z ?? 0.7);
const ORBIT_TILT_RAD = (Number(env.ORBIT_TILT_DEG ?? 30) * Math.PI) / 180;
const POINT_LIGHT = env.POINT_LIGHT === "1" || env.POINT_LIGHT === "true";

interface ShellSpec {
  count: number;
  rx: number;
  r: number;
  pattern: string;
  dur: string;
  spins: number;
  reverse: boolean;
}

function parseDur(tok: string | undefined, fallback: string): {
  dur: string;
  reverse: boolean;
} {
  if (!tok) return { dur: fallback, reverse: false };
  const reverse = tok.startsWith("-");
  const positive = reverse ? tok.slice(1) : tok;
  if (!/^[0-9.]+(ms|s|min|h)?$/.test(positive)) {
    throw new Error(`Bad dur token "${tok}"`);
  }
  return { dur: positive, reverse };
}

const shellArgs: string[] = (process as { argv: string[] }).argv.slice(2);
if (shellArgs.length === 0) {
  console.error(
    "Usage: gen-18-axis-and-light.mts <count:rx:r[:dur[:pattern[:spins]]]> [...]",
  );
  (process as { exit: (code: number) => never }).exit(1);
}

const shells: ShellSpec[] = shellArgs.map((arg: string): ShellSpec => {
  const parts = arg.split(":");
  if (parts.length < 3 || parts.length > 6) {
    throw new Error(`Bad shell spec "${arg}"`);
  }
  const [cS, rxS, rS, durS, patS, spinsS] = parts;
  const count = Number(cS);
  const rx = Number(rxS);
  const r = Number(rS);
  if ([count, rx, r].some(Number.isNaN)) {
    throw new Error(`Bad numeric in shell spec "${arg}"`);
  }
  const { dur, reverse } = parseDur(durS, DEFAULT_DUR);
  return {
    count,
    rx,
    r,
    pattern: patS || "precess",
    dur,
    spins: spinsS !== undefined && spinsS !== "" ? Number(spinsS) : 1,
    reverse,
  };
});

const AXIS_PATTERNS: Record<string, (t: number) => Orientation> = {
  static: (_t) => orientationFromDegrees(TILT_X_BASE, TILT_Z_BASE),
  precess: (t) =>
    orientationFromDegrees(TILT_X_BASE, TILT_Z_BASE + 360 * AXIS_CYCLES * t),
  wobble: (t) =>
    orientationFromDegrees(
      TILT_X_BASE + AMP * Math.sin(2 * Math.PI * AXIS_CYCLES * t),
      TILT_Z_BASE,
    ),
  nutate: (t) =>
    orientationFromDegrees(
      TILT_X_BASE + AMP * Math.sin(2 * Math.PI * AXIS_CYCLES * 6 * t),
      TILT_Z_BASE + 360 * AXIS_CYCLES * t,
    ),
  tumble: (t) =>
    orientationFromDegrees(
      TILT_X_BASE + AMP * Math.cos(2 * Math.PI * AXIS_CYCLES * t),
      TILT_Z_BASE + 360 * AXIS_CYCLES * t,
    ),
  nod: (t) =>
    orientationFromDegrees(
      TILT_X_BASE + AMP * Math.sin(2 * Math.PI * AXIS_CYCLES * t),
      TILT_Z_BASE + AMP * Math.sin(2 * Math.PI * AXIS_CYCLES * 2 * t),
    ),
};

for (const s of shells) {
  if (!AXIS_PATTERNS[s.pattern]) {
    console.error(`Unknown axis pattern "${s.pattern}"`);
    (process as { exit: (code: number) => never }).exit(1);
  }
}

type LightPath = (t: number) => [number, number, number];
const LIGHT_PATHS: Record<string, LightPath> = {
  static: () => [-0.9, 0.4, 0.5],
  "tilted-orbit": (t) => {
    const ang = 2 * Math.PI * LIGHT_CYCLES * t;
    const r = ORBIT_RADIUS;
    const α = ORBIT_TILT_RAD;
    return [
      r * Math.sin(ang),
      r * Math.cos(ang) * Math.sin(α),
      ORBIT_CENTER_Z + r * Math.cos(ang) * Math.cos(α),
    ];
  },
  // Full orbit around Y — now safe because light icon renders on top.
  orbit: (t) => {
    const ang = 2 * Math.PI * LIGHT_CYCLES * t;
    return [Math.sin(ang), 0.4, Math.cos(ang)];
  },
  // Arc-front, round-trip: ang goes 0 → π → 0 over the cycle, so the light
  // smoothly traces overhead and back without snapping at the loop boundary.
  "arc-front": (t) => {
    const ang = Math.PI * Math.sin(Math.PI * LIGHT_CYCLES * t);
    return [Math.cos(ang), 0.3 + 0.5 * Math.sin(ang), 0.5];
  },
  pendulum: (t) => {
    const ang = 2 * Math.PI * LIGHT_CYCLES * t;
    return [Math.sin(ang) * 0.9, 0.4, 0.5];
  },
};

const lightPath = LIGHT_PATHS[LIGHT_ANIM];
if (!lightPath) {
  console.error(`Unknown LIGHT_ANIM "${LIGHT_ANIM}"`);
  (process as { exit: (code: number) => never }).exit(1);
}

const RX_OUTER = Math.max(...shells.map((s) => s.rx));
const LIGHT_DIST = Number(env.LIGHT_DIST ?? 3 * RX_OUTER);

/**
 * Return the light direction in the SHELL'S BODY FRAME for a marker at the
 * given body-frame coordinates. The light's world position/direction is
 * transformed into body frame so that `frame()` — which works in body frame —
 * sees the correct relative direction even as the shell's orient animates.
 *
 * - Directional: L_world = normalize(lightPath(t)); convert directly.
 * - Point light: convert marker body→world, compute world-frame direction
 *   from marker to light position, then convert that direction world→body.
 */
function lightDirBody(
  t: number,
  cx: number,
  cy: number,
  cz: number,
  orient: Orientation,
): [number, number, number] {
  const lp = lightPath(t);
  if (POINT_LIGHT) {
    const [wx, wy, wz] = bodyToWorld([cx, cy, cz], orient);
    const dirWorld = normalize([
      lp[0] * LIGHT_DIST - wx,
      lp[1] * LIGHT_DIST - wy,
      lp[2] * LIGHT_DIST - wz,
    ]);
    return worldToBody(dirWorld, orient);
  }
  return worldToBody(normalize(lp), orient);
}

const scene = makeScene({ D: 4 * RX_OUTER });
const { project, frame } = scene;
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
  shellRx: number;
  dur: string;
}

const markers: Marker[] = [];
let globalIdx = 0;

for (const shell of shells) {
  const orientAt = AXIS_PATTERNS[shell.pattern]!;
  for (const { lat, lon } of fibonacciSphere(shell.count)) {
    const sinL = Math.sin(lat);
    const cosL = Math.cos(lat);
    const paths: string[] = [];
    const ops: string[] = [];
    const cxs: string[] = [];
    const cys: string[] = [];
    for (let k = 0; k <= N_KF; k++) {
      const t = k / N_KF;
      const theta = lon + shell.spins * t * 2 * Math.PI;
      const orient = orientAt(t);
      const cx3 = shell.rx * cosL * Math.sin(theta);
      const cy3 = shell.rx * sinL;
      const cz3 = shell.rx * cosL * Math.cos(theta);
      const Ldir = lightDirBody(t, cx3, cy3, cz3, orient);
      const f = frame(theta, sinL, cosL, shell.rx, shell.r, Ldir, orient);
      paths.push(f.path);
      cxs.push(f.cxPct);
      cys.push(f.cyPct);
      ops.push(Math.max(0, f.culling).toFixed(3));
    }
    if (shell.reverse) {
      paths.reverse();
      ops.reverse();
      cxs.reverse();
      cys.reverse();
    }
    const hue = ((lat / Math.PI) + 0.5) * 360;
    const orient0 = orientAt(0);
    const cosX0 = Math.cos(orient0.tiltX);
    const sinX0 = Math.sin(orient0.tiltX);
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

markers.sort((a, b) => a.shellRx - b.shellRx || a.initZ - b.initZ);

const gradients = markers
  .map(
    (m) =>
      `<radialGradient id="${m.gradId}" cx="${m.initCx}%" cy="${m.initCy}%" r="75%"><stop offset="0%" stop-color="${m.cBright}"/><stop offset="55%" stop-color="${m.cMid}"/><stop offset="100%" stop-color="${m.cDark}"/><animate attributeName="cx" values="${m.cxs.join("%; ")}%" keyTimes="${keyTimes}" dur="${m.dur}" repeatCount="indefinite"/><animate attributeName="cy" values="${m.cys.join("%; ")}%" keyTimes="${keyTimes}" dur="${m.dur}" repeatCount="indefinite"/></radialGradient>`,
  )
  .join("\n    ");

const markerEls = markers
  .map(
    (m) =>
      `<path fill="url(#${m.gradId})" d="${m.initial}"><animate attributeName="d" values="${m.paths.join("; ")}" keyTimes="${keyTimes}" dur="${m.dur}" repeatCount="indefinite"/><animate attributeName="opacity" values="${m.ops.join("; ")}" keyTimes="${keyTimes}" dur="${m.dur}" repeatCount="indefinite"/></path>`,
  )
  .join("\n    ");

const outerShell = shells.reduce((a, b) => (a.rx >= b.rx ? a : b));
const outerOrientAt = AXIS_PATTERNS[outerShell.pattern]!;
// Icon projection is locked to t=0 orientation — light lives in world frame,
// not in the shell's spinning frame. Depth changes are purely from lightPath.
const iconOrient = outerOrientAt(0);
const ICON_DIST = 220;
const SCENE_D = 4 * RX_OUTER;
const lightIconKeys: { cx: number; cy: number; scale: number }[] = [];
for (let k = 0; k <= N_KF; k++) {
  const t = k / N_KF;
  const lp = lightPath(t);
  const x3 = lp[0] * ICON_DIST;
  const y3 = lp[1] * ICON_DIST;
  const z3 = lp[2] * ICON_DIST;
  // Inline project() so we can also capture the perspective scale
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
// Base radii (in 3D world units, conceptually) — actual rendered radius scales
// with perspective. Glow halo: 40 units; bright dot: 5 units.
const iconGlowR = lightIconKeys.map((p) => (40 * p.scale).toFixed(2)).join("; ");
const iconDotR = lightIconKeys.map((p) => (5 * p.scale).toFixed(2)).join("; ");
const lightAnimated = LIGHT_ANIM !== "static";

const shellSummary = shells
  .map((s) => `${s.count}@rx=${s.rx}×r=${s.r} [${s.pattern}, ${s.reverse ? "←" : "→"}${s.dur}]`)
  .join(" + ");
const totalMarkers = shells.reduce((a, s) => a + s.count, 0);
const lightMode = POINT_LIGHT ? `point@${LIGHT_DIST}` : "directional";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 280" width="800" height="280" role="img" aria-label="Axis + light combined">
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

  <text class="label" x="40" y="40">Experiment 18</text>
  <text class="title" x="40" y="70">Axis × light — ${LIGHT_ANIM}</text>
  <text class="sub"   x="40" y="98">${totalMarkers} beads. ${shellSummary}.</text>
  <text class="sub"   x="40" y="118">Light: ${LIGHT_ANIM} ${lightMode}, ${LIGHT_CYCLES} cycle(s).</text>

  <g transform="translate(500 180)">
    ${markerEls}
    <!-- Light icon AFTER markers so it always renders on top — no depth-crossing concern.
         Radius animates with perspective scale so the icon grows/shrinks as it moves toward/away from camera. -->
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
  .map(
    (s) =>
      `${s.count}x${s.rx}x${s.r}-${s.pattern}` +
      (s.dur !== DEFAULT_DUR || s.reverse
        ? `@${s.reverse ? "-" : ""}${s.dur}`
        : "") +
      (s.spins !== 1 ? `x${s.spins}` : ""),
  )
  .join("_");
const cyclesTag = LIGHT_CYCLES !== 1 ? `x${LIGHT_CYCLES}` : "";
const distTag = POINT_LIGHT ? `-point${LIGHT_DIST}` : "";
const lightTag = `${LIGHT_ANIM}${cyclesTag}${distTag}`;
const outPath = resolve(
  projectRoot,
  `public/banner-experiments/18-axislight-${lightTag}_${shellTag}.svg`,
);
writeFileSync(outPath, svg);
console.log(
  `Wrote ${(svg.length / 1024).toFixed(1)} KB → ${outPath}\n  light=${LIGHT_ANIM} (${lightMode}), shells: ${shellSummary}`,
);
