/**
 * scripts/build-readme-card.ts — the museum README's hero card.
 *
 * An animated SVG recreation of the museum's social card
 * (public/og/stage-poster.png), zoomed out into the profile banners'
 * shape (see "README framing"): the landing globe's anchored "stage
 * view" — the BreathingMesh lattice, the upper arc of the icosphere,
 * a projection cone rising from a vertex, and the "UNLV Museum" hex
 * card unfolding above it — played through the real anchor
 * choreography and looped:
 *
 *   open (anchored auto-rotate) → collapsing → coneFalling
 *   → swinging → coneRising → widening → open → …
 *
 * Writes two theme-pinned files for a README <picture>:
 *
 *   .github/readme/museum-card-dark.svg
 *   .github/readme/museum-card-light.svg
 *
 * GitHub shows README SVGs as <img> through camo, so the output is
 * self-contained: no <script>, no external references, no web fonts.
 * Animation is SMIL only (it runs inside <img>). Text is converted to
 * glyph outlines at build time (see "Hex card: typography").
 *
 * Sources of truth, and how each is used:
 *   - Geometry, projection, quaternions, springs, stage polygons:
 *     imported from src/lib (polyhedra, quaternion, spring,
 *     polygon-vertices).
 *   - Phase timings: imported from src/hooks/use-anchor-phase.
 *   - Graphics toggles: the "high" preset from src/hooks/use-graphics
 *     (what the OG was recorded with: edge glow, face shading, ...).
 *   - Vertex → category: src/lib/projects PROJECTS, in the landing
 *     view's default (category) order.
 *   - Colors: the --glass-* / --cone-* / --category-* / --glow-*
 *     tokens parsed out of src/app/globals.css (light :root + .dark),
 *     resolved to sRGB here, including oklch(from …) relative syntax.
 *   - Module-private tuning constants (hex ratios, cone angle, camera,
 *     auto-rotate speed, BreathingMesh lattice, billboard cascade
 *     delays) are read straight out of the component sources by name,
 *     so retuning a component retunes the card. A rename fails the
 *     build loudly instead of silently drifting.
 *   - JSX/CSS literals with no name (stroke widths, gradient stops,
 *     shading formulas, card typography) are mirrored below with the
 *     file they come from.
 *
 * Spring motion (the hex unfold/collapse cascade) is simulated with
 * the real spring integrator at 60 Hz and baked into keyframes; it is
 * never approximated by an easing curve. Where the real code uses a
 * CSS easing (cone scale, card rise, content fade), the same cubic
 * Bézier is emitted as a SMIL keySpline. The swing slerp's
 * easeInOutCubic is a cubic per half, which a keySpline expresses
 * exactly once the halves are split.
 *
 * Usage: pnpm build:readme-card
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as fontkit from "fontkit";
// @ts-expect-error - wawoff2 has no types
import wawoff2 from "wawoff2";
import { geodesic } from "../src/lib/polyhedra";
import {
  fromAxisAngle,
  fromUnitVectors,
  multiply as quatMultiply,
  slerp as quatSlerp,
  toMatrix3,
  type Quat,
} from "../src/lib/quaternion";
import { makeSpring, stepSpring } from "../src/lib/spring";
import { FINAL_STAGE, unfoldStageVertices } from "../src/lib/polygon-vertices";
import {
  ANCHOR_SWING_MS,
  COLLAPSING_MS,
  CONE_FALL_MS,
  CONE_RISE_MS,
  CONE_WIDEN_FRACTION,
  WIDENING_MS,
} from "../src/hooks/use-anchor-phase";
import { PRESET_DEFINITIONS } from "../src/hooks/use-graphics";
import { PROJECTS, type Category } from "../src/lib/projects";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(projectRoot, ".github/readme");

// ═══ Reading tuning out of the component sources ═══════════════════

const GLOBE_SRC = "src/components/ui/PolyhedronGlobe.tsx";
const ANCHOR_SRC = "src/hooks/use-anchor-phase.ts";
const AUTO_ROTATE_SRC = "src/hooks/use-auto-rotate.ts";
const LANDING_SRC = "src/components/ui/LandingView.tsx";
const BILLBOARD_SRC = "src/components/ui/UnfoldingBillboard.tsx";
const BILLBOARD_CSS = "src/components/ui/UnfoldingBillboard.module.css";
const MESH_SRC = "src/components/ui/BreathingMesh.tsx";
const GLOBALS_CSS = "src/app/globals.css";

const sourceCache = new Map<string, string>();
function source(rel: string): string {
  let text = sourceCache.get(rel);
  if (text === undefined) {
    text = readFileSync(resolve(projectRoot, rel), "utf8");
    sourceCache.set(rel, text);
  }
  return text;
}

function sourceMatch(rel: string, re: RegExp, what: string): RegExpMatchArray {
  const m = source(rel).match(re);
  if (!m) {
    throw new Error(
      `${rel}: couldn't find ${what} (${re}). It moved or was renamed; update scripts/build-readme-card.ts to match.`,
    );
  }
  return m;
}

/** `const NAME = <number>;` (optionally exported) from a source file. */
function sourceConst(rel: string, name: string): number {
  const m = sourceMatch(
    rel,
    new RegExp(`\\bconst ${name}\\s*=\\s*(-?\\d*\\.?\\d+)\\s*;`),
    `\`const ${name} = <number>;\``,
  );
  return Number(m[1]);
}

/**
 * Evaluates a constant arithmetic expression from source (numbers,
 * + - * /, parentheses, Math.PI). Used for AUTO_ANGULAR_SPEED, which
 * is written as a unit conversion rather than a literal.
 */
function evalArithmetic(expr: string): number {
  const s = expr.replace(/Math\.PI/g, `(${Math.PI})`).replace(/\s+/g, "");
  let i = 0;
  const fail = (): never => {
    throw new Error(`can't evaluate constant expression: ${expr}`);
  };
  const parseExpr = (): number => {
    let v = parseTerm();
    while (s[i] === "+" || s[i] === "-") {
      const op = s[i++];
      const rhs = parseTerm();
      v = op === "+" ? v + rhs : v - rhs;
    }
    return v;
  };
  const parseTerm = (): number => {
    let v = parseFactor();
    while (s[i] === "*" || s[i] === "/") {
      const op = s[i++];
      const rhs = parseFactor();
      v = op === "*" ? v * rhs : v / rhs;
    }
    return v;
  };
  const parseFactor = (): number => {
    if (s[i] === "-") {
      i++;
      return -parseFactor();
    }
    if (s[i] === "(") {
      i++;
      const v = parseExpr();
      if (s[i++] !== ")") fail();
      return v;
    }
    const m = /^\d*\.?\d+(?:e[-+]?\d+)?/i.exec(s.slice(i));
    if (!m) return fail();
    i += m[0].length;
    return Number(m[0]);
  };
  const v = parseExpr();
  if (i !== s.length) fail();
  return v;
}

// ─── Globe + anchor (PolyhedronGlobe, use-anchor-phase, LandingView) ──
const SPHERE_RADIUS = sourceConst(LANDING_SRC, "SPHERE_BASE_RADIUS");
const FREQUENCY = Number(
  sourceMatch(
    GLOBE_SRC,
    /\bfrequency = (\d+),/,
    "the frequency prop default",
  )[1],
);
const CAMERA_Z = sourceConst(GLOBE_SRC, "cameraZ");
const AXIAL_TILT_DEG = sourceConst(GLOBE_SRC, "AXIAL_TILT_DEG");
if (sourceConst(ANCHOR_SRC, "AXIAL_TILT_DEG") !== AXIAL_TILT_DEG) {
  throw new Error(
    "AXIAL_TILT_DEG differs between PolyhedronGlobe and use-anchor-phase",
  );
}
const ANCHOR_NDC_Y = sourceConst(ANCHOR_SRC, "ANCHOR_NDC_Y");
// The landing view's wide-viewport anchor X (the OG was recorded on a
// 1920px-wide viewport, past the 1200px threshold).
const ANCHOR_NDC_X = sourceConst(LANDING_SRC, "NDC_X_DESKTOP");
const HEX_RADIUS_RATIO = sourceConst(GLOBE_SRC, "HEX_RADIUS_RATIO");
const HEX_OFFSET_RATIO = sourceConst(GLOBE_SRC, "HEX_OFFSET_RATIO");
const CONE_HALF_ANGLE_DEG = sourceConst(GLOBE_SRC, "CONE_HALF_ANGLE_DEG");
const ANCHOR_AUTO_SPEED_MUL = sourceConst(GLOBE_SRC, "ANCHOR_AUTO_SPEED_MUL");
const ANCHOR_ZOOM_SCALE = sourceConst(GLOBE_SRC, "ANCHOR_ZOOM_SCALE");
const DOT_GLOW_RADIUS = sourceConst(GLOBE_SRC, "HOVER_DOT_IDLE_GLOW");
const AUTO_ANGULAR_SPEED = evalArithmetic(
  sourceMatch(
    AUTO_ROTATE_SRC,
    /const AUTO_ANGULAR_SPEED = ([^;]+);/,
    "AUTO_ANGULAR_SPEED",
  )[1]!,
); // rad/s
const BILLBOARD_STAGE_DELAY = Number(
  sourceMatch(
    GLOBE_SRC,
    /stageDelay=\{(\d+)\}/,
    "the billboard's stageDelay prop",
  )[1],
);
const billboardSpring = sourceMatch(
  GLOBE_SRC,
  /spring=\{\{\s*stiffness:\s*([\d.]+),\s*damping:\s*([\d.]+)\s*\}\}/,
  "the billboard's spring prop",
);
const BILLBOARD_SPRING = {
  stiffness: Number(billboardSpring[1]),
  damping: Number(billboardSpring[2]),
};

// ─── UnfoldingBillboard (+ its CSS module) ────────────────────────────
const TOPOLOGY_COUNT = sourceConst(BILLBOARD_SRC, "TOPOLOGY_COUNT");
const FRAME_TIMESTEP_CAP = sourceConst(BILLBOARD_SRC, "FRAME_TIMESTEP_CAP");
const CONTENT_BOX_RATIO = Number(
  sourceMatch(
    BILLBOARD_SRC,
    /width: radius \* ([\d.]+)/,
    "the content layer size ratio",
  )[1],
);
const reverseDelayMatch = sourceMatch(
  BILLBOARD_SRC,
  /Math\.max\(stageDelay \* ([\d.]+), (\d+)\)/,
  "the collapse cascade's reverseDelay",
);
const REVERSE_DELAY_MS = Math.max(
  BILLBOARD_STAGE_DELAY * Number(reverseDelayMatch[1]),
  Number(reverseDelayMatch[2]),
);
const CONTENT_MIN_STAGE = Number(
  sourceMatch(
    BILLBOARD_SRC,
    /data-visible=\{stage >= (\d+)\}/,
    "the content-visible stage",
  )[1],
);
const CONTENT_FADE_MS = Number(
  sourceMatch(
    BILLBOARD_CSS,
    /\.contentLayer \{[^}]*transition: opacity (\d+)ms ease-out;/,
    "the content layer's opacity transition",
  )[1],
);
const CONTENT_FADE_IN_DELAY_MS = Number(
  sourceMatch(
    BILLBOARD_CSS,
    /\.contentLayer\[data-visible="true"\] \{[^}]*transition-delay: (\d+)ms;/,
    "the content layer's fade-in delay",
  )[1],
);
const SHAPE_FILTER_CSS = sourceMatch(
  BILLBOARD_CSS,
  /\.shape \{[^}]*filter:\s*([^;]+);/,
  "the glass shape's drop-shadow filter",
)[1]!;

// ─── BreathingMesh ────────────────────────────────────────────────────
const MESH_SPACING = sourceConst(MESH_SRC, "SPACING");
const MESH_DOT_RADIUS = sourceConst(MESH_SRC, "DOT_RADIUS");
const MESH_OFFSET_AMPLITUDE = sourceConst(MESH_SRC, "OFFSET_AMPLITUDE");
const MESH_CUTOUT_JITTER = sourceConst(MESH_SRC, "CUTOUT_JITTER_PX");
const MESH_CUTOUT_TIGHTNESS = sourceConst(MESH_SRC, "CUTOUT_TIGHTNESS");
const MESH_DRIFT_AMPLITUDE = sourceConst(MESH_SRC, "DRIFT_AMPLITUDE");
const MESH_DRIFT_PERIOD_MIN = sourceConst(MESH_SRC, "DRIFT_PERIOD_MIN");
const MESH_DRIFT_PERIOD_MAX = sourceConst(MESH_SRC, "DRIFT_PERIOD_MAX");
const MESH_SEED = Number(
  sourceMatch(
    MESH_SRC,
    /const rnd = mulberry32\((\d+)\);/,
    "the lattice RNG seed",
  )[1],
);
const [MESH_EDGE_ALPHA, MESH_DOT_ALPHA] = [
  ...source(MESH_SRC).matchAll(/ctx\.globalAlpha = ([\d.]+);/g),
].map((m) => Number(m[1]));
if (MESH_EDGE_ALPHA === undefined || MESH_DOT_ALPHA === undefined) {
  throw new Error(`${MESH_SRC}: expected the edge + dot globalAlpha passes`);
}
const MESH_STRETCH_FACTOR = Number(
  sourceMatch(
    MESH_SRC,
    /SPACING \* meshZoomFactor \* ([\d.]+)/,
    "the edge stretch limit",
  )[1],
);
const MESH_LATTICE_MARGIN = Number(
  sourceMatch(
    MESH_SRC,
    /Math\.max\(w, h\) \* ([\d.]+)/,
    "the lattice margin",
  )[1],
);

// ─── Literals mirrored from JSX/CSS (no names to read them by) ──────────
// PolyhedronGlobe.tsx, face passes: edge-glow halo stroke + crisp
// fill/stroke, alphas as functions of facingCamera (faceShading on).
const FACE_GLOW_STROKE = { width: 3.2, alpha: (s: number) => 0.25 + s * 0.35 };
const FACE_STROKE = { width: 0.8, alpha: (s: number) => 0.25 + s * 0.3 };
const FACE_FILL_ALPHA = (s: number) => 0.04 + s * 0.1;
const FACE_FLAT_SHADING = 0.5; // shadingMul when faceShading is off
const EDGE_GLOW_BLUR = 2.5; // #ph-edge-glow stdDeviation
const CONE_BLUR = 3.2; // #ph-cone-blur stdDeviation
const CONE_CRISP_OPACITY = 0.85;
const CONE_APEX_LIFT = 2; // coneBottomY = dot.sy - 2
const DOT_PINPOINT_RADIUS = 2.2; // VertexHover pinpoint circle
// UnfoldingBillboard.tsx: rim stroke width, vertex pinpoint radius,
// inner-glow gradient (r=70%, transparent to 80%, rim color × 0.3).
const BILLBOARD_STROKE_WIDTH = 1.5;
const BILLBOARD_PINPOINT_RADIUS = 2.5;
const INNER_GLOW = { r: 0.7, clearUntil: 0.8, rimOpacity: 0.3 };
// CSS `ease-out` (every transition in the anchor choreography).
const EASE_OUT_SPLINE = "0 0 .58 1";
const LINEAR_SPLINE = "0 0 1 1";

// PolyhedronGlobe.tsx, the hex card's text block (inline styles).
// The title (weight 600) + year use HOVER_DOT_FONT_FAMILY (the
// ui-monospace stack); the description inherits the page's Geist Sans.
// Faces are picked in loadFonts.
const CARD_TYPE = {
  gapRem: 0.35,
  paddingXFraction: 0.12, // padding: "0 12%" of the content box
  title: { sizePx: 18, letterSpacingEm: 0.02, lineHeight: 1.2 },
  year: { sizePx: 11, letterSpacingEm: 0.04 }, // line-height inherits
  description: { sizePx: 12, lineHeight: 1.35, marginTopRem: 0.1, maxLines: 3 },
};

// ═══ The card itself ════════════════════════════════════════════════

/**
 * The OG card's content. stage-poster.png was recorded with this
 * entry anchored; it isn't in PROJECTS, so it lives here. Category
 * "api" is what tints the OG's glass, cone, and anchored dot cyan.
 */
const CARD_ENTRY: {
  title: string;
  year: string;
  description: string;
  category: Category;
} = {
  title: "UNLV Museum",
  year: "May 2026",
  description: "A museum of UNLV Software Development bootcamp-era projects.",
  category: "api",
};

/**
 * Framing measured once from the OG assets (constants, not re-fit on
 * each run):
 *
 *   - OG_ANCHOR_VERTEX / OG_ORBIT_DEG: the anchored vertex, and how far
 *     the open-phase auto-rotation had carried the globe around it when
 *     stage-poster.png was captured. Found by projecting every vertex's
 *     anchor pose (computeAnchorTarget, below) at every orbit angle
 *     through the globe's projection and matching the poster's six
 *     vertex dots, anchored dot included: vertex 40 at 105.47° lands
 *     all six within ~1.3px (0.6px RMS on the five the hex rim doesn't
 *     overlap), at the wide-viewport anchor X (narrower viewports'
 *     anchor X fit far worse). Vertex 40 is also
 *     the first vertex PROJECTS doesn't fill, so the card's own entry
 *     displaces no real project. (The poster's dot colours came from
 *     the May 2026 registry; the card colours its dots from today's.)
 *   - OG_STAGE_SCALE / OG_STAGE_OFFSET: stage px → card px, from the
 *     same fit. 1200×630 is the poster's own size.
 *   - OG_DEVICE_PIXEL_RATIO: the poster is a device-pixel crop of a
 *     1.5× display. Its BreathingMesh lines (drawn 1 CSS px wide) are
 *     1.5px wide on the poster, measured from their brightness profile.
 *     The mesh's pixel-sized details (line width, dot radius, jitter,
 *     drift) scale by it; the wheel zoom the capture used then follows
 *     from OG_STAGE_SCALE = anchored zoom × wheel zoom × DPR, and it
 *     agrees with the poster's lattice pitch (75px = 68 × zoom × 1.5).
 *     The lattice's phase depends on the capture's full viewport, which
 *     the crop doesn't show, so the lattice is anchored at the card's
 *     top-left as if the crop were the whole viewport.
 */
const CARD_W = 1200;
/** The recanon banner's shape (900×320); see "README framing" below. */
const CARD_H = (CARD_W * 320) / 900;
/**
 * Rounded frame, matching the dynimage banners this card sits under on
 * the moefingers profile README (dynimage src/lib/cards/svg-helpers.ts
 * cardFrameOpen/cardFrameClose). Every banner there renders at 100%
 * width, so radius and stroke scale from the recanon banner directly
 * above (rx 20, stroke 1 at 900 wide) by 1200/900. Stroke colors are
 * dynimage's theme strokes. The border is drawn inset by half its width:
 * on a rect flush with the edge, the viewport would cut the stroke's
 * outer half along the sides but not around the corners, so the
 * corners would read heavier.
 */
const FRAME_RADIUS = (20 * CARD_W) / 900;
const FRAME_STROKE = CARD_W / 900;
const FRAME_STROKE_COLOR: Record<Theme, string> = {
  dark: "#27272a",
  light: "#e4e4e7",
};
const OG_ANCHOR_VERTEX = 40;
const OG_ORBIT_DEG = 105.47;
const OG_STAGE_SCALE = 1.3887;
const OG_STAGE_OFFSET = { x: -261.77, y: 106.82 };
const OG_DEVICE_PIXEL_RATIO = 1.5;
const OG_USER_ZOOM =
  OG_STAGE_SCALE / (ANCHOR_ZOOM_SCALE * OG_DEVICE_PIXEL_RATIO);
/** Capture viewport (CSS) px → card px. */
const VIEWPORT_TO_CARD = OG_DEVICE_PIXEL_RATIO;
/**
 * README framing. On the profile README the card sits under dynimage's
 * recanon banner at the same 100% width, so it takes that banner's
 * shape (CARD_H). The OG view is taller than that (the anchored vertex
 * sits at y≈459 of 630), so the card zooms out the way the landing
 * view's wheel zoom does: the stage and BreathingMesh's lattice pitch
 * scale together by README_ZOOM, and README_FOCUS, a point of the OG
 * frame, keeps its place in the card. 0.72 keeps the whole open card,
 * the cone and a band of globe below the anchored vertex. The focus
 * sits 40px below the top so the unfolding hex's tip, which overshoots
 * the open card's top edge mid-cascade, still clears the frame.
 */
const README_ZOOM = 0.72;
const README_FOCUS = { x: CARD_W / 2, y: 40 };
const STAGE_SCALE = OG_STAGE_SCALE * README_ZOOM;
const STAGE_OFFSET = {
  x: README_FOCUS.x + (OG_STAGE_OFFSET.x - README_FOCUS.x) * README_ZOOM,
  y: README_FOCUS.y + (OG_STAGE_OFFSET.y - README_FOCUS.y) * README_ZOOM,
};
const USER_ZOOM = OG_USER_ZOOM * README_ZOOM;

const GFX = PRESET_DEFINITIONS.high;

// ═══ Number + SMIL helpers ══════════════════════════════════════════

/** Compact decimal: rounds to `digits`, drops trailing zeros and the leading 0. */
function num(n: number, digits = 1): string {
  const f = 10 ** digits;
  let r = Math.round(n * f) / f;
  if (Object.is(r, -0) || Math.abs(r) < 1e-12) r = 0;
  let s = r.toFixed(digits);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s.replace(/^(-?)0\./, "$1.");
}

/** Joins numbers for path/points data, omitting separators the grammar doesn't need. */
function joinNums(parts: string[]): string {
  let out = "";
  for (const p of parts) {
    if (out === "") out = p;
    else if (p.startsWith("-")) out += p;
    else if (p.startsWith(".") && /\.\d*$/.test(out)) out += p;
    else out += " " + p;
  }
  return out;
}

/** Cycle length (ms) — see the timeline section for why it's this value. */
const CYCLE_MS = (MESH_DRIFT_PERIOD_MIN + MESH_DRIFT_PERIOD_MAX) / 2;
const DUR = `${num(CYCLE_MS / 1000, 3)}s`;
const keyTime = (t: number) => num(t / CYCLE_MS, 5);

interface Track {
  /** Cycle times in ms, ascending, starting at 0 and ending at CYCLE_MS. */
  times: number[];
  values: string[];
  /** One keySpline per interval; omit for linear. */
  splines?: string[];
}

/** An <animate>/<animateTransform> for a looping track; "" when constant. */
function smil(attr: string, track: Track, type?: string): string {
  if (track.values.every((v) => v === track.values[0])) return "";
  const tag = type ? "animateTransform" : "animate";
  const typeAttr = type ? ` type="${type}"` : "";
  const spline = track.splines
    ? ` calcMode="spline" keySplines="${track.splines.join(";")}"`
    : "";
  return `<${tag} attributeName="${attr}"${typeAttr} values="${track.values.join(";")}" keyTimes="${track.times.map(keyTime).join(";")}"${spline} dur="${DUR}" repeatCount="indefinite"/>`;
}

/** The on/off state of a switch list at loop time t. */
function switchStateAt(
  switches: { t: number; on: boolean }[],
  t: number,
): boolean {
  let on = switches[0]?.on ?? true;
  for (const s of switches) if (s.t <= t) on = s.on;
  return on;
}

/** A discrete on/off visibility track; "" when it never changes. */
function visibilitySmil(switches: { t: number; on: boolean }[]): string {
  if (switches.length <= 1) return "";
  return `<animate attributeName="visibility" calcMode="discrete" values="${switches.map((s) => (s.on ? "visible" : "hidden")).join(";")}" keyTimes="${switches.map((s) => keyTime(s.t)).join(";")}" dur="${DUR}" repeatCount="indefinite"/>`;
}

/**
 * Builds a spline track from waypoints. Each waypoint's `spline` eases
 * the interval that ENDS at it.
 */
function waypointTrack(
  points: { t: number; v: number; spline?: string }[],
  fmt: (v: number) => string,
): Track {
  const times: number[] = [];
  const values: string[] = [];
  const splines: string[] = [];
  for (const [i, p] of points.entries()) {
    if (i > 0 && p.t <= times[times.length - 1]!) continue;
    if (i > 0) splines.push(p.spline ?? LINEAR_SPLINE);
    times.push(p.t);
    values.push(fmt(p.v));
  }
  return { times, values, splines };
}

/**
 * Douglas–Peucker over a sampled multi-channel time series: keeps the
 * fewest samples such that linear interpolation between kept samples
 * stays within `tol` on every channel.
 */
function simplifySeries(
  times: number[],
  rows: number[][],
  tol: number,
): number[] {
  const keep = new Set<number>([0, times.length - 1]);
  const stack: [number, number][] = [[0, times.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let worst = -1;
    let worstErr = tol;
    for (let i = a + 1; i < b; i++) {
      const u = (times[i]! - times[a]!) / (times[b]! - times[a]!);
      for (let c = 0; c < rows[i]!.length; c++) {
        const lerp = rows[a]![c]! + (rows[b]![c]! - rows[a]![c]!) * u;
        const err = Math.abs(rows[i]![c]! - lerp);
        if (err > worstErr) {
          worstErr = err;
          worst = i;
        }
      }
    }
    if (worst >= 0) {
      keep.add(worst);
      stack.push([a, worst], [worst, b]);
    }
  }
  return [...keep].sort((x, y) => x - y);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ═══ Color: globals.css tokens → sRGB ═══════════════════════════════

interface Lch {
  l: number;
  c: number;
  h: number;
  a: number;
}
type Tokens = Map<string, string>;

function srgbEncode(x: number): number {
  const ax = Math.abs(x);
  const v =
    ax <= 0.0031308 ? 12.92 * ax : 1.055 * Math.pow(ax, 1 / 2.4) - 0.055;
  return Math.sign(x) * v;
}
function srgbDecode(x: number): number {
  const ax = Math.abs(x);
  const v = ax <= 0.04045 ? ax / 12.92 : Math.pow((ax + 0.055) / 1.055, 2.4);
  return Math.sign(x) * v;
}

/** OKLCh → gamma-encoded sRGB (unclipped), per CSS Color 4. */
function lchToSrgb({ l, c, h }: Lch): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const A = c * Math.cos(hr);
  const B = c * Math.sin(hr);
  const lp = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const mp = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const sp = (l - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    srgbEncode(4.0767416621 * lp - 3.3077115913 * mp + 0.2309699292 * sp),
    srgbEncode(-1.2684380046 * lp + 2.6097574011 * mp - 0.3413193965 * sp),
    srgbEncode(-0.0041960863 * lp - 0.7034186147 * mp + 1.707614701 * sp),
  ];
}
function srgbToLch(r: number, g: number, b: number, a: number): Lch {
  const R = srgbDecode(r);
  const G = srgbDecode(g);
  const Bl = srgbDecode(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * Bl);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * Bl);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * Bl);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c: Math.hypot(A, B), h, a };
}

/** Splits CSS function arguments / lists at depth 0. */
function splitTop(s: string, seps: RegExp): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth === 0 && seps.test(ch)) {
      if (cur.trim()) out.push(cur.trim());
      if (ch === "/") out.push("/");
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * Resolves the CSS color syntax globals.css uses: var(), oklch() incl.
 * `oklch(from <color> l c h / a)` relative syntax, rgb()/rgba(), hex,
 * `transparent`.
 */
function parseColor(expr: string, tokens: Tokens): Lch {
  const e = expr.trim();
  const v = /^var\((--[\w-]+)\)$/.exec(e);
  if (v) {
    const val = tokens.get(v[1]!);
    if (val === undefined) throw new Error(`unknown token ${v[1]}`);
    return parseColor(val, tokens);
  }
  if (e === "transparent") return { l: 0, c: 0, h: 0, a: 0 };
  if (e.startsWith("#")) {
    const hex = e.slice(1);
    const full = hex.length <= 4 ? [...hex].map((ch) => ch + ch).join("") : hex;
    const n = (i: number) => parseInt(full.slice(i, i + 2), 16) / 255;
    return srgbToLch(n(0), n(2), n(4), full.length === 8 ? n(6) : 1);
  }
  const fn = /^(oklch|rgba?)\(([\s\S]*)\)$/.exec(e);
  if (!fn) throw new Error(`unsupported color: ${e}`);
  const args = splitTop(fn[2]!, /[\s,/]/);
  if (fn[1] === "oklch") {
    let base: Lch | null = null;
    if (args[0] === "from") {
      base = parseColor(args[1]!, tokens);
      args.splice(0, 2);
    }
    const slash = args.indexOf("/");
    const ch = slash >= 0 ? args.slice(0, slash) : args;
    const alpha = slash >= 0 ? args[slash + 1] : undefined;
    const chan = (tok: string, key: keyof Lch, pctScale: number): number => {
      if (base && tok === key) return base[key];
      if (base && key === "a" && tok === "alpha") return base.a;
      if (tok.endsWith("%")) return (parseFloat(tok) / 100) * pctScale;
      if (tok === "none") return 0;
      return parseFloat(tok);
    };
    return {
      l: chan(ch[0]!, "l", 1),
      c: chan(ch[1]!, "c", 0.4),
      h: chan(ch[2]!, "h", 360),
      a: alpha === undefined ? (base ? base.a : 1) : chan(alpha, "a", 1),
    };
  }
  const nums = args.filter((x) => x !== "/").map((x) => parseFloat(x));
  return srgbToLch(
    nums[0]! / 255,
    nums[1]! / 255,
    nums[2]! / 255,
    nums[3] ?? 1,
  );
}

/** A resolved paint: sRGB hex (per-channel clipped, as browsers do on sRGB displays) + alpha. */
interface Paint {
  hex: string;
  alpha: number;
}
function toPaint(c: Lch): Paint {
  const rgb = lchToSrgb(c).map((x) =>
    Math.round(Math.min(1, Math.max(0, x)) * 255)
      .toString(16)
      .padStart(2, "0"),
  );
  return { hex: `#${rgb.join("")}`, alpha: c.a };
}

interface Shadow {
  dx: number;
  dy: number;
  blur: number;
  paint: Paint;
}
/** `<dx> <dy> <blur> <color>` lists (text-shadow, drop-shadow()). */
function parseShadows(list: string, tokens: Tokens): Shadow[] {
  return splitTop(list, /,/).map((one) => {
    const parts = splitTop(one, /\s/);
    const lengths = parts
      .filter((p) => /^-?\d*\.?\d+(px)?$/.test(p))
      .map((p) => parseFloat(p));
    const color = parts.filter((p) => !/^-?\d*\.?\d+(px)?$/.test(p)).join(" ");
    return {
      dx: lengths[0] ?? 0,
      dy: lengths[1] ?? 0,
      blur: lengths[2] ?? 0,
      paint: toPaint(parseColor(color, tokens)),
    };
  });
}

/** The body of the `{…}` block whose opening brace follows `from`. */
function cssBlockBody(css: string, from: number): string {
  if (from < 0) throw new Error("css block not found");
  const open = css.indexOf("{", from);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error("unbalanced css block");
}

function cssDeclarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of clean.matchAll(/([\w-]+)\s*:\s*([^;{}]+);/g)) {
    out.set(m[1]!, m[2]!.replace(/\s+/g, " ").trim());
  }
  return out;
}

type Theme = "dark" | "light";

interface Palette {
  theme: Theme;
  background: Paint;
  foreground: Paint;
  mutedForeground: Paint;
  glowPinpoint: Paint;
  category: Record<Category, Paint>;
  glass: {
    fill: Paint;
    stroke: Paint;
    text: Paint;
    textMuted: Paint;
    textSecondary: Paint;
    textShadow: Shadow[];
  };
  cone: { near: Paint; mid: Paint; far: Paint; edge: Paint };
}

const CATEGORIES: Category[] = [
  "games",
  "full-stack",
  "frontend",
  "api",
  "python",
  "exercises",
];

function buildPalettes(): Record<Theme, Palette> {
  const css = source(GLOBALS_CSS);
  const settings = cssBlockBody(css, css.indexOf("@layer settings {"));
  const light = cssDeclarations(
    cssBlockBody(settings, settings.indexOf(":root {")),
  );
  const dark = new Map([
    ...light,
    ...cssDeclarations(cssBlockBody(settings, settings.indexOf(".dark {"))),
  ]);
  // [data-glass-category="<cat>"] { --glass-category: var(--category-<token>); }
  const categoryToken = new Map<string, string>();
  for (const m of settings.matchAll(
    /\[data-glass-category="([\w-]+)"\]\s*\{\s*--glass-category:\s*var\((--[\w-]+)\);/g,
  )) {
    categoryToken.set(m[1]!, m[2]!);
  }
  const make = (theme: Theme, base: Tokens): Palette => {
    const color = (expr: string, tokens: Tokens = base) =>
      toPaint(parseColor(expr, tokens));
    const category = {} as Record<Category, Paint>;
    for (const cat of CATEGORIES) {
      const token = categoryToken.get(cat);
      if (!token)
        throw new Error(
          `${GLOBALS_CSS}: no [data-glass-category="${cat}"] rule`,
        );
      category[cat] = color(`var(${token})`);
    }
    // The hex wrapper + cone carry data-glass-category={category}, which
    // re-resolves the --glass-* / --cone-* formulas against the
    // category's hue (globals.css notes the formulas are identical to
    // the :root/.dark ones; only --glass-category changes).
    const glassTokens = new Map(base);
    glassTokens.set(
      "--glass-category",
      `var(${categoryToken.get(CARD_ENTRY.category)})`,
    );
    const g = (name: string) => color(`var(${name})`, glassTokens);
    return {
      theme,
      background: color("var(--background)"),
      foreground: color("var(--foreground)"),
      mutedForeground: color("var(--muted-foreground)"),
      glowPinpoint: color("var(--glow-pinpoint)"),
      category,
      glass: {
        fill: g("--glass-fill"),
        stroke: g("--glass-stroke"),
        text: g("--glass-text"),
        textMuted: g("--glass-text-muted"),
        textSecondary: g("--glass-text-secondary"),
        textShadow: parseShadows(
          glassTokens.get("--glass-text-shadow")!,
          glassTokens,
        ),
      },
      cone: {
        near: g("--cone-stop-near"),
        mid: g("--cone-stop-mid"),
        far: g("--cone-stop-far"),
        edge: g("--cone-edge"),
      },
    };
  };
  return { dark: make("dark", dark), light: make("light", light) };
}

/** `fill="#hex" fill-opacity=".5"` style attribute pair (opacity omitted at 1). */
function paintAttrs(
  prop: "fill" | "stroke" | "stop-color" | "flood-color",
  p: Paint,
  mul = 1,
): string {
  const opacityProp =
    prop === "stop-color"
      ? "stop-opacity"
      : prop === "flood-color"
        ? "flood-opacity"
        : `${prop}-opacity`;
  const a = p.alpha * mul;
  return a >= 0.9995
    ? `${prop}="${p.hex}"`
    : `${prop}="${p.hex}" ${opacityProp}="${num(a, 3)}"`;
}

// ═══ Globe: projection + the anchored pose ══════════════════════════

const MESH = geodesic(FREQUENCY);
const STAGE_SIZE = SPHERE_RADIUS * 2 + 200; // PolyhedronGlobe: stageSize = radius * 2 + 200
const STAGE_CENTER = STAGE_SIZE / 2;
const TILT = (AXIAL_TILT_DEG * Math.PI) / 180;
const COS_TILT = Math.cos(TILT);
const SIN_TILT = Math.sin(TILT);

interface Projected {
  sx: number;
  sy: number;
  z: number;
}

/** PolyhedronGlobe's per-frame projection: quaternion → axial tilt → perspective. */
function project(q: Quat): Projected[] {
  const [m0, m1, m2, m3, m4, m5, m6, m7, m8] = toMatrix3(q);
  return MESH.vertices.map((v) => {
    const x1 = m0 * v.x + m1 * v.y + m2 * v.z;
    const y1 = m3 * v.x + m4 * v.y + m5 * v.z;
    const z1 = m6 * v.x + m7 * v.y + m8 * v.z;
    const x2 = x1 * COS_TILT - y1 * SIN_TILT;
    const y2 = x1 * SIN_TILT + y1 * COS_TILT;
    const persp = CAMERA_Z / (CAMERA_Z - z1);
    return {
      sx: x2 * persp * SPHERE_RADIUS + STAGE_CENTER,
      sy: -y2 * persp * SPHERE_RADIUS + STAGE_CENTER,
      z: z1,
    };
  });
}

/** Screen-space winding cull, exactly as PolyhedronGlobe's faceRecords. */
function isFrontFacing(face: number[], P: Projected[]): boolean {
  const a = P[face[0]!]!;
  const b = P[face[1]!]!;
  const c = P[face[2]!]!;
  return (b.sx - a.sx) * (c.sy - a.sy) - (b.sy - a.sy) * (c.sx - a.sx) < 0;
}

/** use-anchor-phase's (module-private) computeAnchorTarget target point. */
function anchorTargetPoint(ndcX: number) {
  const px = ndcX * COS_TILT + ANCHOR_NDC_Y * SIN_TILT;
  const py = -ndcX * SIN_TILT + ANCHOR_NDC_Y * COS_TILT;
  const r2 = px * px + py * py;
  return { x: px, y: py, z: r2 >= 1 ? 0 : Math.sqrt(1 - r2) };
}

const ANCHOR_AXIS = anchorTargetPoint(ANCHOR_NDC_X);
const anchorVertex = MESH.vertices[OG_ANCHOR_VERTEX]!;
/** computeAnchorTarget's toQ for the anchored vertex. */
const ANCHOR_Q = fromUnitVectors(
  anchorVertex.x,
  anchorVertex.y,
  anchorVertex.z,
  ANCHOR_AXIS.x,
  ANCHOR_AXIS.y,
  ANCHOR_AXIS.z,
);
/**
 * The pose `phi` radians of open-phase auto-rotation past the anchor
 * pose. Auto-rotate left-multiplies rotations about the anchored axis
 * (= the anchor target point), so the anchored vertex never moves.
 */
function orbitPose(phi: number): Quat {
  return quatMultiply(
    fromAxisAngle(ANCHOR_AXIS.x, ANCHOR_AXIS.y, ANCHOR_AXIS.z, phi),
    ANCHOR_Q,
  );
}

// ═══ Timeline ═══════════════════════════════════════════════════════
//
// One loop, t = 0 at the start of the open phase (so the card is up
// the moment the README loads):
//
//   open         [0, HOLD)        anchored auto-rotate at 0.6× cruise
//   collapsing   COLLAPSING_MS    hex cascade closes, cone narrows
//   coneFalling  CONE_FALL_MS     cone + card dot drop to the vertex
//   swinging     ANCHOR_SWING_MS  slerp back to the anchor pose
//   coneRising   CONE_RISE_MS     cone rises, card dot rides it up
//   widening     WIDENING_MS      cone widens, hex cascade unfolds
//
// coneFalling → swinging is the real cross-anchor path (the sphere
// stays zoomed in); swinging back to the same pose undoes the open
// phase's drift, which is what makes the loop seamless using only the
// real motions. The loop length is the mean BreathingMesh drift period
// ((6000 + 11000) / 2 = 8.5s), so the mesh breathes on the same clock;
// the open hold takes whatever the other phases leave (~6s).
//
// The open hold is centred on the OG's recorded orientation, so the
// card's resting frame (and its static fallback) is the poster's.

const HOLD_MS =
  CYCLE_MS -
  (COLLAPSING_MS + CONE_FALL_MS + ANCHOR_SWING_MS + CONE_RISE_MS + WIDENING_MS);
if (HOLD_MS <= 1000) throw new Error(`open hold too short (${HOLD_MS}ms)`);
const COLLAPSE_START = HOLD_MS;
const CONE_FALL_START = COLLAPSE_START + COLLAPSING_MS;
const SWING_START = CONE_FALL_START + CONE_FALL_MS;
const CONE_RISE_START = SWING_START + ANCHOR_SWING_MS;
const WIDEN_START = CONE_RISE_START + CONE_RISE_MS;
const CONE_WIDEN_MS = WIDENING_MS * CONE_WIDEN_FRACTION;
/** The static fallback frame: mid-hold, card settled, OG orientation. */
const BASE_T = HOLD_MS / 2;

const ORBIT_SPEED = AUTO_ANGULAR_SPEED * ANCHOR_AUTO_SPEED_MUL; // rad/s
const PHI_OG = (OG_ORBIT_DEG * Math.PI) / 180;
const PHI_OPEN = PHI_OG - (ORBIT_SPEED * HOLD_MS) / 2000;
const PHI_CLOSED = PHI_OPEN + (ORBIT_SPEED * HOLD_MS) / 1000;

/** use-anchor-phase's tickSwing easing. */
function easeInOutCubic(u: number): number {
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

function poseAt(t: number): Quat {
  if (t <= HOLD_MS) return orbitPose(PHI_OPEN + (ORBIT_SPEED * t) / 1000);
  if (t <= SWING_START) return orbitPose(PHI_CLOSED);
  if (t < CONE_RISE_START) {
    const u = (t - SWING_START) / ANCHOR_SWING_MS;
    return quatSlerp(
      orbitPose(PHI_CLOSED),
      orbitPose(PHI_OPEN),
      easeInOutCubic(u),
    );
  }
  return orbitPose(PHI_OPEN);
}

/**
 * Exact keySpline for easeInOutCubic restricted to [u0, u1] (inside one
 * cubic half): x control points at 1/3, 2/3 make time linear, and the y
 * control points are the segment's Bernstein coefficients.
 */
function easeSegmentSpline(u0: number, u1: number): string {
  const e0 = easeInOutCubic(u0);
  const span = easeInOutCubic(u1) - e0;
  const d = (u: number) => (u < 0.5 ? 12 * u * u : 3 * Math.pow(-2 * u + 2, 2));
  const scale = (u1 - u0) / span;
  const y1 = (d(u0) * scale) / 3;
  const y2 = 1 - (d(u1) * scale) / 3;
  return `.3333 ${num(y1, 4)} .6667 ${num(y2, 4)}`;
}

/** Globe keyframes: the drift in ≤2° steps, the swing in 12 eased steps. */
function globeKeyframes(): { times: number[]; splines: string[] } {
  const holdSteps = Math.max(
    1,
    Math.ceil((ORBIT_SPEED * HOLD_MS) / 1000 / ((2 * Math.PI) / 180)),
  );
  const swingSteps = 12; // even, so u = 0.5 (where the easing changes piece) is a key
  const times: number[] = [];
  const splines: string[] = [];
  for (let i = 0; i <= holdSteps; i++) {
    times.push((HOLD_MS * i) / holdSteps);
    if (i > 0) splines.push(LINEAR_SPLINE);
  }
  times.push(SWING_START);
  splines.push(LINEAR_SPLINE);
  for (let j = 1; j <= swingSteps; j++) {
    times.push(SWING_START + (ANCHOR_SWING_MS * j) / swingSteps);
    splines.push(easeSegmentSpline((j - 1) / swingSteps, j / swingSteps));
  }
  times.push(CYCLE_MS);
  splines.push(LINEAR_SPLINE);
  return { times, splines };
}

/**
 * When `pred(t)` flips across the cycle: sampled every 4ms through the
 * moving phases, then each flip bisected to ~0.01ms.
 */
function switchTimes(
  pred: (t: number) => boolean,
): { t: number; on: boolean }[] {
  const out = [{ t: 0, on: pred(0) }];
  const ranges: [number, number][] = [
    [0, HOLD_MS],
    [SWING_START, CONE_RISE_START],
  ];
  for (const [a, b] of ranges) {
    let prevT = a;
    let prev = pred(a);
    for (let t = a + 4; t <= b + 1e-9; t += 4) {
      const cur = pred(Math.min(t, b));
      if (cur !== prev) {
        let lo = prevT;
        let hi = Math.min(t, b);
        while (hi - lo > 0.01) {
          const mid = (lo + hi) / 2;
          if (pred(mid) === prev) lo = mid;
          else hi = mid;
        }
        out.push({ t: hi, on: cur });
      }
      prevT = Math.min(t, b);
      prev = cur;
    }
  }
  return out;
}

const toCardX = (x: number) => x * STAGE_SCALE + STAGE_OFFSET.x;
const toCardY = (y: number) => y * STAGE_SCALE + STAGE_OFFSET.y;

// ═══ Globe layer ════════════════════════════════════════════════════

interface GlobeModel {
  faces: {
    id: number;
    points: string[];
    glowAlpha: string[];
    strokeAlpha: string[];
    fillAlpha: string[];
    base: {
      points: string;
      glowAlpha: string;
      strokeAlpha: string;
      fillAlpha: string;
    };
    visibility: { t: number; on: boolean }[];
  }[];
  dots: {
    vi: number;
    category: Category | null;
    translate: string[];
    base: string;
    shading: number[]; // facingCamera per keyframe (unassigned dots scale with it)
    baseShading: number;
    visibility: { t: number; on: boolean }[];
  }[];
  times: number[];
  splines: string[];
  anchor: Projected;
}

function buildGlobeModel(): GlobeModel {
  const { times, splines } = globeKeyframes();
  const poses = times.map((t) => project(poseAt(t)));
  const basePose = project(poseAt(BASE_T));
  const samples: Projected[][] = [];
  for (let t = 0; t <= CYCLE_MS; t += 20) samples.push(project(poseAt(t)));

  const anchor = basePose[OG_ANCHOR_VERTEX]!;
  for (const P of [...poses, ...samples]) {
    const a = P[OG_ANCHOR_VERTEX]!;
    if (Math.hypot(a.sx - anchor.sx, a.sy - anchor.sy) > 1e-6) {
      throw new Error(
        "anchored vertex moved; the orbit axis must pass through it",
      );
    }
  }

  const inCard = (xs: number[], ys: number[], margin: number) =>
    Math.max(...xs.map(toCardX)) >= -margin &&
    Math.min(...xs.map(toCardX)) <= CARD_W + margin &&
    Math.max(...ys.map(toCardY)) >= -margin &&
    Math.min(...ys.map(toCardY)) <= CARD_H + margin;

  const shadingOf = (face: number[], P: Projected[]) =>
    GFX.faceShading
      ? Math.max(
          0,
          Math.min(1, (P[face[0]!]!.z + P[face[1]!]!.z + P[face[2]!]!.z) / 3),
        )
      : FACE_FLAT_SHADING;
  const pointsOf = (face: number[], P: Projected[]) =>
    face.map((vi) => `${num(P[vi]!.sx)},${num(P[vi]!.sy)}`).join(" ");
  const glowMargin =
    (FACE_GLOW_STROKE.width / 2 + 3 * EDGE_GLOW_BLUR) * STAGE_SCALE;

  const faces: GlobeModel["faces"] = [];
  MESH.faces.forEach((face, id) => {
    const seen = samples.some(
      (P) =>
        isFrontFacing(face, P) &&
        inCard(
          face.map((vi) => P[vi]!.sx),
          face.map((vi) => P[vi]!.sy),
          glowMargin,
        ),
    );
    if (!seen) return;
    const s = poses.map((P) => shadingOf(face, P));
    const sBase = shadingOf(face, basePose);
    faces.push({
      id,
      points: poses.map((P) => pointsOf(face, P)),
      glowAlpha: s.map((x) => num(FACE_GLOW_STROKE.alpha(x), 3)),
      strokeAlpha: s.map((x) => num(FACE_STROKE.alpha(x), 3)),
      fillAlpha: s.map((x) => num(FACE_FILL_ALPHA(x), 3)),
      base: {
        points: pointsOf(face, basePose),
        glowAlpha: num(FACE_GLOW_STROKE.alpha(sBase), 3),
        strokeAlpha: num(FACE_STROKE.alpha(sBase), 3),
        fillAlpha: num(FACE_FILL_ALPHA(sBase), 3),
      },
      visibility: switchTimes((t) => isFrontFacing(face, project(poseAt(t)))),
    });
  });

  // Visible vertices = vertices of front-facing faces (visibleVertices).
  const facesOf = MESH.vertices.map((_, vi) =>
    MESH.faces.filter((f) => f.includes(vi)),
  );
  const vertexVisible = (vi: number, P: Projected[]) =>
    facesOf[vi]!.some((f) => isFrontFacing(f, P));
  const dotMargin = DOT_GLOW_RADIUS * STAGE_SCALE;
  const dots: GlobeModel["dots"] = [];
  MESH.vertices.forEach((_, vi) => {
    const seen = samples.some(
      (P) =>
        vertexVisible(vi, P) && inCard([P[vi]!.sx], [P[vi]!.sy], dotMargin),
    );
    if (!seen) return;
    const category =
      vi === OG_ANCHOR_VERTEX
        ? CARD_ENTRY.category
        : // LandingView: vertex i ← PROJECTS[i] in the default (category) sort.
          (PROJECTS[vi]?.category ?? null);
    dots.push({
      vi,
      category,
      translate: poses.map((P) => `${num(P[vi]!.sx)} ${num(P[vi]!.sy)}`),
      base: `${num(basePose[vi]!.sx)} ${num(basePose[vi]!.sy)}`,
      shading: poses.map((P) => Math.max(0, Math.min(1, P[vi]!.z))),
      baseShading: Math.max(0, Math.min(1, basePose[vi]!.z)),
      visibility: switchTimes((t) => vertexVisible(vi, project(poseAt(t)))),
    });
  });
  // Painter order: back to front by depth (visibleVertices sort).
  dots.sort((a, b) => basePose[a.vi]!.z - basePose[b.vi]!.z);

  return { faces, dots, times, splines, anchor };
}

function renderGlobe(
  model: GlobeModel,
  pal: Palette,
): { defs: string; body: string } {
  const fg = pal.foreground;
  const track = (values: string[]): Track => ({
    times: model.times,
    values,
    splines: model.splines,
  });
  const defs: string[] = [];
  const glows: string[] = [];
  const crisp: string[] = [];

  defs.push(
    `<radialGradient id="ph-bg-halo" cx="50%" cy="50%" r="50%"><stop offset="0" ${paintAttrs("stop-color", fg, 0.18)}/><stop offset=".55" ${paintAttrs("stop-color", fg, 0.06)}/><stop offset="1" ${paintAttrs("stop-color", fg, 0)}/></radialGradient>`,
    `<radialGradient id="ph-vertex-glow" cx="50%" cy="50%" r="50%"><stop offset="0" ${paintAttrs("stop-color", fg, 0.95)}/><stop offset=".35" ${paintAttrs("stop-color", fg, 0.45)}/><stop offset="1" ${paintAttrs("stop-color", fg, 0)}/></radialGradient>`,
    `<filter id="ph-edge-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${EDGE_GLOW_BLUR}"/></filter>`,
  );
  const usedCategories = new Set(
    model.dots.map((d) => d.category).filter((c): c is Category => c !== null),
  );
  for (const cat of usedCategories) {
    const c = pal.category[cat];
    defs.push(
      `<radialGradient id="dot-${cat}" cx="50%" cy="50%" r="50%"><stop offset="0" ${paintAttrs("stop-color", pal.glowPinpoint)}/><stop offset=".35" ${paintAttrs("stop-color", c, 0.95)}/><stop offset=".65" ${paintAttrs("stop-color", c, 0.7)}/><stop offset="1" ${paintAttrs("stop-color", c, 0)}/></radialGradient>`,
    );
  }

  for (const f of model.faces) {
    defs.push(
      `<polygon id="f${f.id}" points="${f.base.points}">${smil("points", track(f.points))}</polygon>`,
    );
    const vis = visibilitySmil(f.visibility);
    const baseVis = switchStateAt(f.visibility, BASE_T)
      ? ""
      : ` visibility="hidden"`;
    if (GFX.edgeGlow) {
      glows.push(
        `<use href="#f${f.id}" stroke-opacity="${f.base.glowAlpha}" filter="url(#ph-edge-glow)"${baseVis}>${smil("stroke-opacity", track(f.glowAlpha))}${vis}</use>`,
      );
    }
    crisp.push(
      `<use href="#f${f.id}" fill-opacity="${f.base.fillAlpha}" stroke-opacity="${f.base.strokeAlpha}"${baseVis}>${smil("fill-opacity", track(f.fillAlpha))}${smil("stroke-opacity", track(f.strokeAlpha))}${vis}</use>`,
    );
  }

  const dots: string[] = [];
  if (GFX.vertexGlows !== "off") {
    for (const d of model.dots) {
      const vis = visibilitySmil(d.visibility);
      const baseVis = switchStateAt(d.visibility, BASE_T)
        ? ""
        : ` visibility="hidden"`;
      const move = smil("transform", track(d.translate), "translate");
      if (d.category) {
        // VertexHover, idle (not engaged): category glow + pinpoint.
        dots.push(
          `<g transform="translate(${d.base})"${baseVis}>${move}${vis}<circle r="${DOT_GLOW_RADIUS}" fill="url(#dot-${d.category})"/><circle r="${DOT_PINPOINT_RADIUS}" ${paintAttrs("fill", pal.glowPinpoint)}/></g>`,
        );
      } else {
        // Unassigned vertex: neutral glow, size + opacity by depth.
        const r = (s: number) => num(4 + s * 4, 2);
        const o = (s: number) => num(0.4 + s * 0.5, 3);
        dots.push(
          `<g transform="translate(${d.base})"${baseVis}>${move}${vis}<circle r="${r(d.baseShading)}" opacity="${o(d.baseShading)}" fill="url(#ph-vertex-glow)">${smil("r", track(d.shading.map(r)))}${smil("opacity", track(d.shading.map(o)))}</circle></g>`,
        );
      }
    }
  }

  const halo = GFX.backgroundHalo
    ? `<rect width="${STAGE_SIZE}" height="${STAGE_SIZE}" fill="url(#ph-bg-halo)"/>`
    : "";
  const body = [
    halo,
    glows.length
      ? `<g fill="none" stroke="${fg.hex}" stroke-width="${FACE_GLOW_STROKE.width}" stroke-linejoin="round">${glows.join("")}</g>`
      : "",
    `<g fill="${fg.hex}" stroke="${fg.hex}" stroke-width="${FACE_STROKE.width}" stroke-linejoin="round">${crisp.join("")}</g>`,
    dots.join(""),
  ].join("\n");
  return { defs: defs.join("\n"), body };
}

// ═══ Cone + card choreography tracks ════════════════════════════════

/** coneHeightProgress as rendered: 0 → 1 over coneRising, 1 → 0 over coneFalling. */
function heightProgressTrack(): { t: number; v: number; spline?: string }[] {
  return [
    { t: 0, v: 1 },
    { t: CONE_FALL_START, v: 1 },
    { t: SWING_START, v: 0, spline: EASE_OUT_SPLINE },
    { t: CONE_RISE_START, v: 0 },
    { t: WIDEN_START, v: 1, spline: EASE_OUT_SPLINE },
    { t: CYCLE_MS, v: 1 },
  ];
}
/** coneWidthProgress: 0 → 1 over the first 40% of widening, 1 → 0 across collapsing. */
function widthProgressTrack(): { t: number; v: number; spline?: string }[] {
  return [
    { t: 0, v: 1 },
    { t: COLLAPSE_START, v: 1 },
    { t: CONE_FALL_START, v: 0, spline: EASE_OUT_SPLINE },
    { t: WIDEN_START, v: 0 },
    { t: WIDEN_START + CONE_WIDEN_MS, v: 1, spline: EASE_OUT_SPLINE },
    { t: CYCLE_MS, v: 1 },
  ];
}

function renderCone(
  anchor: Projected,
  pal: Palette,
): { defs: string; body: string } {
  const hexOffset = SPHERE_RADIUS * HEX_OFFSET_RATIO;
  const dotX = anchor.sx;
  const coneTopY = anchor.sy - hexOffset;
  const coneBottomY = anchor.sy - CONE_APEX_LIFT;
  const halfW =
    Math.tan((CONE_HALF_ANGLE_DEG * Math.PI) / 180) *
    Math.abs(coneBottomY - coneTopY);
  const pts = `${num(dotX)},${num(coneBottomY)} ${num(dotX - halfW)},${num(coneTopY)} ${num(dotX + halfW)},${num(coneTopY)}`;
  const defs = [
    `<linearGradient id="ph-cone" gradientUnits="userSpaceOnUse" x1="${num(dotX)}" y1="${num(coneBottomY)}" x2="${num(dotX)}" y2="${num(coneTopY)}"><stop offset="0" ${paintAttrs("stop-color", pal.cone.near)}/><stop offset=".55" ${paintAttrs("stop-color", pal.cone.mid)}/><stop offset="1" ${paintAttrs("stop-color", pal.cone.far)}/></linearGradient>`,
    `<filter id="ph-cone-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${CONE_BLUR}"/></filter>`,
  ].join("\n");
  const scaleTrack = (
    points: { t: number; v: number; spline?: string }[],
    axis: "x" | "y",
  ) =>
    waypointTrack(points, (v) =>
      axis === "x" ? `${num(v, 4)} 1` : `1 ${num(v, 4)}`,
    );
  const edge = paintAttrs("stroke", pal.cone.edge);
  const body =
    `<g transform="translate(${num(dotX, 2)} ${num(coneBottomY, 2)})">` +
    `<g>${smil("transform", scaleTrack(heightProgressTrack(), "y"), "scale")}` +
    `<g>${smil("transform", scaleTrack(widthProgressTrack(), "x"), "scale")}` +
    `<g transform="translate(${num(-dotX, 2)} ${num(-coneBottomY, 2)})">` +
    `<polygon points="${pts}" fill="url(#ph-cone)" filter="url(#ph-cone-blur)"/>` +
    `<polygon points="${pts}" fill="url(#ph-cone)" opacity="${CONE_CRISP_OPACITY}"/>` +
    `<g ${edge} stroke-width="1" stroke-linecap="round"><line x1="${num(dotX)}" y1="${num(coneBottomY)}" x2="${num(dotX - halfW)}" y2="${num(coneTopY)}"/><line x1="${num(dotX)}" y1="${num(coneBottomY)}" x2="${num(dotX + halfW)}" y2="${num(coneTopY)}"/></g>` +
    `</g></g></g></g>`;
  return { defs, body };
}

// ═══ Hex card: spring cascade ═══════════════════════════════════════

interface BillboardModel {
  times: number[];
  /** Per keyframe: TOPOLOGY_COUNT vertex positions (billboard-local px). */
  frames: { x: number; y: number }[][];
  settled: { x: number; y: number }[];
  innerGlow: { t: number; on: boolean }[];
}

/**
 * Runs UnfoldingBillboard's stage cascade through one loop with the
 * real spring integrator, one step per 60Hz frame. Two loops are
 * simulated and the second kept, so the springs enter the loop with
 * whatever motion the previous collapse left them.
 */
function buildBillboardModel(radius: number): BillboardModel {
  const events: { t: number; stage: number }[] = [];
  for (let s = 1; s <= FINAL_STAGE; s++) {
    events.push({ t: WIDEN_START + BILLBOARD_STAGE_DELAY * (s - 1), stage: s });
  }
  for (let i = 1; i <= FINAL_STAGE; i++) {
    events.push({
      t: COLLAPSE_START + REVERSE_DELAY_MS * i,
      stage: FINAL_STAGE - i,
    });
  }
  const xs = Array.from({ length: TOPOLOGY_COUNT }, () =>
    makeSpring(BILLBOARD_SPRING, 0),
  );
  const ys = Array.from({ length: TOPOLOGY_COUNT }, () =>
    makeSpring(BILLBOARD_SPRING, 0),
  );
  const setStage = (stage: number) => {
    const targets = unfoldStageVertices(stage, TOPOLOGY_COUNT, radius, 0);
    targets.forEach((p, i) => {
      xs[i]!.target = p.x;
      ys[i]!.target = p.y;
    });
  };
  // Absolute time runs from the first widening; frame n renders at
  // WIDEN_START + n/60s. A stage change takes effect on the next frame.
  const frameMs = 1000 / 60;
  const dt = Math.min(frameMs / 1000, FRAME_TIMESTEP_CAP);
  const absEvents = [0, 1, 2]
    .flatMap((c) =>
      events.map((e) => ({ t: e.t + c * CYCLE_MS, stage: e.stage })),
    )
    .filter((e) => e.t >= WIDEN_START)
    .sort((a, b) => a.t - b.t);
  let next = 0;
  const recorded: { t: number; pts: { x: number; y: number }[] }[] = [];
  for (let n = 0; ; n++) {
    const t = WIDEN_START + n * frameMs;
    if (t > WIDEN_START + 2 * CYCLE_MS + frameMs) break;
    while (next < absEvents.length && absEvents[next]!.t <= t) {
      setStage(absEvents[next]!.stage);
      next++;
    }
    if (n > 0) {
      for (let i = 0; i < TOPOLOGY_COUNT; i++) {
        stepSpring(xs[i]!, dt);
        stepSpring(ys[i]!, dt);
      }
    }
    // Keep the second loop (plus a frame either side for the seam).
    if (t >= WIDEN_START + CYCLE_MS - frameMs) {
      recorded.push({
        t: t - CYCLE_MS,
        pts: xs.map((x, i) => ({ x: x.position, y: ys[i]!.position })),
      });
    }
  }
  // `recorded` covers [WIDEN_START, WIDEN_START + CYCLE_MS] in loop
  // time, unwrapped past CYCLE_MS. Interpolate an exact sample at the
  // loop seam (CYCLE_MS ≡ 0), then fold.
  const at = (t: number) => {
    const j = recorded.findIndex((s) => s.t >= t);
    const b = recorded[j]!;
    const a = recorded[j - 1] ?? b;
    const u = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
    return a.pts.map((p, i) => ({
      x: p.x + (b.pts[i]!.x - p.x) * u,
      y: p.y + (b.pts[i]!.y - p.y) * u,
    }));
  };
  const seam = at(CYCLE_MS);
  const folded = recorded
    .map((s) => ({ t: s.t >= CYCLE_MS ? s.t - CYCLE_MS : s.t, pts: s.pts }))
    .filter((s) => s.t > 1e-6 && s.t < CYCLE_MS - 1e-6)
    .sort((a, b) => a.t - b.t)
    // The loop is a whole number of frames, so the overlap frames fold
    // onto the same times; keep one of each.
    .filter((s, i, list) => i === 0 || s.t - list[i - 1]!.t > 1e-6);
  const series = [{ t: 0, pts: seam }, ...folded, { t: CYCLE_MS, pts: seam }];
  const keep = simplifySeries(
    series.map((s) => s.t),
    series.map((s) => s.pts.flatMap((p) => [p.x, p.y])),
    0.04,
  );
  const lastStageZero = COLLAPSE_START + REVERSE_DELAY_MS * FINAL_STAGE;
  return {
    times: keep.map((i) => series[i]!.t),
    frames: keep.map((i) => series[i]!.pts),
    settled: unfoldStageVertices(FINAL_STAGE, TOPOLOGY_COUNT, radius, 0),
    // The inner-glow overlay renders while stage > 0.
    innerGlow: [
      { t: 0, on: true },
      { t: lastStageZero, on: false },
      { t: WIDEN_START, on: true },
    ],
  };
}

// ═══ Hex card: typography (glyph outlines) ══════════════════════════
//
// The real title + year use the ui-monospace stack, which resolves per
// OS; the OG was rendered on Windows, i.e. in Consolas. Consolas can't
// be redistributed, so the card uses Inconsolata (OFL-1.1), the open
// Consolas-alike, at its SemiExpanded width (0.55em advance, Consolas's
// own). Consolas has only Regular and Bold faces, so the title's
// font-weight 600 rendered Bold in the OG; the card uses Inconsolata
// Bold to match. The description is the museum's own Geist (OFL-1.1).
// Glyphs are laid out with fontkit (kerning on, as browsers do) and
// emitted as outlines.

type FKFont = fontkit.Font;

interface Fonts {
  monoTitle: FKFont;
  monoYear: FKFont;
  sans: FKFont;
}

async function loadFonts(): Promise<Fonts> {
  const nm = (rel: string) =>
    readFileSync(resolve(projectRoot, "node_modules", rel));
  // fontkit can't instance a variable WOFF2 (its WOFF2 glyf transform
  // breaks with variation coords), so decode to TTF first.
  const monoTtf = Buffer.from(
    (await wawoff2.decompress(
      nm(
        "@fontsource-variable/inconsolata/files/inconsolata-latin-standard-normal.woff2",
      ),
    )) as Uint8Array,
  );
  const mono = fontkit.create(monoTtf) as FKFont;
  const sans = fontkit.create(
    nm("@fontsource/geist/files/geist-latin-400-normal.woff2"),
  ) as FKFont;
  return {
    monoTitle: mono.getVariation("SemiExpanded Bold"),
    monoYear: mono.getVariation("SemiExpanded Regular"),
    sans,
  };
}

/** Ascent/descent as Chrome uses them (typo metrics when USE_TYPO_METRICS). */
function lineMetrics(font: FKFont, sizePx: number) {
  const os2 = (
    font as unknown as {
      "OS/2": {
        typoAscender: number;
        typoDescender: number;
        fsSelection: { useTypoMetrics: boolean };
      };
    }
  )["OS/2"];
  const useTypo = os2.fsSelection.useTypoMetrics;
  const ascent = useTypo ? os2.typoAscender : font.ascent;
  const descent = useTypo ? -os2.typoDescender : -font.descent;
  const k = sizePx / font.unitsPerEm;
  return { ascent: ascent * k, descent: descent * k };
}

interface GlyphUse {
  key: string;
  x: number; // px from line start
}
interface ShapedLine {
  glyphs: GlyphUse[];
  width: number; // px, incl. trailing letter-spacing (as Chrome measures)
}

class GlyphBank {
  private defs = new Map<string, string>();
  private ids = new Map<string, string>();
  constructor(private fonts: Map<FKFont, string>) {}

  shape(
    font: FKFont,
    text: string,
    sizePx: number,
    letterSpacingPx: number,
  ): ShapedLine {
    const run = font.layout(text);
    const k = sizePx / font.unitsPerEm;
    let x = 0;
    const glyphs: GlyphUse[] = [];
    run.glyphs.forEach((g, i) => {
      const pos = run.positions[i]!;
      const key = `${this.fonts.get(font)}:${g.id}`;
      if (!this.defs.has(key)) {
        this.defs.set(key, glyphPathData(g));
        this.ids.set(key, `g${this.ids.size.toString(36)}`);
      }
      if (g.path.commands.length) glyphs.push({ key, x: x + pos.xOffset * k });
      x += pos.xAdvance * k + letterSpacingPx;
    });
    return { glyphs, width: x };
  }

  id(key: string): string {
    return this.ids.get(key)!;
  }

  /** <path> defs in font units (y up); instances flip them. */
  renderDefs(): string {
    return [...this.defs.entries()]
      .filter(([, d]) => d)
      .map(([key, d]) => `<path id="${this.id(key)}" d="${d}"/>`)
      .join("");
  }
}

function glyphPathData(g: fontkit.Glyph): string {
  const parts: string[] = [];
  for (const cmd of g.path.commands) {
    const a = cmd.args.map((v) => num(v, 0));
    switch (cmd.command) {
      case "moveTo":
        parts.push("M" + joinNums(a));
        break;
      case "lineTo":
        parts.push("L" + joinNums(a));
        break;
      case "quadraticCurveTo":
        parts.push("Q" + joinNums(a));
        break;
      case "bezierCurveTo":
        parts.push("C" + joinNums(a));
        break;
      case "closePath":
        parts.push("Z");
        break;
    }
  }
  return parts.join("");
}

interface CardText {
  title: { line: ShapedLine; baseline: number; size: number };
  year: { line: ShapedLine; baseline: number; size: number };
  description: { lines: ShapedLine[]; baselines: number[]; size: number };
}

/**
 * Lays out the card's text block the way the browser does: a column
 * flexbox (gap 0.35rem) centred in the content layer (radius × 1.4
 * square, 12% side padding), lines centred, description wrapped at
 * spaces and after hyphens and clamped to 3 lines.
 */
function layoutCardText(
  bank: GlyphBank,
  fonts: Fonts,
  hexRadius: number,
  body: { sizePx: number; lineHeight: number },
): CardText {
  const rem = 16;
  const box = hexRadius * CONTENT_BOX_RATIO;
  const innerWidth = box * (1 - 2 * CARD_TYPE.paddingXFraction);
  const gap = CARD_TYPE.gapRem * rem;

  const t = CARD_TYPE.title;
  const titleLine = bank.shape(
    fonts.monoTitle,
    CARD_ENTRY.title,
    t.sizePx,
    t.letterSpacingEm * t.sizePx,
  );
  const titleLH = t.sizePx * t.lineHeight;
  const tm = lineMetrics(fonts.monoTitle, t.sizePx);

  const y = CARD_TYPE.year;
  const yearLine = bank.shape(
    fonts.monoYear,
    CARD_ENTRY.year,
    y.sizePx,
    y.letterSpacingEm * y.sizePx,
  );
  const yearLH = y.sizePx * body.lineHeight; // inherits the body's line-height
  const ym = lineMetrics(fonts.monoYear, y.sizePx);

  const d = CARD_TYPE.description;
  // Break opportunities: after spaces (the space hangs) and after hyphens.
  const tokens = CARD_ENTRY.description.match(/[^\s-]+-?|\s+/g) ?? [];
  const lines: string[] = [];
  let cur = "";
  for (const tok of tokens) {
    if (/^\s+$/.test(tok)) {
      cur += " ";
      continue;
    }
    const candidate = cur + tok;
    if (
      cur.trim() &&
      bank.shape(fonts.sans, candidate.trimEnd(), d.sizePx, 0).width >
        innerWidth
    ) {
      lines.push(cur.trimEnd());
      cur = tok;
    } else {
      cur = candidate;
    }
  }
  if (cur.trim()) lines.push(cur.trimEnd());
  if (lines.length > d.maxLines) {
    throw new Error(
      `card description wraps to ${lines.length} lines; the card clamps at ${d.maxLines}`,
    );
  }
  const descLines = lines.map((l) => bank.shape(fonts.sans, l, d.sizePx, 0));
  const descLH = d.sizePx * d.lineHeight;
  const dm = lineMetrics(fonts.sans, d.sizePx);

  const baselineIn = (lh: number, m: { ascent: number; descent: number }) =>
    (lh - (m.ascent + m.descent)) / 2 + m.ascent;
  const total =
    titleLH +
    gap +
    yearLH +
    gap +
    d.marginTopRem * rem +
    descLines.length * descLH;
  let top = -total / 2;
  const titleBaseline = top + baselineIn(titleLH, tm);
  top += titleLH + gap;
  const yearBaseline = top + baselineIn(yearLH, ym);
  top += yearLH + gap + d.marginTopRem * rem;
  const descBaselines = descLines.map(
    (_, i) => top + i * descLH + baselineIn(descLH, dm),
  );
  return {
    title: { line: titleLine, baseline: titleBaseline, size: t.sizePx },
    year: { line: yearLine, baseline: yearBaseline, size: y.sizePx },
    description: { lines: descLines, baselines: descBaselines, size: d.sizePx },
  };
}

function renderLine(
  bank: GlyphBank,
  line: ShapedLine,
  baseline: number,
  sizePx: number,
  unitsPerEm: number,
): string {
  const k = sizePx / unitsPerEm;
  const x0 = -line.width / 2;
  return `<g transform="matrix(${num(k, 5)} 0 0 ${num(-k, 5)} ${num(x0, 2)} ${num(baseline, 2)})">${line.glyphs
    .map((g) => `<use href="#${bank.id(g.key)}" x="${num(g.x / k, 0)}"/>`)
    .join("")}</g>`;
}

// ═══ Hex card: render ═══════════════════════════════════════════════

function renderBillboard(
  model: BillboardModel,
  text: CardText,
  bank: GlyphBank,
  fonts: Fonts,
  anchor: Projected,
  strut: number,
  pal: Palette,
): { defs: string; body: string } {
  const hexRadius = SPHERE_RADIUS * HEX_RADIUS_RATIO;
  const hexOffset = SPHERE_RADIUS * HEX_OFFSET_RATIO;
  const hexCx = anchor.sx;
  const hexCy = anchor.sy - hexOffset - hexRadius;
  // The wrapper's `top` lerps dotY → hexCy with coneHeightProgress (CSS
  // ease-out during coneRising/coneFalling). translate(-50%,-50%) is of
  // the wrapper's box, which is the billboard (radius × 2.4 square)
  // plus the line box's strut below its baseline, so the hex centre
  // sits strut/2 above `top`.
  const yAt = (p: number) => anchor.sy + (hexCy - anchor.sy) * p - strut / 2;
  const move = waypointTrack(
    heightProgressTrack(),
    (p) => `${num(hexCx, 2)} ${num(yAt(p), 2)}`,
  );
  const pathOf = (pts: { x: number; y: number }[]) =>
    pts
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${joinNums([num(p.x, 2), num(p.y, 2)])}`,
      )
      .join("") + "Z";
  const shapeTrack: Track = {
    times: model.times,
    values: model.frames.map(pathOf),
  };

  const [glow, shadow] = [
    ...SHAPE_FILTER_CSS.matchAll(/drop-shadow\(((?:[^()]|\([^()]*\))*)\)/g),
  ].map((m) => parseShadows(m[1]!, new Map())[0]!);
  if (!glow || !shadow)
    throw new Error(`${BILLBOARD_CSS}: expected two drop-shadow()s on .shape`);
  // CSS filter lists apply in sequence: the second drop-shadow shadows
  // the shape AND its first shadow. CSS blur radius = 2σ.
  const pad = hexRadius + 60;
  const defs: string[] = [
    `<path id="ub-shape-path" d="${pathOf(model.settled)}">${smil("d", shapeTrack)}</path>`,
    `<filter id="ub-shape" filterUnits="userSpaceOnUse" x="${-pad}" y="${-pad}" width="${2 * pad}" height="${2 * pad}" color-interpolation-filters="sRGB">` +
      `<feGaussianBlur in="SourceAlpha" stdDeviation="${glow.blur / 2}"/><feOffset dx="${glow.dx}" dy="${glow.dy}" result="b1"/><feFlood ${paintAttrs("flood-color", glow.paint)}/><feComposite in2="b1" operator="in" result="s1"/>` +
      `<feMerge result="m1"><feMergeNode in="s1"/><feMergeNode in="SourceGraphic"/></feMerge>` +
      `<feGaussianBlur in="m1" stdDeviation="${shadow.blur / 2}"/><feOffset dx="${shadow.dx}" dy="${shadow.dy}" result="b2"/><feFlood ${paintAttrs("flood-color", shadow.paint)}/><feComposite in2="b2" operator="in" result="s2"/>` +
      `<feMerge><feMergeNode in="s2"/><feMergeNode in="m1"/></feMerge></filter>`,
    `<radialGradient id="ub-inner-glow" cx="50%" cy="50%" r="${INNER_GLOW.r * 100}%"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="${INNER_GLOW.clearUntil}" stop-color="#000" stop-opacity="0"/><stop offset="1" ${paintAttrs("stop-color", pal.glass.stroke, INNER_GLOW.rimOpacity)}/></radialGradient>`,
  ];

  // Title text-shadow (--glass-text-shadow): shadows come from the glyph
  // coverage, not the text colour's alpha, so the glyphs are drawn
  // opaque and the text alpha is applied after the shadows are made.
  const shadows = pal.glass.textShadow;
  const titlePad = 60;
  defs.push(
    `<filter id="card-title-shadow" filterUnits="userSpaceOnUse" x="${-titlePad - 70}" y="${num(text.title.baseline - titlePad, 1)}" width="${2 * (titlePad + 70)}" height="${2 * titlePad}" color-interpolation-filters="sRGB">` +
      shadows
        .map(
          (s, i) =>
            `<feGaussianBlur in="SourceAlpha" stdDeviation="${s.blur / 2}"/><feOffset dx="${s.dx}" dy="${s.dy}" result="sb${i}"/><feFlood ${paintAttrs("flood-color", s.paint)}/><feComposite in2="sb${i}" operator="in" result="s${i}"/>`,
        )
        .join("") +
      `<feComponentTransfer in="SourceGraphic" result="text"><feFuncA type="linear" slope="${num(pal.glass.text.alpha, 3)}"/></feComponentTransfer>` +
      `<feMerge>${shadows.map((_, i) => `<feMergeNode in="s${shadows.length - 1 - i}"/>`).join("")}<feMergeNode in="text"/></feMerge></filter>`,
  );

  const fade = waypointTrack(
    [
      { t: 0, v: 1 },
      {
        t:
          COLLAPSE_START +
          REVERSE_DELAY_MS * (FINAL_STAGE - (CONTENT_MIN_STAGE - 1)),
        v: 1,
      },
      {
        t:
          COLLAPSE_START +
          REVERSE_DELAY_MS * (FINAL_STAGE - (CONTENT_MIN_STAGE - 1)) +
          CONTENT_FADE_MS,
        v: 0,
        spline: EASE_OUT_SPLINE,
      },
      {
        t:
          WIDEN_START +
          BILLBOARD_STAGE_DELAY * (CONTENT_MIN_STAGE - 1) +
          CONTENT_FADE_IN_DELAY_MS,
        v: 0,
      },
      {
        t:
          WIDEN_START +
          BILLBOARD_STAGE_DELAY * (CONTENT_MIN_STAGE - 1) +
          CONTENT_FADE_IN_DELAY_MS +
          CONTENT_FADE_MS,
        v: 1,
        spline: EASE_OUT_SPLINE,
      },
      { t: CYCLE_MS, v: 1 },
    ],
    (v) => num(v, 4),
  );

  const upm = (f: FKFont) => f.unitsPerEm;
  const pinpoints = model.frames[0]!.map((_, i) => {
    const tr: Track = {
      times: model.times,
      values: model.frames.map((f) => `${num(f[i]!.x, 2)} ${num(f[i]!.y, 2)}`),
    };
    const s = model.settled[i]!;
    return `<circle r="${BILLBOARD_PINPOINT_RADIUS}" transform="translate(${num(s.x, 2)} ${num(s.y, 2)})">${smil("transform", tr, "translate")}</circle>`;
  });
  const body =
    `<g transform="translate(${num(hexCx, 2)} ${num(yAt(1), 2)})">${smil("transform", move, "translate")}` +
    `<use href="#ub-shape-path" ${paintAttrs("fill", pal.glass.fill)} ${paintAttrs("stroke", pal.glass.stroke)} stroke-width="${BILLBOARD_STROKE_WIDTH}" stroke-linejoin="round" filter="url(#ub-shape)"/>` +
    `<use href="#ub-shape-path" fill="url(#ub-inner-glow)">${visibilitySmil(model.innerGlow)}</use>` +
    `<g ${paintAttrs("fill", pal.glass.stroke)}>${pinpoints.join("")}</g>` +
    `<g>${smil("opacity", fade)}` +
    `<g fill="${pal.glass.text.hex}" filter="url(#card-title-shadow)">${renderLine(bank, text.title.line, text.title.baseline, text.title.size, upm(fonts.monoTitle))}</g>` +
    `<g ${paintAttrs("fill", pal.glass.textMuted)}>${renderLine(bank, text.year.line, text.year.baseline, text.year.size, upm(fonts.monoYear))}</g>` +
    `<g ${paintAttrs("fill", pal.glass.textSecondary)}>${text.description.lines
      .map((l, i) =>
        renderLine(
          bank,
          l,
          text.description.baselines[i]!,
          text.description.size,
          upm(fonts.sans),
        ),
      )
      .join("")}</g>` +
    `</g></g>`;
  return { defs: defs.join("\n"), body };
}

// ═══ BreathingMesh ═════════════════════════════════════════════════
//
// BreathingMesh.tsx's lattice, rebuilt with its own RNG sequence and
// constants (buildLattice and mulberry32 are module-private, mirrored
// here). The card stands in for the capture's viewport (see
// OG_DEVICE_PIXEL_RATIO), in CSS px scaled by VIEWPORT_TO_CARD; the
// cutout is the globe stage's box, measured the way BreathingMesh
// measures it.
//
// The one adaptation: every dot drifts on the mean drift period (8.5s,
// the loop length) instead of its own random 6–11s period. Edges join
// drifting dots, and one shared period is what lets each edge pass be a
// single path keyframed over one loop (independent periods would need
// a separate animation per endpoint, several times the file). Each
// dot keeps its own random x and y phases, so the field still ripples
// rather than moving in unison.

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface LatticeDot {
  lx: number;
  ly: number;
  offsetX: number;
  offsetY: number;
  phaseX: number;
  phaseY: number;
  cutoutJitter: number;
}

function buildLattice(width: number, height: number, marginPx: number) {
  const dots: LatticeDot[] = [];
  const rowH = MESH_SPACING * (Math.sqrt(3) / 2);
  const marginCols = Math.ceil(marginPx / MESH_SPACING);
  const marginRows = Math.ceil(marginPx / rowH);
  const cols = Math.ceil(width / MESH_SPACING) + 2 + 2 * marginCols;
  const rows = Math.ceil(height / rowH) + 2 + 2 * marginRows;
  const rnd = mulberry32(MESH_SEED);
  const grid: number[][] = [];
  for (let rIdx = -1; rIdx < rows; rIdx++) {
    const r = rIdx - marginRows;
    const row: number[] = [];
    const evenRow = ((r % 2) + 2) % 2 === 0;
    const offset = evenRow ? 0 : MESH_SPACING / 2;
    for (let cIdx = -1; cIdx < cols; cIdx++) {
      const c = cIdx - marginCols;
      row.push(dots.length);
      // Same draw order as BreathingMesh's object literal.
      const offsetX = (rnd() - 0.5) * 2 * MESH_OFFSET_AMPLITUDE;
      const offsetY = (rnd() - 0.5) * 2 * MESH_OFFSET_AMPLITUDE;
      const phaseX = rnd();
      const phaseY = rnd();
      rnd(); // periodX — replaced by the shared period (see above)
      rnd(); // periodY
      const cutoutJitter = (rnd() - 0.5) * 2 * MESH_CUTOUT_JITTER;
      dots.push({
        lx: c * MESH_SPACING + offset,
        ly: r * rowH,
        offsetX,
        offsetY,
        phaseX,
        phaseY,
        cutoutJitter,
      });
    }
    grid.push(row);
  }
  const edges: [number, number][] = [];
  for (let gridR = 0; gridR < grid.length; gridR++) {
    const originalR = gridR - 1 - marginRows;
    const row = grid[gridR]!;
    const nextRow = grid[gridR + 1];
    for (let c = 0; c < row.length; c++) {
      const here = row[c]!;
      if (c + 1 < row.length) edges.push([here, row[c + 1]!]);
      if (!nextRow) continue;
      const evenRow = ((originalR % 2) + 2) % 2 === 0;
      const left = evenRow ? c - 1 : c;
      const right = evenRow ? c : c + 1;
      if (left >= 0 && left < nextRow.length)
        edges.push([here, nextRow[left]!]);
      if (right >= 0 && right < nextRow.length)
        edges.push([here, nextRow[right]!]);
    }
  }
  return { dots, edges };
}

const MESH_KEYFRAMES = 8;

function renderMesh(pal: Palette): string {
  if (!GFX.breathingMesh) return "";
  const p = VIEWPORT_TO_CARD;
  const vw = CARD_W / p;
  const vh = CARD_H / p;
  const { dots, edges } = buildLattice(
    vw,
    vh,
    Math.max(vw, vh) * MESH_LATTICE_MARGIN,
  );
  const zoom = USER_ZOOM;
  // Cutout: the globe stage's box (stageSize square, scaled) in viewport px.
  const cx = toCardX(STAGE_CENTER) / p;
  const cy = toCardY(STAGE_CENTER) / p;
  const cutoutR = ((STAGE_SIZE * STAGE_SCALE) / p / 2) * MESH_CUTOUT_TIGHTNESS;

  // Card-space positions per keyframe, in integer tenths of a px.
  const frames: Int32Array[] = [];
  for (let k = 0; k < MESH_KEYFRAMES; k++) {
    const phase = k / MESH_KEYFRAMES;
    const out = new Int32Array(dots.length * 2);
    dots.forEach((d, i) => {
      let x =
        (d.lx - cx) * zoom +
        cx +
        d.offsetX +
        Math.sin((phase + d.phaseX) * Math.PI * 2) * MESH_DRIFT_AMPLITUDE;
      let y =
        (d.ly - cy) * zoom +
        cy +
        d.offsetY +
        Math.sin((phase + d.phaseY) * Math.PI * 2) * MESH_DRIFT_AMPLITUDE;
      const rEff = cutoutR + d.cutoutJitter;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < rEff) {
        if (dist === 0) x = cx + rEff;
        else {
          x = cx + (dx * rEff) / dist;
          y = cy + (dy * rEff) / dist;
        }
      }
      out[i * 2] = Math.round(x * p * 10);
      out[i * 2 + 1] = Math.round(y * p * 10);
    });
    frames.push(out);
  }
  const X = (f: Int32Array, i: number) => f[i * 2]! / 10;
  const Y = (f: Int32Array, i: number) => f[i * 2 + 1]! / 10;
  const dotR = MESH_DOT_RADIUS * p;
  const inCard = (i: number, m: number) =>
    frames.some(
      (f) =>
        X(f, i) >= -m &&
        X(f, i) <= CARD_W + m &&
        Y(f, i) >= -m &&
        Y(f, i) <= CARD_H + m,
    );

  // Edges: skipped when stretched past the limit (cutout push), decided
  // per keyframe; an edge is drawn if it holds in most of them.
  const stretch = (MESH_SPACING * zoom * MESH_STRETCH_FACTOR * p) ** 2;
  const kept: [number, number][] = [];
  for (const [a, b] of edges) {
    let ok = 0;
    let visible = false;
    for (const f of frames) {
      const dx = X(f, a) - X(f, b);
      const dy = Y(f, a) - Y(f, b);
      if (dx * dx + dy * dy <= stretch) ok++;
      const minX = Math.min(X(f, a), X(f, b));
      const maxX = Math.max(X(f, a), X(f, b));
      const minY = Math.min(Y(f, a), Y(f, b));
      const maxY = Math.max(Y(f, a), Y(f, b));
      if (maxX >= 0 && minX <= CARD_W && maxY >= 0 && minY <= CARD_H)
        visible = true;
    }
    if (visible && ok * 2 > frames.length) kept.push([a, b]);
  }

  // Chain edges into polylines (one canvas stroke = one SVG path).
  const adj = new Map<number, number[]>();
  const edgeKey = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);
  const unused = new Set<string>();
  for (const [a, b] of kept) {
    adj.set(a, [...(adj.get(a) ?? []), b]);
    adj.set(b, [...(adj.get(b) ?? []), a]);
    unused.add(edgeKey(a, b));
  }
  const remainingDegree = (n: number) =>
    (adj.get(n) ?? []).filter((m) => unused.has(edgeKey(n, m))).length;
  const f0 = frames[0]!;
  const chains: number[][] = [];
  while (unused.size) {
    let startNode = -1;
    for (const n of adj.keys()) {
      const deg = remainingDegree(n);
      if (deg % 2 === 1) {
        startNode = n;
        break;
      }
      if (deg > 0 && startNode < 0) startNode = n;
    }
    const chain = [startNode];
    let cur = startNode;
    let dir: [number, number] | null = null;
    for (;;) {
      const options = (adj.get(cur) ?? []).filter((m) =>
        unused.has(edgeKey(cur, m)),
      );
      if (!options.length) break;
      let best = options[0]!;
      if (dir) {
        let bestDot = -Infinity;
        for (const m of options) {
          const vx = X(f0, m) - X(f0, cur);
          const vy = Y(f0, m) - Y(f0, cur);
          const dotp = (vx * dir[0] + vy * dir[1]) / (Math.hypot(vx, vy) || 1);
          if (dotp > bestDot) {
            bestDot = dotp;
            best = m;
          }
        }
      }
      unused.delete(edgeKey(cur, best));
      const vx = X(f0, best) - X(f0, cur);
      const vy = Y(f0, best) - Y(f0, cur);
      const len = Math.hypot(vx, vy) || 1;
      dir = [vx / len, vy / len];
      chain.push(best);
      cur = best;
    }
    chains.push(chain);
  }
  const tenths = (n: number) => num(n / 10, 1);
  const edgePath = (f: Int32Array) =>
    chains
      .map((chain) => {
        const parts = [
          tenths(f[chain[0]! * 2]!),
          tenths(f[chain[0]! * 2 + 1]!),
        ];
        const rel: string[] = [];
        for (let i = 1; i < chain.length; i++) {
          rel.push(
            tenths(f[chain[i]! * 2]! - f[chain[i - 1]! * 2]!),
            tenths(f[chain[i]! * 2 + 1]! - f[chain[i - 1]! * 2 + 1]!),
          );
        }
        return "M" + joinNums(parts) + "l" + joinNums(rel);
      })
      .join("");

  // Dots: canvas fills each dot separately, so overlapping dots stack
  // their alpha. Dots that ever overlap go in different paths.
  const meshDots = dots.map((_, i) => i).filter((i) => inCard(i, dotR + 1));
  const groups: number[][] = [];
  const cell = new Map<string, number[]>();
  const cellOf = (x: number, y: number) =>
    `${Math.floor(x / 4)},${Math.floor(y / 4)}`;
  const groupOf = new Map<number, number>();
  for (const i of meshDots) {
    const neighbours = new Set<number>();
    for (const f of frames) {
      const gx = Math.floor(X(f, i) / 4);
      const gy = Math.floor(Y(f, i) / 4);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (const j of cell.get(`${gx + ox},${gy + oy}`) ?? []) {
            if (Math.hypot(X(f, i) - X(f, j), Y(f, i) - Y(f, j)) < 2 * dotR)
              neighbours.add(groupOf.get(j)!);
          }
        }
      }
    }
    let g = 0;
    while (neighbours.has(g)) g++;
    groupOf.set(i, g);
    (groups[g] ??= []).push(i);
    for (const f of frames) {
      const key = cellOf(X(f, i), Y(f, i));
      const list = cell.get(key) ?? [];
      if (!list.includes(i)) list.push(i);
      cell.set(key, list);
    }
  }
  const dotPath = (group: number[], f: Int32Array) =>
    group
      .map(
        (i) =>
          "M" + joinNums([tenths(f[i * 2]!), tenths(f[i * 2 + 1]!)]) + "h0",
      )
      .join("");

  const loopTimes = Array.from(
    { length: MESH_KEYFRAMES + 1 },
    (_, k) => (CYCLE_MS * k) / MESH_KEYFRAMES,
  );
  const loop = (render: (f: Int32Array) => string): Track => ({
    times: loopTimes,
    values: [...frames, frames[0]!].map(render),
  });
  const c = pal.mutedForeground;
  return [
    `<path fill="none" stroke="${c.hex}" stroke-opacity="${MESH_EDGE_ALPHA}" stroke-width="${num(p, 3)}" stroke-linejoin="bevel" d="${edgePath(f0)}">${smil("d", loop(edgePath))}</path>`,
    ...groups.map(
      (group) =>
        `<path fill="none" stroke="${c.hex}" stroke-opacity="${MESH_DOT_ALPHA}" stroke-width="${num(2 * dotR, 3)}" stroke-linecap="round" d="${dotPath(group, f0)}">${smil(
          "d",
          loop((f) => dotPath(group, f)),
        )}</path>`,
    ),
  ].join("\n");
}

// ═══ Assembly ═══════════════════════════════════════════════════════

/**
 * The line box strut under the billboard: the card wrapper's block
 * contains the inline-block billboard on a line of the body font, so
 * the wrapper is taller than the billboard by the strut's depth below
 * the baseline (half-leading + descent).
 */
function billboardStrut(
  fonts: Fonts,
  body: { sizePx: number; lineHeight: number },
): number {
  const m = lineMetrics(fonts.sans, body.sizePx);
  const lineBox = body.sizePx * body.lineHeight;
  return m.descent + (lineBox - (m.ascent + m.descent)) / 2;
}

function bodyTypography(): { sizePx: number; lineHeight: number } {
  const css = source(GLOBALS_CSS);
  const body = cssDeclarations(cssBlockBody(css, css.indexOf("\n  body {")));
  const size = body.get("font-size");
  const lh = body.get("line-height");
  if (!size?.endsWith("rem") || !lh)
    throw new Error(`${GLOBALS_CSS}: body font-size/line-height not found`);
  return { sizePx: parseFloat(size) * 16, lineHeight: parseFloat(lh) };
}

async function main() {
  const palettes = buildPalettes();
  const fonts = await loadFonts();
  const body = bodyTypography();
  const hexRadius = SPHERE_RADIUS * HEX_RADIUS_RATIO;
  const strut = billboardStrut(fonts, body);
  const globe = buildGlobeModel();
  const billboard = buildBillboardModel(hexRadius);

  mkdirSync(OUT_DIR, { recursive: true });
  for (const theme of ["dark", "light"] as Theme[]) {
    const pal = palettes[theme];
    const bank = new GlyphBank(
      new Map([
        [fonts.monoTitle, "mt"],
        [fonts.monoYear, "my"],
        [fonts.sans, "s"],
      ]),
    );
    const text = layoutCardText(bank, fonts, hexRadius, body);
    const g = renderGlobe(globe, pal);
    const cone = renderCone(globe.anchor, pal);
    const card = renderBillboard(
      billboard,
      text,
      bank,
      fonts,
      globe.anchor,
      strut,
      pal,
    );
    const mesh = renderMesh(pal);
    const label = `${CARD_ENTRY.title} — ${CARD_ENTRY.description}`;
    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${num(CARD_H, 2)}" width="${CARD_W}" height="${num(CARD_H, 2)}" role="img" aria-labelledby="card-title">`,
      `<title id="card-title">${escapeXml(label)}</title>`,
      `<!-- Generated by scripts/build-readme-card.ts (${theme}). Do not edit by hand: run \`pnpm build:readme-card\`. -->`,
      `<defs>`,
      g.defs,
      cone.defs,
      card.defs,
      `<g id="glyphs">${bank.renderDefs()}</g>`,
      `<clipPath id="card-frame"><rect width="${CARD_W}" height="${num(CARD_H, 2)}" rx="${num(FRAME_RADIUS, 2)}" ry="${num(FRAME_RADIUS, 2)}"/></clipPath>`,
      `</defs>`,
      `<g clip-path="url(#card-frame)">`,
      `<rect width="${CARD_W}" height="${num(CARD_H, 2)}" fill="${pal.background.hex}"/>`,
      mesh,
      `<g transform="matrix(${num(STAGE_SCALE, 5)} 0 0 ${num(STAGE_SCALE, 5)} ${num(STAGE_OFFSET.x, 3)} ${num(STAGE_OFFSET.y, 3)})">`,
      g.body,
      cone.body,
      card.body,
      `</g>`,
      `</g>`,
      `<rect x="${num(FRAME_STROKE / 2, 3)}" y="${num(FRAME_STROKE / 2, 3)}" width="${num(CARD_W - FRAME_STROKE, 3)}" height="${num(CARD_H - FRAME_STROKE, 3)}" rx="${num(FRAME_RADIUS - FRAME_STROKE / 2, 3)}" ry="${num(FRAME_RADIUS - FRAME_STROKE / 2, 3)}" fill="none" stroke="${FRAME_STROKE_COLOR[theme]}" stroke-width="${num(FRAME_STROKE, 3)}"/>`,
      `</svg>`,
      "",
    ].join("\n");
    const out = resolve(OUT_DIR, `museum-card-${theme}.svg`);
    writeFileSync(out, svg);
    console.log(
      `wrote ${relative(projectRoot, out)} (${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB)`,
    );
  }
  console.log(
    `loop ${CYCLE_MS / 1000}s: open ${num(HOLD_MS / 1000, 2)}s → collapsing ${COLLAPSING_MS}ms → coneFalling ${CONE_FALL_MS}ms → swinging ${ANCHOR_SWING_MS}ms → coneRising ${CONE_RISE_MS}ms → widening ${WIDENING_MS}ms; ` +
      `${globe.faces.length} faces, ${globe.dots.length} dots, ${billboard.times.length} card keyframes`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
