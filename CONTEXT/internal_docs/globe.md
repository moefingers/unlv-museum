# Globe

The landing page's centerpiece. A rotating 3D sphere of project
vertices that hovers, anchors, and unfolds project cards out of
individual points. This doc is the orienting overview; the code's
inline comments are tight and lean on this story.

## The user-visible flow

1. **Idle.** The sphere rotates slowly on its own around world-Y.
   Each assigned vertex is a small luminous dot, color-coded by
   project category.
2. **Hover.** The user moves a cursor (or in Hover-mode on touch, a
   crosshair following the centroid of their fingers) over the
   sphere. When the cursor lands near an assigned vertex, the
   sphere decelerates → halts → resumes (the "hover cycle") and
   the vertex types in its project title with a caret + flicker.
3. **Anchor.** The user clicks/taps a vertex. The label untypes; the
   sphere swings (slerp) until the chosen vertex sits at a fixed
   on-screen anchor position. A light beam (cone) shoots up from
   the vertex and a hexagonal billboard unfolds at its top,
   revealing the project's full title + year + description.
4. **Navigate.** Clicking inside the hex billboard navigates to the
   project's landing page.
5. **Dismiss.** Tapping anywhere off the card (or pressing ESC, or
   clicking on the page background) reverses the choreography: hex
   collapses, cone falls, sphere unswings back to free rotation.
6. **Cross-anchor.** Tapping a different vertex while one is open
   handles off in a single continuous animation: the open card
   collapses, the sphere slerps directly to the new vertex (without
   lifting back up), the new card opens.

## Architecture

The globe is implemented as an SVG icosphere (not CSS 3D). Every
visible element — face polygons, vertex glows, the projection cone,
the touch crosshair — is an SVG primitive inside one `<svg>`. The
hex billboard is the only HTML overlay, positioned absolutely above
the SVG.

### Single source of truth: the quaternion

The sphere's orientation is a unit quaternion `q`. Every frame:

1. `q` is multiplied or slerped (depending on which rotation driver
   is active this frame).
2. Each mesh vertex is rotated by `q × axial-tilt-matrix`.
3. The rotated 3D positions are projected to screen-space via
   perspective division.
4. Faces are backface-culled (winding order) and painter-sorted
   (back-to-front by centroid Z).
5. JSX renders the sorted faces + visible vertices + everything else.

The quaternion lives in both React state (`q`) and a ref
(`latestQ.current`) — the ref so the rAF loop can read the latest
value without React re-render coupling. A wrapped setter `applyQ`
writes both atomically.

### Hook composition

PolyhedronGlobe composes five hooks, each owning one concern:

- **useAnchorPhase** — the multi-phase state machine that drives the
  click-to-anchor choreography (idle → swinging → coneRising →
  widening → open → collapsing → coneFalling → unswinging → idle).
  Owns the per-frame anchor swing slerp via `tickSwing(now, applyQ)`.
- **useDragMomentum** — the per-gesture drag state + post-release
  exponential-decay rotation that "throws" the sphere when the user
  flicks-and-releases. Owns `tick(now, dtSec)` for the decay frame.
- **useAutoRotate** — the slow default rotation when no other driver
  is active. Owns phase-gating (rotation only in idle / unswinging /
  open phases), hover-cycle speed modulation, and the anchored-vertex
  axis switch.
- **useHoverCrosshair** — the touch-only crosshair gesture state
  machine, including multi-finger lift hesitation (the
  POINTERUP_HESITATION_MS window that absorbs near-simultaneous
  two-finger lifts).
- **useGraphics** — the graphics-quality settings (backgroundHalo,
  edgeGlow, vertexGlows, faceShading). Each is a per-vertex /
  per-face fillrate cost; the user can disable them on low-end
  hardware.

### The rAF orchestrator

PolyhedronGlobe's only animation effect is a 10-line per-frame loop
that calls three rotation drivers in priority order:

```ts
function tick(now) {
  const dtSec = (now - lastTick) / 1000;
  lastTick = now;
  // 1. Anchor swing (claims the frame entirely if active)
  if (anchor.tickSwing(now, applyQ)) return;
  // 2. Drag momentum decay (claims the frame if active)
  if (!dragMomentum.isDragging() && !dragMomentum.tick(now, dtSec)) {
    // 3. Auto-rotate (the default; fills in)
    autoRotate.tick(now, dtSec);
  }
}
```

Each driver returns `true` if it applied a rotation, signaling lower-
priority drivers to bow out. The drivers own their own state +
physics; this loop is pure orchestration.

### Pointer routing

Pointer events have a counter-intuitive route. The natural binding
would be to the SVG element, but that misses two cases:

- When the user zooms out, the sphere is visually smaller than the
  SVG bbox — taps in the empty corners are valid drag/dismiss
  inputs that the SVG would miss.
- When the sphere is anchored, the SVG translates downward — taps
  in the space above the SVG should still dismiss.

Solution: pointer handlers are bound on a fullscreen ancestor
(`.globeWrap` in LandingView), not the SVG. PolyhedronGlobe exposes
its handlers via `surfaceHandlersRef`; LandingView pipes its
ancestor's pointer events through that ref. The SVG itself only
takes `onPointerMove` + `onPointerLeave` for the SVG-coords-only
hover-cycle bookkeeping.

The handlers internally dispatch to tap-mode or hover-mode sub-
handlers based on `touchMode`. Each sub-handler is ~50 lines and
self-contained.

### Touch hover-mode quirks

Hover mode is opt-in for touch devices. It replaces drag-rotate with
a crosshair that tracks the centroid of all active fingers. Lifting
without dragging commits a tap on the nearest vertex; dragging
fades the crosshair out without committing.

The state machine is tricky because of how the OS delivers multi-
finger lifts. When the user lifts both fingers ~simultaneously, the
OS serializes them: pointerup A, then a few ms later pointerup B.
In between, a pointermove for B can fire — and that pointermove
computes a centroid from finger A's stale (last-known) position
averaged with finger B's live position, snapping the crosshair
toward finger B. Hard-to-predict snap.

Two layered defenses:
- **Pointerup hesitation.** When pointerup arrives with other
  pointers still down, we don't act immediately — we wait 60ms. If
  another pointerup arrives in the window, we treat both as
  simultaneous (no intermediate "one finger left" snap). During
  hesitation, pointermoves are gated so the crosshair stays frozen.
- **Race-write undo via prevPos.** Each writeCrosshair saves the
  previous position. On the first pointerup of a multi-finger
  gesture, if the immediately-preceding pointermove was suspect
  (count was ≥2 going in), we restore the prevPos — undoing the
  one race-corrupted write.

The full hesitation + restore + grace-window logic lives in
`useHoverCrosshair`. The hesitation window is also why the gesture
state has a `pendingLift` timer reference.

## Files

- `src/components/ui/PolyhedronGlobe.tsx` — the component itself.
  Mostly composition + render; the physics live in the hooks.
- `src/hooks/use-anchor-phase.ts` — anchor state machine + swing slerp.
- `src/hooks/use-drag-momentum.ts` — drag gesture + decay physics.
- `src/hooks/use-auto-rotate.ts` — default rotation + phase gating.
- `src/hooks/use-hover-crosshair.ts` — touch crosshair gesture machine.
- `src/hooks/use-graphics.ts` — graphics quality settings + persistence.
- `src/lib/quaternion.ts` — quat math (multiply, slerp, fromAxisAngle,
  fromUnitVectors, toMatrix3).
- `src/lib/polyhedra.ts` — icosphere geodesic mesh generator.
- `src/components/ui/VertexHover.tsx` — the per-vertex dot + typing-
  label component.
- `src/components/ui/UnfoldingBillboard.tsx` — the dot → hexagon
  spring-cascade unfold animation.

## Key constraints (don't break these)

- **The wrapped applyQ writes both the ref and the React state.** Don't
  write `latestQ.current` directly without also calling `setQ` — the
  rAF loop's reads stay correct but the render doesn't update.
- **Painter order on the SVG is back-to-front by face centroid Z.**
  faceRecords is sorted earlier; don't reorder the .map without
  also reordering the sort.
- **Pointer capture is omitted in tap mode.** Capturing on the
  surface element would redirect the synthesized click event off
  vertex targets and break tap-to-open. Single-touch and mouse
  events route naturally without capture; multi-touch pinch works
  via the activePointers map.
- **The hex card wrapper is clip-pathed to the visible hex shape.**
  Without the clip, taps in the wrapper's empty corners would get
  eaten by its stopPropagation and dismiss wouldn't fire. The
  polygon is inflated ~1.13× so the drop-shadow glow isn't sliced.
- **Pointerup may fire twice for the same pointerId** (synthetic
  event delegation across the inner stage + lifted surface). The
  hover pointerup handler bails if the pointerId is no longer in
  activePointers — already-processed lifts shouldn't re-process.

## History

The globe used to be a CSS-3D + Fibonacci-sphere implementation
(translateZ + preserve-3d chain). It was rewritten as an SVG
icosphere with quaternion rotation when the click-to-anchor +
hex-billboard interaction was added — the CSS-3D approach couldn't
do arbitrary-axis rotation cleanly, and the polyhedral face
structure gives a more intentional visual identity than a smooth
sphere of cards. The Fibonacci-sphere code is gone from this
codebase; this doc previously described it, which is why an earlier
version of this file was misleading.
