"use client";

/**
 * Breathing triangular-mesh background.
 *
 * Canvas implementation. We tried SVG with CSS transitions on cx/cy +
 * x1/y1/x2/y2, but line endpoints don't reliably transition as CSS
 * properties across browsers. Canvas with a persistent rAF loop redraws
 * dots AND edges every frame, with an eased animation in JS driving the
 * cutout open/close — both transition in perfect lockstep because the
 * same frame draws both.
 *
 *   - Triangular lattice of dots (each dot ↔ right neighbor + one
 *     left-down + one right-down → proper alternating triangles)
 *   - Mild static per-dot offset gives a hand-drawn feel
 *   - When `cutoutTarget` is set, dots inside the radius are pushed
 *     radially outward to the rim; edges follow their endpoints because
 *     positions are computed once per frame and reused for both passes.
 *   - The rAF loop mounts once and reads all dynamic state via refs so
 *     prop changes never tear it down.
 */

import { useEffect, useRef } from "react";

interface BreathingMeshProps {
  cutoutTarget: React.RefObject<HTMLElement | null> | null;
  cutoutRadius?: number;
}

const SPACING = 68;
const DOT_RADIUS = 1.6;
const OFFSET_AMPLITUDE = 8;
// Mild per-dot live drift on top of the static offset. Amplitude is in px,
// period is in ms; each dot has its own randomized phase + period so the
// mesh ripples instead of all dots moving in unison.
const DRIFT_AMPLITUDE = 2.5;
const DRIFT_PERIOD_MIN = 6000;
const DRIFT_PERIOD_MAX = 11000;

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

interface Dot {
  lx: number;
  ly: number;
  offsetX: number;
  offsetY: number;
  // Per-dot drift parameters for the breathing animation.
  phaseX: number; // 0..1, fraction of periodX
  phaseY: number;
  periodX: number; // ms
  periodY: number;
}

interface Lattice {
  dots: Dot[];
  edges: [number, number][];
}

function buildLattice(width: number, height: number): Lattice {
  const dots: Dot[] = [];
  const rowH = SPACING * (Math.sqrt(3) / 2);
  const cols = Math.ceil(width / SPACING) + 2;
  const rows = Math.ceil(height / rowH) + 2;
  const rnd = mulberry32(1);
  const grid: number[][] = [];

  for (let r = -1; r < rows; r++) {
    const row: number[] = [];
    const evenRow = ((r % 2) + 2) % 2 === 0;
    const offset = evenRow ? 0 : SPACING / 2;
    for (let c = -1; c < cols; c++) {
      row.push(dots.length);
      dots.push({
        lx: c * SPACING + offset,
        ly: r * rowH,
        offsetX: (rnd() - 0.5) * 2 * OFFSET_AMPLITUDE,
        offsetY: (rnd() - 0.5) * 2 * OFFSET_AMPLITUDE,
        phaseX: rnd(),
        phaseY: rnd(),
        periodX:
          DRIFT_PERIOD_MIN + rnd() * (DRIFT_PERIOD_MAX - DRIFT_PERIOD_MIN),
        periodY:
          DRIFT_PERIOD_MIN + rnd() * (DRIFT_PERIOD_MAX - DRIFT_PERIOD_MIN),
      });
    }
    grid.push(row);
  }

  const edges: [number, number][] = [];
  // gridR is the array index into `grid`. The corresponding ORIGINAL row
  // counter in the dot loop above was gridR - 1 (we started at r=-1).
  // Parity uses originalR — that's what determines the lattice shift.
  for (let gridR = 0; gridR < grid.length; gridR++) {
    const originalR = gridR - 1;
    const row = grid[gridR]!;
    const nextRow = grid[gridR + 1];
    for (let c = 0; c < row.length; c++) {
      const here = row[c]!;
      if (c + 1 < row.length) edges.push([here, row[c + 1]!]);
      if (!nextRow) continue;
      // Each dot gets one left-down and one right-down edge.
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

export function BreathingMesh({
  cutoutTarget,
  cutoutRadius,
}: BreathingMeshProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const edgesRef = useRef<[number, number][]>([]);
  const dpiRef = useRef(1);

  // Dynamic inputs via refs so the rAF loop never restarts on prop change.
  // The cutout's animated radius doesn't live here anymore — the consumer
  // animates the target ELEMENT's own bbox (via CSS transform: scale), and
  // we just measure whatever rect it has each frame. Lockstep without us
  // having to mirror the CSS easing curve in JS.
  const cutoutTargetRef = useRef(cutoutTarget);
  const cutoutRadiusRef = useRef(cutoutRadius);
  useEffect(() => {
    cutoutTargetRef.current = cutoutTarget;
    cutoutRadiusRef.current = cutoutRadius;
  });

  // Resize + lattice (re-runs only on window resize).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleResize = () => {
      const dpi = window.devicePixelRatio || 1;
      dpiRef.current = dpi;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpi;
      canvas.height = h * dpi;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const { dots, edges } = buildLattice(w, h);
      dotsRef.current = dots;
      edgesRef.current = edges;
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Animation loop — mounted ONCE for the lifetime of the component.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame: number;
    const positions: number[] = []; // [x0, y0, x1, y1, ...]

    const render = (now: number) => {
      const dpi = dpiRef.current;

      // Measure cutout target each frame. The target stays MOUNTED across
      // view changes — the consumer just transforms it (scale 0/1), so the
      // bounding rect shrinks/grows live. Reading it every frame gives a
      // lockstep cutout animation without any JS easing on our side.
      let cx = 0;
      let cy = 0;
      let r = 0;
      const targetEl = cutoutTargetRef.current?.current;
      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        cx = rect.left + rect.width / 2;
        cy = rect.top + rect.height / 2;
        // Default: half the target's smaller dimension. As the consumer
        // scales the target via CSS transform, getBoundingClientRect()
        // returns the post-transform size, so r shrinks/grows in lockstep
        // with the CSS animation. No JS easing needed.
        //
        // If `cutoutRadius` was passed explicitly, we still want to track
        // the target's CSS scale so the cutout shrinks when the globe
        // does — read the scale from the computed transform matrix.
        if (cutoutRadiusRef.current !== undefined) {
          const m = new DOMMatrixReadOnly(getComputedStyle(targetEl).transform);
          const scale = Math.hypot(m.a, m.b) || 0;
          r = cutoutRadiusRef.current * scale;
        } else {
          r = Math.min(rect.width, rect.height) / 2;
        }
      }

      const color = getComputedStyle(document.documentElement)
        .getPropertyValue("--muted-foreground")
        .trim();
      const stroke = color || "#888";

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpi, 0, 0, dpi, 0, 0);

      // Pass 1: compute final position for each dot
      // Position = lattice + static offset + live sine drift + cutout push.
      // Each dot has its own phase/period so the field ripples instead of
      // moving in unison.
      const dots = dotsRef.current;
      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i]!;
        const driftX =
          Math.sin((now / dot.periodX + dot.phaseX) * Math.PI * 2) *
          DRIFT_AMPLITUDE;
        const driftY =
          Math.sin((now / dot.periodY + dot.phaseY) * Math.PI * 2) *
          DRIFT_AMPLITUDE;
        let x = dot.lx + dot.offsetX + driftX;
        let y = dot.ly + dot.offsetY + driftY;
        if (r > 0) {
          const dx = x - cx;
          const dy = y - cy;
          const d = Math.hypot(dx, dy);
          if (d < r) {
            if (d === 0) {
              x = cx + r;
            } else {
              const scale = r / d;
              x = cx + dx * scale;
              y = cy + dy * scale;
            }
          }
        }
        positions[i * 2] = x;
        positions[i * 2 + 1] = y;
      }

      // Pass 2: edges (below dots so dots cap line joins).
      ctx.strokeStyle = stroke;
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const edges = edgesRef.current;
      for (let i = 0; i < edges.length; i++) {
        const [a, b] = edges[i]!;
        ctx.moveTo(positions[a * 2]!, positions[a * 2 + 1]!);
        ctx.lineTo(positions[b * 2]!, positions[b * 2 + 1]!);
      }
      ctx.stroke();

      // Pass 3: dots on top.
      ctx.fillStyle = stroke;
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < dots.length; i++) {
        ctx.beginPath();
        ctx.arc(
          positions[i * 2]!,
          positions[i * 2 + 1]!,
          DOT_RADIUS,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }

      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
      }}
    />
  );
}
