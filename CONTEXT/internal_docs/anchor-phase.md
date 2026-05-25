# Anchor Phase

The multi-phase state machine that opens a project's hex card from a
vertex of the globe and closes it back down. Owned by
`src/hooks/use-anchor-phase.ts` and consumed by PolyhedronGlobe.

For the user-visible flow, see [globe.md](./globe.md). This doc
covers the state machine itself — phases, transitions, timing,
cross-anchor handoff, and how the hook composes with the rAF loop.

## Phases

```
idle
  ↓ handleDotClick(vi)
swinging (slerp from current orientation to anchor pose)
  ↓ slerp completion (rAF → notifySwingComplete)
coneRising (cone shoots up from vertex over CONE_RISE_MS)
  ↓ phaseTimer
widening (cone widens + hex unfolds, over WIDENING_MS)
  ↓ phaseTimer
open (stable; auto-rotates around anchored vertex at 0.6× speed)
  ↓ releaseAnchor() / ESC / cross-anchor click
collapsing (hex closes + cone narrows, over COLLAPSING_MS)
  ↓ phaseTimer
coneFalling (cone retracts back to vertex, over CONE_FALL_MS)
  ↓ phaseTimer
unswinging (sphere slerps back to "free" orientation)
  ↓ phaseTimer
idle
```

The forward chain is gated by **animation completion**: swinging
ends when the slerp settles (rAF signals it), then coneRising and
widening are each timed via `phaseTimer` setTimeouts. The reverse
chain is fully timer-driven.

## Cross-anchor handoff

If the user clicks a different vertex while one is anchored, the
machine doesn't go open → idle → swinging. It splices: when
collapsing/coneFalling carries a `nextVi`, on coneFalling completion
it jumps directly to swinging toward `nextVi` instead of going to
unswinging.

The visual result is: hex collapses, cone falls, sphere swings to
the new vertex (without lifting back up to free rotation), new
cone rises, new hex opens. One continuous motion.

## Timing constants

All exported because the JSX (cone scale transitions, hex billboard
positioning) and PolyhedronGlobe's rAF loop reference them:

| Constant | Default | Used for |
|---|---|---|
| `ANCHOR_SWING_MS` | 900ms | Swing slerp duration. Also LandingView's matching transform-transition for the anchored zoom/translate. |
| `CONE_RISE_MS` | 280ms | Cone scaleY 0→1 ramp. |
| `WIDENING_MS` | 600ms | Cone scaleX 0→1 + hex unfold cascade run together. |
| `CONE_WIDEN_FRACTION` | 0.4 | Cone scaleX reaches full at 40% of WIDENING_MS, leaving 60% for the hex's slower unfold tail. |
| `COLLAPSING_MS` | 480ms | Reverse of widening — hex closes + cone narrows. |
| `CONE_FALL_MS` | 220ms | Reverse of cone rise. |
| `UNSWING_MS` | 900ms | Mirror of swing. Matches ANCHOR_SWING_MS by design. |

Tuning rationale: the open cascade (swing → cone → widening) totals
~1.8s — slow enough to read as a deliberate sequence, fast enough
that a clicker doesn't lose interest. The close cascade is shorter
(~1.6s) because the user has already seen the content; getting out
should feel snappier than getting in.

## What the hook owns vs. reads vs. is read from

Owned (the hook's own state):
- `phase` (React state) + `phaseRef` (ref mirror for rAF reads)
- `anchorAnim` ref — the slerp's `{ fromQ, toQ, startedAt }`
- `anchoredAxis` ref — the post-swing world-space axis of the
  anchored vertex
- `phaseTimer` — the setTimeout that advances forward/reverse chains
- All phase-derived display values: `anchoredVertexIdx`, `hexOpen`,
  `coneHeightProgress`, `coneWidthProgress`,
  `coneHeightTransitionMs`, `coneWidthTransitionMs`
- Action handlers: `handleDotClick`, `releaseAnchor`, ESC keypress

Reads from outside (via config arg):
- `meshVertices` — for computing the swing target quaternion
- `latestQRef` — current rotation; used as the swing's `fromQ`
- `autoRotateAxisRef` — writable, swapped between world-Y and the
  anchored axis as phase changes
- `hoverCycleStartRef` — writable, cleared on swing-in so a
  previous hover cycle doesn't keep modulating sphere speed mid-
  anchor
- `clearEngagementFor(vi)` — clears any in-flight label engagement
  on the swinging-toward vertex
- `anchorNdcX` (optional) — viewport-aware horizontal anchor target

Read from by:
- PolyhedronGlobe's rAF loop — calls `tickSwing(now, applyQ)` per
  frame; the hook owns the slerp + axis update on settle.
- PolyhedronGlobe's JSX — `anchoredVertexIdx`, `hexOpen`, cone
  progress + transition values drive the cone scale animations
  and the hex billboard's position.
- LandingView's outer effect — `onAnchoredChange` callback fires
  when `anchoredVertexIdx` flips between null/non-null, used to
  apply the anchored zoom transform on a wrapping element.

## The anchor target math

The swing's `toQ` is computed by `computeAnchorTarget(vMesh,
ndcX)`. It reverses the museum's projection pipeline:

1. Pick a target post-rotation point on the unit sphere that
   projects (under axial tilt + perspective + scale) to the desired
   NDC `(ANCHOR_NDC_X, ANCHOR_NDC_Y)`. Approximations: ignore
   perspective scaling (~5% effect at the museum's cameraZ),
   reverse only the axial tilt, snap to the unit sphere via
   `z = sqrt(1 − x² − y²)`.
2. The rotation that takes `vMesh` to that target point IS the
   target quaternion, via `fromUnitVectors(vMesh, target)`.

`ANCHOR_NDC_X` defaults to −0.13 (slightly left of center on
desktop) but is overridable via the `anchorNdcX` config so
LandingView can shift it toward 0 on narrow viewports.

## tickSwing internals

```ts
tickSwing(now, applyQ) {
  const anim = anchorAnim.current;
  if (!anim) return false;
  const tRaw = min(1, (now - anim.startedAt) / ANCHOR_SWING_MS);
  const t = easeInOutCubic(tRaw);
  applyQ(slerp(anim.fromQ, anim.toQ, t));
  if (tRaw >= 1) {
    // Settle: recompute the anchored axis from the post-slerp
    // quaternion (q · vMesh), not from the stored target axis —
    // avoids numerical drift.
    const vMesh = meshVertices[getAnchoredVi()];
    const m = toMatrix3(latestQRef.current);
    const axis = { x: m[0]*vMesh.x + m[1]*vMesh.y + m[2]*vMesh.z, ... };
    anchoredAxis.current = axis;
    autoRotateAxisRef.current = axis;
    anchorAnim.current = null;
    notifySwingComplete();  // advance phase machine to coneRising
  }
  return true;  // caller's rAF loop should skip drag-momentum + auto-rotate this frame
}
```

The easeInOutCubic gives slow-at-start, fast-at-middle, slow-at-end
— feels deliberate vs. mechanical-linear.

## ESC dismiss

A document-level `keydown` listener bound only while anchored. ESC
calls `releaseAnchor`. Bound dynamically (mount/unmount with the
anchored state) so the keypress isn't intercepted globally when no
card is open.

## Files

- `src/hooks/use-anchor-phase.ts` — the hook.
- Consumers: `src/components/ui/PolyhedronGlobe.tsx`,
  `src/components/ui/LandingView.tsx` (timing constant import).

## Key constraints (don't break these)

- **`notifySwingComplete` must fire EXACTLY once per swing.** It
  advances the phase machine. The hook fires it inside
  `tickSwing` on the settle frame, and nowhere else.
- **`anchoredAxis` recomputes from the post-slerp quaternion, not
  the target.** Numerical slerp drift would accumulate otherwise,
  and the open-phase auto-rotation would slowly walk off the
  anchored vertex.
- **`anchorAnim.current = null` happens AFTER `notifySwingComplete`
  but inside the same settle frame.** Future ticks should bail
  early (`anim === null` → return false), letting drag-momentum +
  auto-rotate take over.
- **Cross-anchor handoff goes through coneFalling, not
  unswinging.** The `nextVi` payload threads through
  collapsing/coneFalling. On coneFalling completion, the phase
  jumps to swinging if nextVi is set.
