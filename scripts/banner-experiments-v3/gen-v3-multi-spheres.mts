/**
 * v3 — 3 nested spheres with independent rotations, exact per-bead lighting.
 *
 * Lessons distilled from v1 / v2:
 *
 *   1. The lighting bug from v1 was that L_world wasn't recomputed correctly
 *      for each bead's CURRENT camera-frame position when the axis was
 *      animating. The fix is to recompute everything per-bead per-keyframe in
 *      the SHELL'S CURRENT orient at that moment, then derive L from the
 *      bead's current world (= camera-frame) position. Never assume L is
 *      shared across beads (it's not, for point light) and never assume L is
 *      constant in time (it's not, when the bead is moving).
 *
 *   2. Sphere primitives (animateMotion, animateTransform rotate) are great
 *      for the simple pure-Z-rotation case but break down for the compound
 *      rotations we actually want. Exact baking is the only thing that holds
 *      together when we mix axis animation, theta-walk, point-light, and
 *      three independent shells. Accept the file size.
 *
 *   3. Lambert mask: when a bead's outward normal points away from L,
 *      push the gradient cx/cy off-bbox so the highlight fades cleanly
 *      through the terminator instead of jumping to the back of the bead.
 *
 *   4. Face-culling opacity uses the bead's outward normal in the CURRENT
 *      camera frame (not body frame) — z-component after orient is applied.
 *
 *   5. Each shell can have its own dur, so independent rotation speeds are
 *      built-in. Each animation chain on a bead uses that shell's dur.
 *
 *   6. Z-sort is static at t=0 (SMIL has no dynamic reorder). We sort by
 *      shellRx first (so smaller shells render on top of larger), then by
 *      initial depth within shell.
 *
 * Shell spec format: count:rx:r[:dur[:pattern[:spins]]]
 *   pattern ∈ { static, precess, wobble, nutate, tumble }
 *   spins  = number of theta-walk revolutions per cycle (negative = reverse)
 *
 * Usage:
 *   pnpm tsx scripts/banner-experiments-v3/gen-v3-multi-spheres.mts \
 *     [shell1] [shell2] [shell3] ...
 *
 * Default: 3 shells with distinct rotation patterns.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

const N_KF = 60;
const env = process.env;
const TILT_X_BASE_DEG = Number(env.TILT_X ?? 25);
const TILT_X_BASE = (TILT_X_BASE_DEG * Math.PI) / 180;
const AMP_DEG = Number(env.AMP ?? 18);
const AMP_RAD = (AMP_DEG * Math.PI) / 180;
const AXIS_CYCLES = Number(env.AXIS_CYCLES ?? 1);
const BEAD_BC = 0.5522847498;
const OFF_BBOX = 200;

// World-frame point-light position. Upper-front-left by default.
const DEFAULT_P: [number, number, number] = [-110, 130, 280];
const P_LIGHT: [number, number, number] = [
  Number(env.LX ?? DEFAULT_P[0]),
  Number(env.LY ?? DEFAULT_P[1]),
  Number(env.LZ ?? DEFAULT_P[2]),
];

interface ShellSpec {
  count: number;
  rx: number;
  r: number;
  pattern: "static" | "precess" | "wobble" | "nutate" | "tumble";
  spins: number;
  dur: string;
}

function parseShell(s: string): ShellSpec {
  const parts = s.split(":");
  if (parts.length < 3 || parts.length > 6) {
    throw new Error(`Bad shell "${s}" — expected count:rx:r[:dur[:pattern[:spins]]]`);
  }
  const count = Number(parts[0]);
  const rx = Number(parts[1]);
  const r = Number(parts[2]);
  const dur = parts[3] || "18s";
  const pattern = (parts[4] || "static") as ShellSpec["pattern"];
  const spins = parts[5] !== undefined && parts[5] !== "" ? Number(parts[5]) : 0;
  if ([count, rx, r, spins].some(Number.isNaN)) {
    throw new Error(`Bad numeric in shell "${s}"`);
  }
  if (!["static", "precess", "wobble", "nutate", "tumble"].includes(pattern)) {
    throw new Error(`Bad pattern "${pattern}" in shell "${s}"`);
  }
  return { count, rx, r, pattern, spins, dur };
}

const DEFAULT_SHELLS: string[] = [
  // count, rx, r, dur, pattern, spins
  "300:140:9:18s:static:1",   // outer: globe spin forward
  "150:80:6:24s:static:-1",   // middle: globe spin reversed, slower
  "60:35:4:12s:precess:0",    // inner: axis precess, no theta walk
];

const args = process.argv.slice(2);
const shellArgs = args.length > 0 ? args : DEFAULT_SHELLS;
const shells = shellArgs.map(parseShell);

const RX_OUTER = Math.max(...shells.map((s) => s.rx));
const D = 4 * RX_OUTER;

interface Orient {
  tiltX: number;
  tiltZ: number;
}

function orientAt(pattern: ShellSpec["pattern"], t: number): Orient {
  const w = 2 * Math.PI * AXIS_CYCLES * t;
  switch (pattern) {
    case "static":
      return { tiltX: TILT_X_BASE, tiltZ: 0 };
    case "precess":
      return { tiltX: TILT_X_BASE, tiltZ: w };
    case "wobble":
      return { tiltX: TILT_X_BASE + AMP_RAD * Math.sin(w), tiltZ: 0 };
    case "nutate":
      return {
        tiltX: TILT_X_BASE + AMP_RAD * Math.sin(6 * w),
        tiltZ: w,
      };
    case "tumble":
      return {
        tiltX: TILT_X_BASE + AMP_RAD * Math.cos(w),
        tiltZ: w,
      };
  }
}

function bodyToCamera(
  x: number,
  y: number,
  z: number,
  o: Orient,
): [number, number, number] {
  const cosX = Math.cos(o.tiltX);
  const sinX = Math.sin(o.tiltX);
  const cosZ = Math.cos(o.tiltZ);
  const sinZ = Math.sin(o.tiltZ);
  const y1 = y * cosX - z * sinX;
  const z1 = y * sinX + z * cosX;
  const x2 = x * cosZ - y1 * sinZ;
  const y2 = x * sinZ + y1 * cosZ;
  return [x2, y2, z1];
}

function perspective(x: number, y: number, z: number): {
  x: number;
  y: number;
  s: number;
} {
  const s = D / (D - z);
  return { x: x * s, y: -y * s, s };
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

interface Bead {
  initZ: number;
  shellRx: number;
  paths: string[];
  ops: string[];
  cxs: string[];
  cys: string[];
  gradId: string;
  hue: number;
  dur: string;
}

const keyTimes = buildKeyTimes(N_KF);
const beads: Bead[] = [];
let globalIdx = 0;

for (const shell of shells) {
  const samples = fibonacciSphere(shell.count);
  for (const { lat, lon } of samples) {
    const sinLat = Math.sin(lat);
    const cosLat = Math.cos(lat);

    const paths: string[] = [];
    const ops: string[] = [];
    const cxs: string[] = [];
    const cys: string[] = [];

    for (let k = 0; k <= N_KF; k++) {
      const t = k / N_KF;
      const orient = orientAt(shell.pattern, t);
      const theta = lon + shell.spins * t * 2 * Math.PI;
      const st = Math.sin(theta);
      const ct = Math.cos(theta);
      const cx3 = shell.rx * cosLat * st;
      const cy3 = shell.rx * sinLat;
      const cz3 = shell.rx * cosLat * ct;

      // Body-frame tangent basis at this point on the sphere surface.
      const right: [number, number, number] = [ct, 0, -st];
      const up: [number, number, number] = [-sinLat * st, cosLat, -sinLat * ct];

      // 12 bezier control points in body frame.
      const anchor = (sR: number, sU: number): [number, number, number] => [
        cx3 + shell.r * sR * right[0] + shell.r * sU * up[0],
        cy3 + shell.r * sR * right[1] + shell.r * sU * up[1],
        cz3 + shell.r * sR * right[2] + shell.r * sU * up[2],
      ];
      const handle = (
        p: [number, number, number],
        v: [number, number, number],
        sg: number,
      ): [number, number, number] => [
        p[0] + sg * BEAD_BC * shell.r * v[0],
        p[1] + sg * BEAD_BC * shell.r * v[1],
        p[2] + sg * BEAD_BC * shell.r * v[2],
      ];
      const P0 = anchor(+1, 0);
      const P1 = anchor(0, +1);
      const P2 = anchor(-1, 0);
      const P3 = anchor(0, -1);
      const A0 = handle(P0, up, +1);
      const B0 = handle(P1, right, +1);
      const A1 = handle(P1, right, -1);
      const B1 = handle(P2, up, +1);
      const A2 = handle(P2, up, -1);
      const B2 = handle(P3, right, -1);
      const A3 = handle(P3, right, +1);
      const B3 = handle(P0, up, -1);

      // Project all 12 through orient + perspective.
      const pts = [P0, A0, B0, P1, A1, B1, P2, A2, B2, P3, A3, B3].map((p) => {
        const cam = bodyToCamera(p[0], p[1], p[2], orient);
        return perspective(cam[0], cam[1], cam[2]);
      });
      let minX = pts[0]!.x;
      let maxX = pts[0]!.x;
      let minY = pts[0]!.y;
      let maxY = pts[0]!.y;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const f = (i: number) =>
        `${pts[i]!.x.toFixed(2)},${pts[i]!.y.toFixed(2)}`;
      const path = `M${f(0)} C${f(1)} ${f(2)} ${f(3)} C${f(4)} ${f(5)} ${f(6)} C${f(7)} ${f(8)} ${f(9)} C${f(10)} ${f(11)} ${f(0)} Z`;

      // Bead center in current camera frame (= world frame here).
      const cCam = bodyToCamera(cx3, cy3, cz3, orient);
      // Outward normal in current camera frame.
      const nCam = bodyToCamera(cosLat * st, sinLat, cosLat * ct, orient);
      const culling = nCam[2];

      // Point light direction in camera frame.
      const dx = P_LIGHT[0] - cCam[0];
      const dy = P_LIGHT[1] - cCam[1];
      const dz = P_LIGHT[2] - cCam[2];
      const dm = Math.hypot(dx, dy, dz);
      const Lx = dx / dm;
      const Ly = dy / dm;
      const Lz = dz / dm;

      // Lambert visibility mask. The previous formula used `max(0, litDot)`
      // and linearly mixed cx/cy toward OFF_BBOX by (1 − litDot), which
      // catastrophically failed for partially-lit beads: a bead with
      // litDot=0.22 and correct cxLit=27% ended up at cxPct = 0.22·27 +
      // 0.78·200 = 162%, dragging the gradient center *past the opposite
      // side of the bbox* and making the visible bright spot appear on the
      // side AWAY from the light. Use a near-step instead: keep the
      // gradient at its correct lit position for any bead whose center
      // normal points toward the light at all, and only fade off-bbox
      // through a narrow terminator zone.
      const litDot = nCam[0] * Lx + nCam[1] * Ly + nCam[2] * Lz;
      const litFactor = Math.max(0, Math.min(1, (litDot + 0.05) * 8));

      // Compute the highlight as a 2D offset from the bead's projected
      // CENTER, using the BEAD'S OWN perspective scale (not the scale at the
      // highlight's depth). Projecting the 3D point `cCam + r·L` separately
      // can flip the apparent direction for off-center beads — perspective
      // magnifies the closer highlight point more than the bead, so e.g. a
      // left-silhouette bead with light to its right gets its highlight
      // projected even further left than its center. Using the bead's scale
      // uniformly keeps the highlight on the right side of the bead in 2D.
      const beadProj = perspective(cCam[0], cCam[1], cCam[2]);
      const hp = {
        x: beadProj.x + shell.r * Lx * beadProj.s,
        y: beadProj.y - shell.r * Ly * beadProj.s, // SVG y-flip
      };
      const bbW = Math.max(0.01, maxX - minX);
      const bbH = Math.max(0.01, maxY - minY);
      const cxLit = ((hp.x - minX) / bbW) * 100;
      const cyLit = ((hp.y - minY) / bbH) * 100;
      const cxPct = cxLit * litFactor + OFF_BBOX * (1 - litFactor);
      const cyPct = cyLit * litFactor + OFF_BBOX * (1 - litFactor);

      paths.push(path);
      cxs.push(cxPct.toFixed(1));
      cys.push(cyPct.toFixed(1));
      ops.push(Math.max(0, culling).toFixed(3));
    }

    const orient0 = orientAt(shell.pattern, 0);
    const cam0 = bodyToCamera(
      shell.rx * cosLat * Math.sin(lon),
      shell.rx * sinLat,
      shell.rx * cosLat * Math.cos(lon),
      orient0,
    );
    const hue = ((lat / Math.PI) + 0.5) * 360;

    beads.push({
      initZ: cam0[2],
      shellRx: shell.rx,
      paths,
      ops,
      cxs,
      cys,
      gradId: `b${globalIdx++}`,
      hue,
      dur: shell.dur,
    });
  }
}

// Larger shells render on top of smaller ones; within a shell, back-to-front.
beads.sort((a, b) => a.shellRx - b.shellRx || a.initZ - b.initZ);

const iconProj = perspective(P_LIGHT[0], P_LIGHT[1], P_LIGHT[2]);

const gradients = beads
  .map(
    (b) =>
      `<radialGradient id="${b.gradId}" cx="${b.cxs[0]}%" cy="${b.cys[0]}%" r="75%"><stop offset="0%" stop-color="hsl(${b.hue.toFixed(0)},80%,88%)"/><stop offset="55%" stop-color="hsl(${b.hue.toFixed(0)},75%,45%)"/><stop offset="100%" stop-color="hsl(${b.hue.toFixed(0)},85%,10%)"/><animate attributeName="cx" values="${b.cxs.join("%; ")}%" keyTimes="${keyTimes}" dur="${b.dur}" repeatCount="indefinite"/><animate attributeName="cy" values="${b.cys.join("%; ")}%" keyTimes="${keyTimes}" dur="${b.dur}" repeatCount="indefinite"/></radialGradient>`,
  )
  .join("\n    ");

const beadEls = beads
  .map(
    (b) =>
      `<path fill="url(#${b.gradId})" d="${b.paths[0]}"><animate attributeName="d" values="${b.paths.join("; ")}" keyTimes="${keyTimes}" dur="${b.dur}" repeatCount="indefinite"/><animate attributeName="opacity" values="${b.ops.join("; ")}" keyTimes="${keyTimes}" dur="${b.dur}" repeatCount="indefinite"/></path>`,
  )
  .join("\n    ");

const summary = shells
  .map(
    (s, i) =>
      `${i + 1}: ${s.count}@rx=${s.rx} ${s.pattern}${s.spins !== 0 ? `×${s.spins}` : ""} ${s.dur}`,
  )
  .join("  ·  ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 320" width="800" height="320" role="img" aria-label="v3 multi-sphere — ${summary}">
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
      .sub { font: 500 12px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #737373; }
    </style>
  </defs>

  <rect class="bg" width="800" height="320"/>

  <text class="label" x="40" y="40">v3</text>
  <text class="title" x="40" y="68">3 spheres · per-bead L in current frame · point light</text>
  <text class="sub"   x="40" y="92">${summary}</text>

  <g transform="translate(500 200)">
    ${beadEls}
    <circle cx="${iconProj.x.toFixed(2)}" cy="${iconProj.y.toFixed(2)}" r="${(40 * iconProj.s).toFixed(2)}" fill="url(#lightIcon)"/>
    <circle cx="${iconProj.x.toFixed(2)}" cy="${iconProj.y.toFixed(2)}" r="${(5 * iconProj.s).toFixed(2)}" fill="#fffbeb"/>
  </g>
</svg>`;

const tag = shells
  .map(
    (s) =>
      `${s.count}x${s.rx}x${s.r}-${s.pattern}` +
      (s.spins !== 0 ? `x${s.spins}` : "") +
      (s.dur !== "18s" ? `@${s.dur}` : ""),
  )
  .join("_");
const outPath = resolve(
  projectRoot,
  `public/banner-experiments-v3/v3-${tag}.svg`,
);
writeFileSync(outPath, svg);
console.log(
  `Wrote ${(svg.length / 1024).toFixed(1)} KB → ${outPath}\n  ${summary}`,
);
