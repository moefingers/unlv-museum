/**
 * Generates experiment 15 — multiple nested spheres ("shells"), each with its
 * own marker count, orbit radius, and bead size. All shells share the same
 * tilt + camera; markers from all shells are z-sorted together so the
 * stacking order respects perspective depth at the start frame.
 *
 * Usage:
 *   pnpm tsx scripts/banner-experiments/gen-15-multi-shell.mts <shell> [<shell>...]
 *
 * Each <shell> is a colon-separated spec "count:rx:r[:dur[:tiltXdeg[:tiltZdeg]]]":
 *   count    = number of beads on this shell
 *   rx       = sphere radius (orbit radius)
 *   r        = bead radius in 3D world units
 *   dur      = (optional) rotation period, e.g. "18s". "-12s" reverses direction.
 *              Defaults to env DUR or "18s".
 *   tiltXdeg = (optional) static tilt around world X in degrees (default ~17.6).
 *   tiltZdeg = (optional) static tilt around world Z in degrees (default 0).
 *              Y is the per-shell spin axis (after tilts).
 *
 * Examples:
 *   # All shells share the default 18s rotation
 *   pnpm tsx scripts/banner-experiments/gen-15-multi-shell.mts 300:140:9 150:100:6
 *
 *   # Outer slow (24s), inner fast (8s)
 *   pnpm tsx scripts/banner-experiments/gen-15-multi-shell.mts 300:140:9:24s 150:50:6:8s
 *
 *   # Inner counter-rotating (negative dur)
 *   pnpm tsx scripts/banner-experiments/gen-15-multi-shell.mts 300:140:9:18s 150:50:6:-12s
 *
 * Optional env vars:
 *   LX, LY, LZ — light direction components (default -0.4, 1, 0.5; auto-normalized)
 *   DUR        — default SMIL duration when shell omits one (default "18s")
 *
 * Output filename encodes every shell so multiple variants coexist:
 *   public/banner-experiments/15-multi-300x140x9_150x100x6.svg
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import {
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
  /** SMIL duration string (always positive when emitted). */
  dur: string;
  /** True when this shell rotates opposite to the default direction. */
  reverse: boolean;
  /** Static orientation: tilt-X then tilt-Z. Defaults to (DEFAULT_TILT_X, 0). */
  orient: Orientation;
}

const shellArgs: string[] = (process as { argv: string[] }).argv.slice(2);
if (shellArgs.length === 0) {
  console.error(
    "Usage: gen-15-multi-shell.mts <count:rx:r[:dur]> [<count:rx:r[:dur]> ...]",
  );
  console.error(
    "Example: gen-15-multi-shell.mts 300:140:9:18s 150:50:6:-12s",
  );
  (process as { exit: (code: number) => never }).exit(1);
}

const DEFAULT_DUR: string =
  (process as { env: Record<string, string | undefined> }).env.DUR ?? "18s";

/** Parse a dur token; leading "-" reverses direction, returns positive SMIL dur. */
function parseDur(tok: string | undefined): { dur: string; reverse: boolean } {
  if (!tok) return { dur: DEFAULT_DUR, reverse: false };
  const reverse = tok.startsWith("-");
  const positive = reverse ? tok.slice(1) : tok;
  // Validate: number optionally followed by SMIL clock-value unit
  if (!/^[0-9.]+(ms|s|min|h)?$/.test(positive)) {
    throw new Error(`Bad dur token "${tok}" — expected e.g. "18s" or "-12s"`);
  }
  return { dur: positive, reverse };
}

const DEFAULT_TILT_X_DEG = (DEFAULT_TILT_X * 180) / Math.PI;

const shells: ShellSpec[] = shellArgs.map((arg: string): ShellSpec => {
  const parts = arg.split(":");
  if (parts.length < 3 || parts.length > 6) {
    throw new Error(
      `Bad shell spec "${arg}" — expected count:rx:r[:dur[:tiltXdeg[:tiltZdeg]]]`,
    );
  }
  const [countS, rxS, rS, durS, tiltXS, tiltZS] = parts;
  const count = Number(countS);
  const rx = Number(rxS);
  const r = Number(rS);
  if ([count, rx, r].some(Number.isNaN)) {
    throw new Error(`Bad numeric in shell spec "${arg}"`);
  }
  const { dur, reverse } = parseDur(durS);
  const tiltXdeg = tiltXS === undefined ? DEFAULT_TILT_X_DEG : Number(tiltXS);
  const tiltZdeg = tiltZS === undefined ? 0 : Number(tiltZS);
  if (Number.isNaN(tiltXdeg) || Number.isNaN(tiltZdeg)) {
    throw new Error(`Bad tilt in shell spec "${arg}"`);
  }
  return {
    count,
    rx,
    r,
    dur,
    reverse,
    orient: orientationFromDegrees(tiltXdeg, tiltZdeg),
  };
});

const N_KF = 60;
const Lx = Number(process.env.LX ?? -0.4);
const Ly = Number(process.env.LY ?? 1.0);
const Lz = Number(process.env.LZ ?? 0.5);
const L = normalize([Lx, Ly, Lz]);

// Tilt is now per-shell. Scene just provides the camera distance for perspective;
// the outer shell's rx sets a reasonable D = 4×RX_OUTER.
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
  /** SMIL `dur` for this marker's animations (positive only). */
  dur: string;
}

const markers: Marker[] = [];
let globalIdx = 0;

for (const shell of shells) {
  // Transform world-frame light into this shell's body frame so frame()
  // (which works in body frame) sees the correct relative direction.
  const Lbody = worldToBody(L, shell.orient);
  for (const { lat, lon } of fibonacciSphere(shell.count)) {
    const sinL = Math.sin(lat);
    const cosL = Math.cos(lat);
    const paths: string[] = [];
    const ops: string[] = [];
    const cxs: string[] = [];
    const cys: string[] = [];
    for (let k = 0; k <= N_KF; k++) {
      const theta = lon + (k / N_KF) * 2 * Math.PI;
      const f = frame(theta, sinL, cosL, shell.rx, shell.r, Lbody, shell.orient);
      paths.push(f.path);
      cxs.push(f.cxPct);
      cys.push(f.cyPct);
      ops.push(Math.max(0, f.culling).toFixed(3));
    }
    // Initial 3D depth used for z-sorting within a shell at frame 0.
    const sinX = Math.sin(shell.orient.tiltX);
    const cosX = Math.cos(shell.orient.tiltX);
    // Counter-rotation: keep keyTimes ascending but reverse the values arrays.
    // The 0th and Nth keyframes are identical (cycle endpoints) so reversing
    // doesn't cause a discontinuous jump.
    if (shell.reverse) {
      paths.reverse();
      ops.reverse();
      cxs.reverse();
      cys.reverse();
    }
    const hue = ((lat / Math.PI) + 0.5) * 360;
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
        shell.rx * cosL * Math.cos(lon) * cosX + shell.rx * sinL * sinX,
      shellRx: shell.rx,
      dur: shell.dur,
    });
  }
}

// Render in shell-radius order: smaller shells (inner) draw first → outer
// always overlaps inner. Within each shell, deeper markers first so closer
// ones paint on top at the start frame.
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

// Project the light icon using the OUTER shell's orientation so it appears
// consistent with the majority of beads. Per-shell light position would
// require per-shell light icons; for now one light is shared by all shells.
const outerShell = shells.reduce((best: ShellSpec, s: ShellSpec) =>
  s.rx > best.rx ? s : best,
);
const lightProj = project(
  L[0] * 300,
  L[1] * 300,
  L[2] * 300,
  outerShell.orient,
);

const fmtTilt = (s: ShellSpec) => {
  const tXdeg = (s.orient.tiltX * 180) / Math.PI;
  const tZdeg = (s.orient.tiltZ * 180) / Math.PI;
  const isDefaultX = Math.abs(tXdeg - DEFAULT_TILT_X_DEG) < 0.01;
  const isDefaultZ = Math.abs(tZdeg) < 0.01;
  if (isDefaultX && isDefaultZ) return "";
  return ` tilt(X=${tXdeg.toFixed(0)}°,Z=${tZdeg.toFixed(0)}°)`;
};
const shellSummary = shells
  .map(
    (s: ShellSpec) =>
      `${s.count}@rx=${s.rx}×r=${s.r} ${s.reverse ? "←" : "→"}${s.dur}${fmtTilt(s)}`,
  )
  .join("  +  ");
const totalMarkers = shells.reduce((a: number, s: ShellSpec) => a + s.count, 0);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 280" width="800" height="280" role="img" aria-label="Multi-shell sphere experiment: ${shellSummary}">
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

  <text class="label" x="40" y="40">Experiment 15</text>
  <text class="title" x="40" y="70">Multi-shell sphere — ${shellSummary}</text>
  <text class="sub"   x="40" y="98">${totalMarkers} beads across ${shells.length} concentric shells, z-sorted on the start frame.</text>
  <text class="sub"   x="40" y="118">Light L=(${Lx},${Ly},${Lz}); each bead's gradient cx/cy tracks the projected highlight per keyframe.</text>

  <g transform="translate(500 180)">
    <circle cx="${lightProj[0].toFixed(2)}" cy="${lightProj[1].toFixed(2)}" r="40" fill="url(#lightIcon)"/>
    <circle cx="${lightProj[0].toFixed(2)}" cy="${lightProj[1].toFixed(2)}" r="5" fill="#fffbeb"/>
    ${markerEls}
  </g>
</svg>`;

const shellTag = shells
  .map((s: ShellSpec) => {
    const base = `${s.count}x${s.rx}x${s.r}`;
    const durPart =
      s.dur !== DEFAULT_DUR || s.reverse
        ? `@${s.reverse ? "-" : ""}${s.dur}`
        : "";
    const tXdeg = (s.orient.tiltX * 180) / Math.PI;
    const tZdeg = (s.orient.tiltZ * 180) / Math.PI;
    const tiltPart =
      Math.abs(tXdeg - DEFAULT_TILT_X_DEG) >= 0.01 || Math.abs(tZdeg) >= 0.01
        ? `_tX${tXdeg.toFixed(0)}_tZ${tZdeg.toFixed(0)}`
        : "";
    return base + durPart + tiltPart;
  })
  .join("_");
const outPath = resolve(
  projectRoot,
  `public/banner-experiments/15-multi-${shellTag}.svg`,
);
writeFileSync(outPath, svg);
console.log(
  `Wrote ${(svg.length / 1024).toFixed(1)} KB → ${outPath}\n  (${totalMarkers} markers: ${shellSummary})`,
);
