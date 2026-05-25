# Landing View

The museum's front page. Holds the globe + list views, the
breathing-mesh background, the floating header pill, the legend,
the corner controls (theme, graphics, help), and the URL state
that lets `/?view=list&sort=time` deep-link into either mode.

## The two views

The landing page is a switcher between two representations of the
same project set:

- **Globe view** — the SVG icosphere from [globe.md](./globe.md).
  Default. URL: `/` (no `?view=`).
- **List view** — a grid of project cards sorted by category or
  year, with a FLIP-animated reflow when the sort changes.
  URL: `/?view=list`.

Both views render at all times (one or the other has `data-view-
active="false"` which fades it out + skips its pointer events).
This way the view-toggle animation can crossfade cleanly without
mount/unmount jank, and the globe's slow auto-rotation keeps state
even when hidden.

### List view's FLIP animation

When the user changes sort, the cards re-order in DOM but each
card's bounding rect is captured *before* the order changes, then
re-measured after, and the delta is applied as a transformless
inverse translation that animates back to identity. Pure CSS
transition on transform — the cards visually glide between
positions without re-layout. Implemented inline in ListView; the
key bits are `prevRects` + `useLayoutEffect` that runs the FLIP
inversion synchronously after each sort change.

## URL state

Two URL params, both optional:

- `?view=list` (omitted means globe — the default)
- `?sort=time` (omitted means category — the default)

`syncUrlState` mirrors React state into the URL via
`history.replaceState` (not pushState — back/forward shouldn't be
trapped by every toggle). Canonical entry `/` always lands on
globe + category sort, so shared links read intuitively.

## Composition + ownership

`LandingView` is a thin Suspense wrapper around `LandingViewInner`
(needed because `useSearchParams` requires a Suspense boundary in
the App Router). `LandingViewInner` is the real component.

It owns these concerns:

### URL ↔ state mirroring
React state (`view`, `sort`) initializes from `?view=` / `?sort=`
on mount; subsequent state changes write back via `syncUrlState`.
A `?match=` / `?lineage=` parameter set by the toast layer is also
read here for the rare cross-tab navigation case (see
`MuseumToastLayer`).

### View + sort + touch-mode toggles
Three segmented pills (Globe/List, Category/Time, Tap/Hover)
inside a floating header. The chevron in the corner cluster
collapses the header. `headerPillOpen` state + localStorage so the
collapsed state persists across visits.

### Sphere transform orchestration
The globe is visually positioned (translateY when anchored, scale
on zoom) by LandingView's CSS, NOT by PolyhedronGlobe itself. This
keeps a single transform stack on one DOM element so the
BreathingMesh can measure that element's bounding rect to draw its
cutout. The globe's onAnchoredChange callback drives the
translateY; user wheel/pinch drives the scale via `userZoom` state.

### Viewport-aware framing
Reads `innerWidth` + `innerHeight` (with a resize listener) to
compute:
- An NDC-X target for the anchored vertex (closer to center on
  narrow viewports so the hex card has equal room on both sides).
- A vertical translateY for the anchored sphere (deeper drop on
  touch / mobile so the hex card has comfortable separation from
  the sphere it's anchored to).
- Whether the sphere's top edge fits at a fixed fraction of
  viewport height regardless of zoom level.

The math reaches into the globe's own coordinate space because the
sphere is the visual focal point — keeping the framing logic up
here (next to the wrapper that owns the transform) means the
globe stays a pure renderer.

### Pointer surface lifting
A fullscreen `.globeWrap` div catches all sphere-related pointer
events and forwards them to PolyhedronGlobe via
`surfaceHandlersRef`. This gives drag/dismiss a viewport-sized hit
region — the user can drag from anywhere, dismiss from anywhere,
not just from the (potentially shrunken or translated) sphere bbox.
See globe.md → Pointer Routing for why.

### Modal mutual exclusion
HelpModal, GraphicsModal, and ThemeToggle live in the corner
cluster. Help + Graphics are modals that can't be open
simultaneously — opening one closes the other. ThemeToggle is a
plain button (no modal); it toggles dark/light directly.

### First-visit help
On mount, if `localStorage.unlv-museum.help-dismissed` isn't set,
HelpModal auto-opens. Dismissing it any way (X, ESC, backdrop, Got
it button) sets the flag.

## Files

- `src/components/ui/LandingView.tsx` — this component.
- `src/components/ui/LandingView.module.css` — the responsive
  layout: globeWrap, listMount, floatingHeader, floatingLegend,
  headerPillToggle.
- `src/components/ui/BreathingMesh.tsx` — the slowly-pulsing
  triangular mesh that sits behind everything (z=−1, position
  fixed). Measures `globeWrapRef` for its cutout.
- `src/components/ui/PolyhedronGlobe.tsx` — the globe itself
  ([globe.md](./globe.md)).
- `src/components/ui/HelpModal.tsx` — the morphing welcome card.
- `src/components/ui/GraphicsModal.tsx` — graphics quality settings.
- `src/components/ui/ThemeToggle.tsx` — light/dark toggle (two
  placements: corner button + chrome variant).
- `src/components/ui/FoldingChevron.tsx` — the custom-SVG chevron
  used by the header-pill collapse toggle.
- `src/components/ui/SlidingToggle.tsx` — the segmented-pill
  toggles with the measuring-indicator that slides between options.
- `src/lib/projects.tsx` — the project registry. Drives both
  views' assignments.

## Key constraints (don't break these)

- **Both views stay mounted.** Don't gate on `view === "globe"` to
  unmount the list, or vice versa. The view-toggle animation
  needs both DOM trees alive for the crossfade; mounting/
  unmounting would re-render every card on every toggle.
- **The globe transforms are LandingView's CSS, not PolyhedronGlobe's
  JSX.** PolyhedronGlobe paints itself at intrinsic size; the
  wrapper applies translate/scale. This is so BreathingMesh can
  measure one DOM element for both visual and cutout calculations.
- **The pointer surface is `.globeWrap`, not the SVG.** Don't bind
  drag handlers to PolyhedronGlobe's internal stage div — they
  must come through surfaceHandlersRef from LandingView so the
  whole viewport routes drag/dismiss to the globe.
- **First-visit help check uses queueMicrotask.** A direct
  `setHelpOpen(true)` in the mount effect would trigger React 19's
  set-state-in-effect lint. The microtask defers it one tick.
- **URL writes use replaceState.** pushState would create a history
  entry on every toggle and trap back/forward navigation in toggle
  permutations.
