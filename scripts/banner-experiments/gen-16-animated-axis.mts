/**
 * Generates experiment 16 — markers on a sphere whose spin AXIS animates over
 * the cycle. Spin and axis-animation share the same SMIL `dur`; each cycle
 * sweeps through both the spin rotation and the axis pattern, baked together
 * into the per-marker keyframes.
 *
 * Usage:
 *   pnpm tsx scripts/banner-experiments/gen-16-animated-axis.mts <count:rx:r[:dur]> ...
 *
 * Patterns (env PATTERN):
 *   precess  — tiltX stays at base, tiltZ rotates 360° per cycle
 *   wobble   — tiltX oscillates ±amp around base, tiltZ stays
 *   nutate   — slow precession + faster wobble layered on top
 *   tumble   — both tilts rotate (chaotic full-axis travel)
 *   nod      — both axes oscillate in synced figure-8
 *   static   — no axis animation (same behavior as gen-15)
 *
 * Optional env:
 *   PATTERN    = precess | wobble | nutate | tumble | nod | static (default precess)
 *   TILT_X     = base tiltX in degrees (default 25)
 *   TILT_Z     = base tiltZ in degrees (default 0)
 *   AMP        = oscillation amplitude in degrees (default 12)
 *   SPINS      = number of full spins per cycle (default 1)
 *   AXIS_CYCLES= number of axis animation cycles per render cycle (default 1)
 *   N_KF       = keyframes per cycle (default 60; increase if SPINS>1)
 *   DUR        = SMIL animation duration (default 18s)
 *   LX,LY,LZ   = light direction components (default -0.9, 0.4, 0.5)
 *
 * Examples:
 *   # Default precession on a single shell
 *   pnpm tsx scripts/banner-experiments/gen-16-animated-axis.mts 300:140:9
 *
 *   # Wobble with amplitude 20°
 *   PATTERN=wobble AMP=20 pnpm tsx scripts/banner-experiments/gen-16-animated-axis.mts 300:140:9
 *
 *   # Two shells, 3 spins per precession, slow render
 *   SPINS=3 N_KF=180 DUR=30s pnpm tsx scripts/banner-experiments/gen-16-animated-axis.mts 200:140:9 80:60:6
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import {
  buildKeyTimes,
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
  /** Per-shell pattern; defaults to env PATTERN. */
  pattern: string;
  /** Per-shell SMIL duration (always positive when emitted). */
  dur: string;
  /** Per-shell spin count over the cycle. */
  spins: number;
  /** True when this shell rotates opposite to default (CCW becomes CW). */
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
    throw new Error(`Bad dur token "${tok}" — expected e.g. "18s" or "-12s"`);
  }
  return { dur: positive, reverse };
}

const shellArgs: string[] = (process as { argv: string[] }).argv.slice(2);
if (shellArgs.length === 0) {
  console.error(
    "Usage: gen-16-animated-axis.mts <count:rx:r[:dur[:pattern[:spins]]]> [...]",
  );
  console.error("Patterns: precess|wobble|nutate|tumble|nod|static");
  (process as { exit: (code: number) => never }).exit(1);
}

const env = (process as { env: Record<string, string | undefined> }).env;
const PATTERN = env.PATTERN ?? "precess";
const TILT_X_BASE = Number(env.TILT_X ?? 25);
const TILT_Z_BASE = Number(env.TILT_Z ?? 0);
const AMP = Number(env.AMP ?? 12);
const SPINS = Number(env.SPINS ?? 1);
const AXIS_CYCLES = Number(env.AXIS_CYCLES ?? 1);
const N_KF = Number(env.N_KF ?? 60);
const DUR = env.DUR ?? "18s";
const Lx = Number(env.LX ?? -0.9);
const Ly = Number(env.LY ?? 0.4);
const Lz = Number(env.LZ ?? 0.5);
const L_BASE = normalize([Lx, Ly, Lz]);

const LIGHT_ANIM = env.LIGHT_ANIM ?? "static";
const LIGHT_CYCLES = Number(env.LIGHT_CYCLES ?? 1);

// Light position over the cycle. `t` is shell-cycle fraction in [0, 1].
const LIGHT_PATTERNS: Record<string, (t: number) => [number, number, number]> = {
  static: (_t: number) => [L_BASE[0], L_BASE[1], L_BASE[2]],
  // Orbit: light circles around the Y axis (sun arcing). Holds Ly constant.
  orbit: (t: number) => {
    const ang = 2 * Math.PI * LIGHT_CYCLES * t;
    return normalize([Math.sin(ang), Ly, Math.cos(ang)]);
  },
  // Sway: light oscillates left-right across the front of the scene.
  sway: (t: number) => {
    const ang = 2 * Math.PI * LIGHT_CYCLES * t;
    return normalize([Math.sin(ang), Ly, Math.abs(Math.cos(ang)) * 0.7 + 0.3]);
  },
  // Arc: light traces a half-circle overhead (rises east, sets west).
  arc: (t: number) => {
    const ang = Math.PI * LIGHT_CYCLES * t; // 0..π for one pass
    return normalize([Math.cos(ang), Math.sin(ang), 0.4]);
  },
};
const lightAt = LIGHT_PATTERNS[LIGHT_ANIM];
if (!lightAt) {
  console.error(`Unknown LIGHT_ANIM "${LIGHT_ANIM}"`);
  console.error(`Valid: ${Object.keys(LIGHT_PATTERNS).join(", ")}`);
  (process as { exit: (code: number) => never }).exit(1);
}

const shells: ShellSpec[] = shellArgs.map((arg: string): ShellSpec => {
  const parts = arg.split(":");
  if (parts.length < 3 || parts.length > 6) {
    throw new Error(
      `Bad shell spec "${arg}" — expected count:rx:r[:dur[:pattern[:spins]]]`,
    );
  }
  const [cS, rxS, rS, durS, patS, spinsS] = parts;
  const count = Number(cS);
  const rx = Number(rxS);
  const r = Number(rS);
  if ([count, rx, r].some(Number.isNaN)) {
    throw new Error(`Bad numeric in shell spec "${arg}"`);
  }
  const { dur, reverse } = parseDur(durS, env.DUR ?? "18s");
  return {
    count,
    rx,
    r,
    pattern: patS || env.PATTERN || "precess",
    dur,
    spins: spinsS !== undefined && spinsS !== "" ? Number(spinsS) : SPINS,
    reverse,
  };
});

const PATTERNS: Record<string, (t: number) => Orientation> = {
  static: (_t: number) => orientationFromDegrees(TILT_X_BASE, TILT_Z_BASE),
  precess: (t: number) =>
    orientationFromDegrees(TILT_X_BASE, TILT_Z_BASE + 360 * AXIS_CYCLES * t),
  wobble: (t: number) =>
    orientationFromDegrees(
      TILT_X_BASE + AMP * Math.sin(2 * Math.PI * AXIS_CYCLES * t),
      TILT_Z_BASE,
    ),
  nutate: (t: number) =>
    orientationFromDegrees(
      TILT_X_BASE + AMP * Math.sin(2 * Math.PI * AXIS_CYCLES * 6 * t),
      TILT_Z_BASE + 360 * AXIS_CYCLES * t,
    ),
  tumble: (t: number) =>
    orientationFromDegrees(
      TILT_X_BASE + AMP * Math.cos(2 * Math.PI * AXIS_CYCLES * t),
      TILT_Z_BASE + 360 * AXIS_CYCLES * t,
    ),
  nod: (t: number) =>
    orientationFromDegrees(
      TILT_X_BASE + AMP * Math.sin(2 * Math.PI * AXIS_CYCLES * t),
      TILT_Z_BASE + AMP * Math.sin(2 * Math.PI * AXIS_CYCLES * 2 * t),
    ),
};

// Validate every shell's pattern up front.
for (const s of shells) {
  if (!PATTERNS[s.pattern]) {
    console.error(`Unknown pattern "${s.pattern}" in shell`);
    console.error(`Valid: ${Object.keys(PATTERNS).join(", ")}`);
    (process as { exit: (code: number) => never }).exit(1);
  }
}

const RX_OUTER = Math.max(...shells.map((s: ShellSpec) => s.rx));
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
  const orientAt = PATTERNS[shell.pattern]!;
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
      // World-frame light → shell body frame, since orient may animate per keyframe.
      const Lt = worldToBody(lightAt(t), orient);
      const f = frame(theta, sinL, cosL, shell.rx, shell.r, Lt, orient);
      paths.push(f.path);
      cxs.push(f.cxPct);
      cys.push(f.cyPct);
      ops.push(Math.max(0, f.culling).toFixed(3));
    }
    // Counter-rotation: reverse values arrays. Cycle endpoints are identical so no jump.
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

// Light icon: project the light position at each keyframe using the outer
// shell's orientation. If LIGHT_ANIM != static, we emit a SMIL animation of
// the icon's cx/cy so it moves visibly with the bake.
const outerShell = shells.reduce((a: ShellSpec, b: ShellSpec) =>
  a.rx >= b.rx ? a : b,
);
const outerOrientAt = PATTERNS[outerShell.pattern]!;
const lightIconKeys: [number, number][] = [];
for (let k = 0; k <= N_KF; k++) {
  const t = k / N_KF;
  const Lt = lightAt(t);
  lightIconKeys.push(
    project(Lt[0] * 300, Lt[1] * 300, Lt[2] * 300, outerOrientAt(t)),
  );
}
const lightProj = lightIconKeys[0]!;
const lightIconAnimated = LIGHT_ANIM !== "static";
const iconCxValues = lightIconKeys.map((p) => p[0].toFixed(2)).join("; ");
const iconCyValues = lightIconKeys.map((p) => p[1].toFixed(2)).join("; ");
const totalMarkers = shells.reduce((a: number, s: ShellSpec) => a + s.count, 0);
const shellSummary = shells
  .map(
    (s: ShellSpec) =>
      `${s.count}@rx=${s.rx}×r=${s.r} [${s.pattern} ×${s.spins} ${s.dur}]`,
  )
  .join(" + ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 280" width="800" height="280" role="img" aria-label="Animated-axis sphere — ${PATTERN}, ${shellSummary}">
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

  <text class="label" x="40" y="40">Experiment 16</text>
  <text class="title" x="40" y="70">Animated axis — ${PATTERN.toUpperCase()}</text>
  <text class="sub"   x="40" y="98">${totalMarkers} beads, ${shellSummary}. Base tilt (${TILT_X_BASE}°, ${TILT_Z_BASE}°), amp ${AMP}°, ${SPINS} spin(s) per cycle.</text>
  <text class="sub"   x="40" y="118">Spin axis itself is animated through the ${PATTERN} pattern over ${DUR}.</text>

  <g transform="translate(500 180)">
    <circle cx="${lightProj[0].toFixed(2)}" cy="${lightProj[1].toFixed(2)}" r="40" fill="url(#lightIcon)">${
      lightIconAnimated
        ? `<animate attributeName="cx" values="${iconCxValues}" keyTimes="${keyTimes}" dur="${outerShell.dur}" repeatCount="indefinite"/><animate attributeName="cy" values="${iconCyValues}" keyTimes="${keyTimes}" dur="${outerShell.dur}" repeatCount="indefinite"/>`
        : ""
    }</circle>
    <circle cx="${lightProj[0].toFixed(2)}" cy="${lightProj[1].toFixed(2)}" r="5" fill="#fffbeb">${
      lightIconAnimated
        ? `<animate attributeName="cx" values="${iconCxValues}" keyTimes="${keyTimes}" dur="${outerShell.dur}" repeatCount="indefinite"/><animate attributeName="cy" values="${iconCyValues}" keyTimes="${keyTimes}" dur="${outerShell.dur}" repeatCount="indefinite"/>`
        : ""
    }</circle>
    ${markerEls}
  </g>
</svg>`;

const shellTag = shells
  .map(
    (s: ShellSpec) =>
      `${s.count}x${s.rx}x${s.r}-${s.pattern}` +
      (s.dur !== "18s" || s.reverse ? `@${s.reverse ? "-" : ""}${s.dur}` : "") +
      (s.spins !== 1 ? `x${s.spins}` : ""),
  )
  .join("_");
const lightTag = LIGHT_ANIM !== "static" ? `_light-${LIGHT_ANIM}` : "";
const outPath = resolve(
  projectRoot,
  `public/banner-experiments/16-axis-${shellTag}${lightTag}.svg`,
);
writeFileSync(outPath, svg);
console.log(
  `Wrote ${(svg.length / 1024).toFixed(1)} KB → ${outPath}\n  pattern=${PATTERN} spins=${SPINS} axisCycles=${AXIS_CYCLES} amp=${AMP}°`,
);
