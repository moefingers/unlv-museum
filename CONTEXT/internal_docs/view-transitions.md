# View Transitions

The museum uses the View Transitions API for navigation continuity: the chrome bar stays put across routes, the tier-pill highlight slides between tier buttons, the sidebar rail and its active-item highlight persist across sibling navigations, the body fades+blurs+slides in. Theme flips use the same machinery via `document.startViewTransition`.

This document maps every participant, explains the conventions, and notes the intentional non-namings.

## Participant inventory

Every participant is identified by a `view-transition-name`. Names are global — the browser pairs old/new instances by name. Each name must appear on at most ONE element per render.

| Name                 | Declared in                                                            | Animation rule                                                           | Role                                                               |
| -------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `site-header`        | `MuseumChrome.tsx` (inline style on `<header>`)                        | Group `animation: none`; old fast fade-out (60ms); new `animation: none` | The sticky chrome bar appears motionless across routes             |
| `site-back-link`     | `MuseumChrome.tsx` (inline style on `<Link>` back arrow)               | Default crossfade                                                        | Back arrow morphs in place across routes                           |
| `tier-pill-bg`       | `MuseumChrome.tsx` (inline style on the `.current` tier `<Link>` only) | Default crossfade                                                        | Active tier highlight slides between tier buttons                  |
| `site-signin`        | `SignInChip.module.css`                                                | Default crossfade                                                        | Sign-in chip persists across routes                                |
| `sibling-rail-host`  | `SiblingRail.module.css` (on `.host`)                                  | Default crossfade                                                        | The sidebar rail itself stays still across sibling navigations     |
| `sibling-current`    | `SiblingRail.module.css` (on `.itemCurrent`)                           | Default crossfade                                                        | The current-sibling highlight slides between rail items            |
| `page-content`       | `<ViewTransition name="page-content">` wrapper around route bodies     | Keyframed fade+blur+slide (`vt-fade` + `vt-slide-y`)                     | Route body's fade-out then fade-in animation                       |
| `project-page-frame` | `MultiPageOriginal.tsx` (`<ViewTransition>`)                           | Default crossfade                                                        | Iframe cross-fade when swapping pages inside a multi-page original |

## Page-body convention

The route body always uses the `<ViewTransition name="page-content">` wrapper (from React 19). Four call sites:

- `src/app/(museum)/page.tsx` — landing
- `src/lib/project-route.tsx` — project tiers (original/enhanced/reimagined)
- `src/app/(museum)/api-client/ApiClient.tsx` — API client surface
- `src/app/(museum)/mongo-client/MongoClient.tsx` — Mongo client surface

Do not use inline `style={{ viewTransitionName: "page-content" }}` — it's functionally equivalent on a static element but breaks consistency. The wrapper form is canonical.

## The "stays still" pattern (site-header)

`site-header` is the museum's most visible persistent element. Across any route navigation it should read as motionless — no fade, no slide, no crossfade — while the body underneath does its own keyframed transition.

The mechanism is asymmetric:

```css
::view-transition-group(site-header) {
  animation: none;
  z-index: 100;
}
::view-transition-old(site-header) {
  animation: 60ms ease-out both vt-header-fade-out;
  inset: 0;
}
::view-transition-new(site-header) {
  animation: none;
  inset: 0;
}
```

- The **new snapshot** renders fully opaque from frame 0 (no animation) and stays.
- The **old snapshot** fades out over 60ms. Without this, the default browser behavior leaves both pseudos painted at full opacity simultaneously, creating a "ghosted double-vision" window where the old subtitle/title text shows through the new — visible jank.
- 60ms is fast enough that the eye reads it as "the old chrome shrugged out of existence" rather than a deliberate crossfade.
- `inset: 0` on both pinsthem to the same origin so any height delta (e.g. notes panel open in one route, closed in the other) doesn't shift them relative to each other.

**Why not `display: none` on the old?** Earlier iterations did this. It caused a 1–2 frame gap where the old was gone but the new hadn't yet been captured into a snapshot — visible as a "flash of no chrome." The fast fade-out avoids both that gap AND the double-vision effect.

**Why z-index: 100?** Keeps the group above `page-content`'s animated old/new pair so the header stays painted on top while the body crossfades underneath.

## Intentional non-namings

These elements _could_ be named but deliberately are not. Negative-space decisions documented inline in the relevant CSS modules:

- **`pageItemActive` in SiblingRail** — naming this would cause an exit animation on it every time the user navigated to a sibling that doesn't currently have `?page=` set (named element vanishes from new DOM → full-duration exit animation fires). The rail would read as jittery. The trade-off: the page-highlight pops instead of sliding. The sibling-level slide (`sibling-current`) is what visitors feel most, and that's named.

Add to this list when you discover others. Inline `// Intentionally NOT naming with view-transition-name. Reason: …` is the right place; this doc is the index.

## Theme toggle

`useTheme` wraps `localStorage.setItem(...)` in `document.startViewTransition`:

```ts
function withViewTransition(fn: () => void) {
  if (document.startViewTransition) {
    document.startViewTransition(fn).finished.catch(() => {});
  } else {
    fn();
  }
}
```

The DOM doesn't change — only the `.dark` class on `<html>` flips — so the default root crossfade is the right animation: every element with a name (or the default root group) crossfades from its old computed colors to the new ones. No custom keyframes needed.

The `.catch(() => {})` swallows `InvalidStateError`, which fires when the user rapid-clicks the toggle (the previous transition's `finished` promise rejects when aborted by a new one). Silent rejection is correct; the new transition takes over.

## Animation rules (from globals.css)

```css
::view-transition-old(page-content) {
  animation:
    150ms ease-in both vt-fade reverse,
    150ms ease-in both vt-slide-y reverse;
}

::view-transition-new(page-content) {
  animation:
    210ms ease-out 150ms both vt-fade,
    400ms ease-in-out both vt-slide-y;
}

@keyframes vt-fade {
  from {
    filter: blur(3px);
    opacity: 0;
  }
  to {
    filter: blur(0);
    opacity: 1;
  }
}

@keyframes vt-slide-y {
  from {
    transform: translateY(10px);
  }
  to {
    transform: translateY(0);
  }
}
```

The pair is a sequence, not a crossfade:

- Old fades out 0–150ms (with reverse keyframes: blur builds, opacity drops, slide reverses).
- New starts at 150ms, fades in over 210ms (blur clears, opacity rises) while sliding up over 400ms.
- Total transition ≈ 550ms, with the slide finishing after the fade — so the body settles into place after the visual "lock."

## Reduced motion

`@media (prefers-reduced-motion: reduce)` zeros animation durations on `::view-transition-old/new/group(*)` along with regular animations. Easy to miss — included here because if you add a custom view-transition keyframe you don't need to remember to handle reduced motion separately; the global rule catches all named participants.

## Adding a new participant

1. Pick a unique name. Names are global; conflicts silently break.
2. Apply via inline `style={{ viewTransitionName: "..." }}` on the React element, OR via a `.module.css` rule using the literal name (NOT CSS-Modules-scoped, since the global `::view-transition-*` rules must match by literal).
3. If the default crossfade is the desired effect, you're done — no rules needed in globals.css.
4. If you need custom motion, add `::view-transition-old/new(your-name)` rules to globals.css's View Transitions section.
5. If the element should NOT animate (stays still), follow the `site-header` pattern: explicit `animation: none` plus a quick fade-out on the old to avoid the co-opaque overlap.
6. If you're choosing NOT to name an element that COULD be named, document the reason inline AND add a bullet to the "Intentional non-namings" section above.
