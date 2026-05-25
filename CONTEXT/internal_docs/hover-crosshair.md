# Touch Hover Crosshair

Opt-in touch interaction where each finger acts as a hover cursor
rather than a drag-grab. A crosshair UI element tracks the centroid
of all active fingers; the vertex nearest the centroid engages (its
label types in). Lifting commits a tap on the nearest vertex; a
deliberate drag instead fades the crosshair out without committing.

Owned by `src/hooks/use-hover-crosshair.ts`. Consumed by
PolyhedronGlobe via its hover-mode pointer dispatchers. See
[globe.md](./globe.md) for how it composes with the sphere's
drag-rotate (which is suppressed in hover mode) and pinch zoom
(which is preserved).

## The interaction

1. **Finger lands.** Crosshair appears at the touch point. Vertex
   nearest the crosshair (within `CROSSHAIR_ENGAGEMENT_RADIUS` =
   60 viewBox units) engages → its label types in.
2. **Finger moves.** Crosshair follows. Engagement updates as the
   nearest-vertex changes.
3. **Second finger lands.** Crosshair jumps to the midpoint (the
   centroid). Now any move-deltas drive pinch zoom in addition to
   centroid tracking. Engagement still happens — a multi-finger
   midpoint is a valid hover target.
4. **Finger lifts.**
   - If it was a quick tap (duration < `TAP_MAX_MS` = 400ms AND
     total movement < `TAP_MAX_PX` = 20px), the gesture is a tap
     → open the nearest vertex's card.
   - Otherwise it was a drag-preview → fade out without
     committing.
5. **Fade.** Post-release, the crosshair lingers visible for
   `CROSSHAIR_LINGER_MS` = 1000ms while opacity fades. Visual
   confirmation that the gesture registered.

## Multi-finger lift hesitation

The hairy part. When the user lifts two fingers ~simultaneously,
the OS serializes them: pointerup A, a few ms later pointerup B.
In between, a pointermove for B can fire — and that pointermove
computes a centroid from finger A's stale last-known position
averaged with finger B's live position, snapping the crosshair
toward finger B by half the inter-finger distance. Visible snap.

Two layered defenses:

### 1. Pointerup hesitation (`POINTERUP_HESITATION_MS = 60`)

When pointerup arrives with other pointers still down, we don't
act immediately. We set `gesture.pendingLift = setTimeout(commit,
60ms)`. Two outcomes:

- **Another pointerup arrives in the window.** Treat both as
  simultaneous. Cancel the pending timer, branch on the
  cumulative state: if count is now 0, full lift; if count > 0,
  rebaseline to the remaining centroid immediately.
- **Timer expires with fingers still down.** Commit the original
  pointerup's "one finger lifted, X-1 remain" transition:
  rebaseline crosshair to the new centroid.

Critically, while `pendingLift` is set, BOTH pointermove and
pointerup are gated. Pointermoves don't update the crosshair (so
the frozen centroid stays put no matter which finger jitters).
Pointerups merge into the hesitation logic.

### 2. Race-write undo via `prevPos`

`writeCrosshair` saves the previous position into `gesture.prevPos`
on every call. On the first pointerup of a multi-finger gesture
(detected via `wasMultiFinger = pointers.size >= 2`), if the
immediately-preceding pointermove was suspect (race-corrupted by
a finger that was lifting but hadn't yet sent pointerup), we
restore the prevPos — undoing that one corrupted write.

This catches the case where the pointermove fired BEFORE the first
pointerup. The hesitation timer can't help there (it hadn't been
set yet); prevPos restore is the backstop.

### Duplicate-pointerup guard

Bonus: pointerup can fire TWICE for the same pointerId via
synthetic-event delegation across the inner stage + lifted
surface. The handler bails if `e.pointerId` isn't in the active
map — it's already been processed.

## Hook API

```ts
useHoverCrosshair({
  touchMode,                  // dormant unless "hover"
  activePointersRef,          // shared with tap-mode pinch tracking
  pointerCentroid,            // computes centroid + radius
  lastPinchDistanceRef,       // shared pinch baseline
  tryEmitPinchZoom,           // shared pinch zoom emitter
  clientToViewBox,            // coord conversion
  findNearestAssignedVertex,  // for engagement + tap-target
  anchor,                     // for handleDotClick + releaseAnchor
  setEngagedVertexIdx,        // engagement state setter
}): {
  onPointerDown(e, surface),  // bind in PolyhedronGlobe's dispatcher
  onPointerMove(e),
  onPointerUp(e?),
  visible,                    // whether to render the crosshair <g>
  initialX, initialY,         // for the <g>'s mount-time transform
  bindGroup,                  // ref callback for the <g>
}
```

The hook is dormant unless `touchMode === "hover"`. Tap-mode
(default for mouse + single touch) bypasses it entirely.

## Imperative DOM writes

The crosshair `<g>` element's `transform` + `opacity` + `style.
transition` are managed imperatively, NOT via React props. The
JSX intentionally declares neither — React reconciliation would
re-apply baseline values on every re-render and clobber the
pointermove writes (causing visible snap-back).

- `writeCrosshair(pos)` → `el.style.transform = translate(...)`
- `writeCrosshairOpacity(releasing)` → `el.style.opacity = "0" | "1"`
- Mount-time setup happens in `bindGroup` (a stable
  useCallback-memoized ref callback so React only invokes it on
  mount/unmount, not every render).

The CSS `transform` PROPERTY is used, not the SVG `transform`
ATTRIBUTE. CSS transitions only animate property changes — using
the property keeps the door open for adding a transform transition
without rewriting the writer. `px` units on SVG elements inside
an `<svg>` resolve to viewBox user units per CSS Transforms Level 2.

## Tuning constants

| Constant | Default | Tuning notes |
|---|---|---|
| `CROSSHAIR_LINGER_MS` | 1000ms | Linger fade-out window after the last finger lifts. Long enough to register; short enough not to occlude follow-up gestures. |
| `TAP_MAX_MS` | 400ms | Max gesture duration to qualify as a tap. Above this it's a drag-preview. |
| `TAP_MAX_PX` | 20px | Max total centroid movement to qualify as a tap. |
| `CROSSHAIR_ENGAGEMENT_RADIUS` | 60vb units | Distance from centroid to vertex needed to engage. Comfortably wider than VertexHover's own hit-target (24) so the user has the same generous reach as mouse hover. |
| `POINTERUP_HESITATION_MS` | 60ms | Multi-finger lift hesitation window. Long enough to absorb natural human "simultaneous" lifts; short enough that intentional one-finger-remaining gestures feel responsive. |

## Files

- `src/hooks/use-hover-crosshair.ts` — the hook.
- `src/components/ui/PolyhedronGlobe.tsx` — consumer; renders the
  crosshair `<g>` and pipes pointer events through the hook's
  handlers when `touchMode === "hover"`.

## Key constraints (don't break these)

- **Both pointermove AND pointerup are gated during pendingLift.**
  Removing either gate reopens the snap bug.
- **`prevPos` is saved on EVERY writeCrosshair, not selectively.**
  The restore-on-pointerup logic depends on prevPos always being
  one-step-old.
- **The crosshair `<g>` declares no `transform` / `style` props in
  JSX.** React's reconciliation would clobber imperative writes.
- **`bindGroup` must be memoized.** A new identity per render would
  cause React to invoke it on every render (treating each render
  as a remount), resetting opacity + transition back to baseline.
- **Duplicate-pointerup guard short-circuits before any state
  mutation.** Re-processing a stale pointerup hits CASE A
  (pendingLift exists) and runs doRebaseline against the live
  single-finger centroid — visually a snap. The
  `if (e && !activePointers.current.has(e.pointerId)) return`
  guard at the top of handlePointerUp is the only thing preventing
  that.
