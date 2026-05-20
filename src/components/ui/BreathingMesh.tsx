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

// Cascade-in choreography (first-mount only).
// Wavefront-comb model: a single diagonal line `x + y = p(t)` sweeps
// from upper-left to lower-right across the lattice over the intro
// duration. Every undeposited dot rides the wavefront at its OWN
// perpendicular coordinate (lx - ly), so the in-flight dots form a
// diagonal band coherent with the sweep — not a scattered cloud.
// When the wavefront's parallel position reaches a dot's target
// projection (lx + ly), that dot deposits at (lx, ly) and stops.
//
// Math:
//   parallel coord (along (1,1) sweep direction)      = x + y
//   perpendicular coord (along the wavefront line)    = x - y
//   wavefront at time t is the locus { (x, y) : x + y = p(t) }
//   p(t) ramps linearly from p_min - p_min_lead to p_max
//
// CASCADE_LEAD_PX is how far PAST the smallest projection the
// wavefront starts — i.e. how much "empty diagonal" exists before
// any dot has deposited. Setting this larger means the leading
// edge of the wavefront begins off-screen and sweeps in, rather
// than starting with the upper-left dot already deposited.
const CASCADE_DURATION_MS = 2200;
const CASCADE_LEAD_PX = 400;
// Per-dot pseudo-random jitter on cascadeDepositAt, in ms. Spreads
// deposit times by ±this amount so dots don't all land at the same
// moment along the strict wavefront line.
const CASCADE_JITTER_MS = 350;
// Per-dot offset along the SWEEP direction (variance in lx+ly basis)
// applied during transit. The offset is maximum at cascadeElapsed=0
// and shrinks linearly to 0 by the dot's cascadeDepositAt — so each
// dot rides slightly AHEAD of or BEHIND the strict wavefront line,
// easing back to the line by deposit time. Without this, every
// undeposited dot sits exactly on `x + y = pNow`, producing a
// knife-edge "comb spine" with no thickness in the sweep direction.
// Spreading dots ahead/behind the line gives the wavefront a real
// band thickness — what looks like a bunched cluster sweeping in.
const CASCADE_PARALLEL_PX = 250;
// Note: easing was removed when the model switched from per-dot
// transit to wavefront-comb sweep. Eased sweeps work but require
// redefining cascadeDepositAt against the inverse of the easing
// curve so the visual "wavefront passes my projection" moment
// aligns with the dot's expected deposit time. Re-add a curve here
// and apply it to `progress` in the render-loop branch when ready.

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
  // Cascade-in: absolute time (ms from cascade-zero) at which this
  // dot's lattice position is reached by the diagonal wavefront.
  // Before this time, the dot rides the wavefront at its own
  // perpendicular coordinate. After this time, it sits at its
  // lattice position. Set at lattice build time from the dot's
  // diagonal projection (lx + ly).
  cascadeDepositAt: number;
  // Per-dot offset along the SWEEP direction applied during transit.
  // The dot rides a wavefront at pNow + cascadeParallelOffset ×
  // remaining (where `remaining` is 1 at t=0 and 0 at deposit), so
  // it sits slightly ahead of or behind the strict wavefront line.
  // The offset eases back to 0 by deposit time so the dot still
  // lands precisely at (lx, ly).
  cascadeParallelOffset: number;
}

interface Lattice {
  dots: Dot[];
  edges: [number, number][];
  // Wavefront sweep bounds in screen units. The wavefront's parallel
  // position p(t) runs from pStart (off-screen leading edge) at t=0
  // to pEnd (after the last dot deposits) at t=CASCADE_DURATION_MS.
  pStart: number;
  pEnd: number;
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
        // Filled in by the normalization pass after the loop.
        cascadeDepositAt: 0,
        cascadeParallelOffset: 0,
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

  // Wavefront-comb cascade: the wavefront is the line { x + y = p(t) }
  // sweeping from upper-left to lower-right. We compute the sweep
  // bounds (pStart, pEnd) and stamp each dot's depositAt time based
  // on when the wavefront's parallel position reaches that dot's
  // diagonal projection.
  //
  //   pStart = minProj - CASCADE_LEAD_PX
  //     The wavefront begins behind the closest dot, so even the
  //     upper-left dot has some lead-in time on the wave before
  //     being deposited (otherwise it would deposit at t=0).
  //   pEnd   = maxProj
  //     Sweep ends exactly when the last dot deposits.
  //
  // depositAt = (proj - pStart) / (pEnd - pStart) × CASCADE_DURATION_MS
  let minProj = Infinity;
  let maxProj = -Infinity;
  for (let i = 0; i < dots.length; i++) {
    const d = dots[i]!;
    const proj = d.lx + d.ly;
    if (proj < minProj) minProj = proj;
    if (proj > maxProj) maxProj = proj;
  }
  const pStart = minProj - CASCADE_LEAD_PX;
  const pEnd = maxProj;
  const pRange = pEnd - pStart || 1;
  // Separate seed for cascade noise so it doesn't perturb the
  // breathing-drift RNG state. Deterministic per-dot via index.
  const cascadeRnd = mulberry32(7);
  for (let i = 0; i < dots.length; i++) {
    const d = dots[i]!;
    const proj = d.lx + d.ly;
    const baseDeposit = ((proj - pStart) / pRange) * CASCADE_DURATION_MS;
    const jitter = (cascadeRnd() - 0.5) * 2 * CASCADE_JITTER_MS;
    // Clamp: a dot's deposit time must be within the sweep window so
    // it's never asked to "ride" the wavefront past pEnd or before
    // pStart — either would push it off-screen permanently.
    d.cascadeDepositAt = Math.max(
      0,
      Math.min(CASCADE_DURATION_MS, baseDeposit + jitter),
    );
    d.cascadeParallelOffset = (cascadeRnd() - 0.5) * 2 * CASCADE_PARALLEL_PX;
  }

  return { dots, edges, pStart, pEnd };
}

export function BreathingMesh({
  cutoutTarget,
  cutoutRadius,
}: BreathingMeshProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const edgesRef = useRef<[number, number][]>([]);
  const dpiRef = useRef(1);
  // Wavefront sweep bounds, updated on lattice rebuild.
  const pStartRef = useRef(0);
  const pEndRef = useRef(0);
  // True once the cascade-in choreography has completed for the lifetime
  // of this component instance. Used to suppress replays on lattice
  // rebuild (window resize) — the cascade is a "welcome" motion, not a
  // resize motion.
  const cascadeCompleteRef = useRef(false);
  // Holds the latest handleResize closure so the render loop can call
  // it when it detects a viewport-dimension change. None of resize /
  // visualViewport.resize / matchMedia change events fire reliably on
  // every browser/OS combination during browser-zoom (Ctrl +/-), so
  // we treat them as best-effort and supplement with per-frame
  // polling of innerWidth + devicePixelRatio in the render loop.
  const handleResizeRef = useRef<() => void>(() => {});

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
      // Floor the effective DPR at 1.0 so the canvas's backing store
      // always has AT LEAST as many device pixels as the CSS box.
      // Browser zoom-out drives devicePixelRatio below 1 (e.g. 0.22
      // at extreme zoom-out), which would otherwise give the canvas
      // a tiny backing store that the browser then UPSCALES into the
      // CSS box — visibly blurry/smeared mesh strokes. Capping at 1
      // means we render an oversized backing store the GPU downscales
      // cleanly into the visible area; lines stay crisp regardless
      // of zoom. The native DPR is still used at >=1 (HiDPI displays)
      // so retina sharpness is preserved.
      const dpi = Math.max(window.devicePixelRatio || 1, 1);
      dpiRef.current = dpi;
      // window.innerWidth/Height reports the layout viewport in CSS
      // pixels, which is what we want for canvas sizing under both
      // window resize AND browser-level zoom (Ctrl +/-). Do NOT use
      // visualViewport.width/height here — those report the VISUAL
      // viewport, which on browser-zoom is smaller than the layout
      // viewport, producing a canvas that's too small and gets
      // stretched by `position: fixed; inset: 0` CSS, resulting in
      // a visibly stretched mesh outside the original 100% bounds.
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpi;
      canvas.height = h * dpi;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const { dots, edges, pStart, pEnd } = buildLattice(w, h);
      // If the cascade has already played out, any rebuild (e.g. window
      // resize) should NOT replay it. Sentinel each dot's cascadeDepositAt
      // to a negative value so it reads as "already deposited" — the
      // dot falls straight through to the glide system and appears at
      // its lattice position immediately.
      if (cascadeCompleteRef.current) {
        for (const d of dots) d.cascadeDepositAt = -1;
      }
      dotsRef.current = dots;
      edgesRef.current = edges;
      pStartRef.current = pStart;
      pEndRef.current = pEnd;
    };
    handleResizeRef.current = handleResize;
    handleResize();
    window.addEventListener("resize", handleResize);
    // Browser zoom (Ctrl/Cmd-+/-) changes devicePixelRatio without
    // always firing a window resize event. visualViewport.resize
    // fires on those changes; a matchMedia listener on the current
    // DPR covers the corner case where neither fires (recreate the
    // listener after each handleResize so it tracks the new DPR).
    let mqList: MediaQueryList | null = null;
    const subscribeMq = () => {
      if (mqList) mqList.removeEventListener("change", onMqChange);
      mqList = window.matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
      mqList.addEventListener("change", onMqChange);
    };
    const onMqChange = () => {
      handleResize();
      subscribeMq();
    };
    subscribeMq();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      vv?.removeEventListener("resize", handleResize);
      mqList?.removeEventListener("change", onMqChange);
    };
  }, []);

  // Animation loop — mounted ONCE for the lifetime of the component.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame: number;
    // `positions` is the RENDERED position per frame (what we draw).
    // `targetPositions` is the computed target — lattice + drift + cutout
    // + dodge. Each frame we ease `positions` toward `targetPositions` via
    // a per-frame exponential decay so sudden target changes (a card
    // scrolling past a dot, a dot transitioning between dodge regions)
    // read as a smooth glide instead of a hard snap.
    const positions: number[] = []; // [x0, y0, x1, y1, ...]
    const targetPositions: number[] = [];
    let lastFrameTime = performance.now();
    // Per-frame viewport-dimension poll. The resize/visualViewport.resize/
    // matchMedia change listeners are best-effort: in practice they don't
    // all fire reliably on Ctrl+/Ctrl- browser zoom across all browser/OS
    // combos. Polling innerWidth + devicePixelRatio every frame catches
    // any change the listeners miss. Costs two property reads per frame —
    // negligible. The handleResizeRef.current call is the SAME logic the
    // listeners trigger, so dimensions stay coherent across all paths.
    let lastInnerWidth = window.innerWidth;
    let lastInnerHeight = window.innerHeight;
    let lastDpr = window.devicePixelRatio;
    // First-frame timestamp for the cascade-in choreography. The
    // wavefront's parallel position sweeps from pStart to pEnd over
    // CASCADE_DURATION_MS, with each dot depositing at the moment
    // the wavefront reaches its diagonal projection. Captured on the
    // first render frame so cascade timing aligns with actual paint,
    // not component mount (which can precede first paint by several
    // frames during heavy initial layout).
    let cascadeStartedAt = 0;
    // Fraction of remaining distance to close per millisecond. Higher
    // values = snappier glide. Tuned by feel: at 0.012/ms, ~80% of any
    // delta closes in ~130ms — fast enough to feel responsive when
    // scrolling, slow enough to mask the hard rect-edge snap.
    const GLIDE_RATE = 0.012;
    // Padded rects for any element tagged with [data-mesh-dodge]. Dots
    // inside these rects get pushed to the nearest edge so the foreground
    // breathes too — used by list cards. Refreshed once per frame so we
    // pick up scroll, resize, and view-toggle transitions for free.
    let dodgeRects: {
      left: number;
      top: number;
      right: number;
      bottom: number;
    }[] = [];
    const DODGE_PADDING = 18;

    const render = (now: number) => {
      // Per-frame viewport-dimension poll. Catches Ctrl+/Ctrl- browser
      // zoom that didn't fire any of the resize/visualViewport/matchMedia
      // listeners — the user's particular browser+OS may emit zero
      // resize events across a long sequence of zoom keystrokes, and
      // without polling the canvas's backing store stays stuck at the
      // pre-zoom dimensions while CSS stretches it to fill the new
      // viewport, producing a smeared/repeated mesh artifact.
      const curW = window.innerWidth;
      const curH = window.innerHeight;
      const curDpr = window.devicePixelRatio;
      if (
        curW !== lastInnerWidth ||
        curH !== lastInnerHeight ||
        curDpr !== lastDpr
      ) {
        lastInnerWidth = curW;
        lastInnerHeight = curH;
        lastDpr = curDpr;
        handleResizeRef.current();
      }

      const dpi = dpiRef.current;

      // Collect dodge rects this frame. Selector cost: one querySelectorAll
      // + N getBoundingClientRect calls. With ~28 list cards that's ~30
      // calls — well under 1ms.
      //
      // `checkVisibility` with opacity + visibility flags is what makes
      // the collapsed-list case work: list cards still have full width
      // and height when the list mount is `opacity: 0` + `max-height: 0`
      // + `overflow: hidden` (only the ancestor clips them, not the
      // cards themselves), so the rect-zero guard alone isn't enough.
      // checkVisibility() returns false for elements whose ancestor
      // chain renders them invisible, which is exactly the gate we want.
      const dodgeEls = document.querySelectorAll("[data-mesh-dodge]");
      dodgeRects = [];
      for (const el of dodgeEls) {
        const html = el as HTMLElement;
        if (
          !html.checkVisibility({
            opacityProperty: true,
            visibilityProperty: true,
            contentVisibilityAuto: true,
          })
        ) {
          continue;
        }
        const rect = html.getBoundingClientRect();
        // Backstop for elements with zero rect (e.g. mid-collapse from
        // an in-flight transition) — checkVisibility may still report
        // true while the layout is settling.
        if (rect.width < 1 || rect.height < 1) continue;
        dodgeRects.push({
          left: rect.left - DODGE_PADDING,
          top: rect.top - DODGE_PADDING,
          right: rect.right + DODGE_PADDING,
          bottom: rect.bottom + DODGE_PADDING,
        });
      }

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
        // Card dodge: for each dodge rect we contain, push the dot to the
        // nearest edge of that rect. Multiple rects compound naturally —
        // a dot pushed out of card A may still be inside card B and gets
        // pushed again. With list spacing this is rare and visually fine.
        for (let k = 0; k < dodgeRects.length; k++) {
          const rc = dodgeRects[k]!;
          if (x > rc.left && x < rc.right && y > rc.top && y < rc.bottom) {
            // Pick the nearest edge (min penetration depth) and snap to it.
            const dLeft = x - rc.left;
            const dRight = rc.right - x;
            const dTop = y - rc.top;
            const dBottom = rc.bottom - y;
            const m = Math.min(dLeft, dRight, dTop, dBottom);
            if (m === dLeft) x = rc.left;
            else if (m === dRight) x = rc.right;
            else if (m === dTop) y = rc.top;
            else y = rc.bottom;
          }
        }
        targetPositions[i * 2] = x;
        targetPositions[i * 2 + 1] = y;
      }

      // Capture cascade start timestamp on the very first frame. Doing
      // this in the render loop (vs. at effect mount) aligns the cascade
      // with first paint, so the cascade begins as the canvas appears
      // rather than during whatever pre-paint layout work was happening.
      if (cascadeStartedAt === 0) {
        cascadeStartedAt = now;
      }
      const cascadeElapsed = now - cascadeStartedAt;
      // Flip the "cascade complete" flag once every dot has deposited.
      // With ±CASCADE_JITTER_MS applied to each dot's depositAt, the
      // last dot can arrive up to CASCADE_JITTER_MS past the strict
      // wavefront end — so wait that long before declaring done.
      if (
        !cascadeCompleteRef.current &&
        cascadeElapsed >= CASCADE_DURATION_MS + CASCADE_JITTER_MS
      ) {
        cascadeCompleteRef.current = true;
      }

      // Pass 1.5: position each dot.
      //   - Cascade phase: rendered position = lerp(origin → target, eased(progress)).
      //     The glide system is bypassed for dots still in transit so
      //     the cascade curve isn't fought by exponential decay.
      //   - Post-cascade: standard glide toward targetPositions, with
      //     the same first-frame "snap to target" guard as before.
      //
      // Edges read these rendered positions, so during cascade they
      // connect dots at their CURRENT positions — long lines trail
      // behind the wavefront and resolve into the final lattice as
      // each pair of endpoints completes its transit.
      const dt = Math.max(1, Math.min(100, now - lastFrameTime));
      lastFrameTime = now;
      const factor = 1 - Math.exp(-GLIDE_RATE * dt);
      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i]!;
        const tx = targetPositions[i * 2]!;
        const ty = targetPositions[i * 2 + 1]!;
        // Wavefront-comb: the wavefront's parallel position p(t) is
        // a linear function of cascadeElapsed. Every undeposited dot
        // has a rendered position determined by (a) the wavefront's
        // current parallel position p(t), and (b) the dot's own
        // perpendicular coordinate (lx - ly).
        //
        // From the system { x + y = p, x - y = lx - ly }:
        //   x = (p + lx - ly) / 2
        //   y = (p - lx + ly) / 2
        //
        // When p = lx + ly (the wavefront reaches this dot's
        // projection), x = lx and y = ly — the dot has arrived.
        // Before that, the dot is at the wavefront's current p,
        // displaced along (-1, -1) from its target by (depositAt - t)
        // worth of sweep distance.
        if (cascadeElapsed < dot.cascadeDepositAt) {
          // Linear wavefront sweep keeps the math symmetric: pNow is
          // a simple linear interpolation of (pStart → pEnd), and
          // cascadeDepositAt is a simple linear function of the dot's
          // projection.
          //
          // Per-dot parallel offset adds variance in the SWEEP
          // direction so dots aren't all co-linear on the strict
          // wavefront. The offset is maximum at t=0 and eases to 0
          // by this dot's depositAt (using a quadratic so the
          // approach is gentle) — the dot lands at (lx, ly)
          // precisely regardless of its initial offset.
          const pStart = pStartRef.current;
          const pEnd = pEndRef.current;
          const progress = cascadeElapsed / CASCADE_DURATION_MS;
          const pNow = pStart + (pEnd - pStart) * progress;
          // remaining ∈ [0, 1]: 1 at t=0, 0 at deposit.
          const remaining =
            dot.cascadeDepositAt <= 0
              ? 0
              : 1 - cascadeElapsed / dot.cascadeDepositAt;
          // Quadratic for a gentler approach to the wavefront line.
          const offsetScale = remaining * remaining;
          const offset = dot.cascadeParallelOffset * offsetScale;
          const pEffective = pNow + offset;
          positions[i * 2] = (pEffective + dot.lx - dot.ly) / 2;
          positions[i * 2 + 1] = (pEffective - dot.lx + dot.ly) / 2;
          continue;
        }
        const cxr = positions[i * 2];
        const cyr = positions[i * 2 + 1];
        if (cxr === undefined || cyr === undefined) {
          // First frame for this dot AFTER cascade window — snap to
          // target. (Only fires for dots whose cascade window already
          // passed before they ever rendered, which would mean a
          // post-mount lattice resize after cascade end; safe default.)
          positions[i * 2] = tx;
          positions[i * 2 + 1] = ty;
        } else {
          positions[i * 2] = cxr + (tx - cxr) * factor;
          positions[i * 2 + 1] = cyr + (ty - cyr) * factor;
        }
      }

      // Pass 2: edges (below dots so dots cap line joins).
      // Skip any edge whose endpoints have drifted further than the
      // STRETCH_THRESHOLD apart — happens when a dot is mid-cascade,
      // pushed out by the cutout, or dodged by a card while its
      // neighbor isn't. Drawing the edge anyway would produce a
      // visually unnatural long line crossing the wrong region.
      // Threshold is generous enough to let local drift through but
      // tight enough to break edges that span outside the lattice.
      const STRETCH_THRESHOLD_SQ = SPACING * 1.6 * (SPACING * 1.6);
      ctx.strokeStyle = stroke;
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const edges = edgesRef.current;
      for (let i = 0; i < edges.length; i++) {
        const [a, b] = edges[i]!;
        const ax = positions[a * 2]!;
        const ay = positions[a * 2 + 1]!;
        const bx = positions[b * 2]!;
        const by = positions[b * 2 + 1]!;
        const dx = bx - ax;
        const dy = by - ay;
        if (dx * dx + dy * dy > STRETCH_THRESHOLD_SQ) continue;
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
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
