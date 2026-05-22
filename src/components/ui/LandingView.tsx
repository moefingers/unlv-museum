"use client";

import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BreathingMesh } from "@/components/ui/BreathingMesh";
import { HelpModal } from "@/components/ui/HelpModal";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  ANCHOR_SWING_MS,
  ANCHOR_ZOOM_EASING,
  ANCHOR_ZOOM_SCALE,
  ANCHOR_ZOOM_TRANSLATE_Y_PCT,
  PolyhedronGlobe,
  USER_ZOOM_MAX,
  USER_ZOOM_MIN,
  USER_ZOOM_WHEEL_SENSITIVITY,
  type VertexAssignment,
} from "@/components/ui/PolyhedronGlobe";
import { geodesic } from "@/lib/polyhedra";
import {
  PROJECTS,
  CATEGORY_LABELS,
  projectLandingUrl,
  type Category,
  type Project,
} from "@/lib/projects";
import {
  Globe as GlobeIcon,
  List,
  FolderTree,
  Clock,
  ChevronDown,
  ChevronUp,
  Hand,
  Crosshair,
  HelpCircle,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import styles from "./LandingView.module.css";

type ViewMode = "globe" | "list";
type SortMode = "category" | "time";

const VIEW_DEFAULT: ViewMode = "globe";
const SORT_DEFAULT: SortMode = "category";
const HELP_DISMISSED_KEY = "unlv-museum.help-dismissed";

/**
 * Mirror landing view + sort selections into the URL as `?view=` and
 * `?sort=` so the page is shareable in any of its four configurations.
 *
 * Defaults are elided so the canonical entry point stays a bare `/`:
 *  - view=globe and sort=category are omitted
 *  - non-default values render
 *
 * Uses replaceState (not pushState) so back/forward isn't trapped by
 * toggle clicks — same pattern as api-client's ?api= mirror.
 */
function syncUrlState(view: ViewMode, sort: SortMode) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (view === VIEW_DEFAULT) url.searchParams.delete("view");
  else url.searchParams.set("view", view);
  if (sort === SORT_DEFAULT) url.searchParams.delete("sort");
  else url.searchParams.set("sort", sort);
  // Preserve the path; rebuild only the search portion. Avoid emitting
  // a trailing "?" when both params are at defaults.
  const search = url.searchParams.toString();
  const next = `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
  window.history.replaceState({}, "", next);
}

/**
 * Parse a project's freeform `year` string ("Jan 2024", "Dec 2023 – Jan 2024",
 * "Mar 2024", "2014") into a sortable YYYY-MM key. For date ranges, returns
 * the END date so "most recently worked on" surfaces first when sorted desc.
 * Unparseable inputs return "0000-00" — sorted last.
 */
const MONTH_INDEX: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};
function projectSortKey(yearText: string): string {
  // Range "Dec 2023 – Jan 2024" → use the second half. Handle both en-dash
  // and hyphen separators defensively.
  const lastSegment = yearText.split(/–|—|-/).pop()?.trim() ?? yearText;
  const monthMatch = lastSegment.match(/([A-Za-z]{3})[a-z]*\s+(\d{4})/);
  if (monthMatch) {
    const m = MONTH_INDEX[monthMatch[1]!.toLowerCase()] ?? "00";
    return `${monthMatch[2]}-${m}`;
  }
  // Year-only ("2014") — pin to end-of-year so it sorts after dated items
  // in the same year.
  const yearOnly = lastSegment.match(/(\d{4})/);
  if (yearOnly) return `${yearOnly[1]}-12`;
  return "0000-00";
}

/**
 * Stable [0, 1) hash of a string via FNV-1a. Used for the list-card
 * stagger delays so each card has a deterministic random offset —
 * no flicker on re-render, but the stagger pattern reads as random
 * rather than positional.
 */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/**
 * Inline SVG dot that mirrors the polyhedron's vertex glow exactly.
 * Same primitive (an SVG <circle> filled with a radial-gradient
 * whose stops use `var(--category-...)`) so what renders in the
 * legend is structurally identical to what renders on the globe —
 * just smaller and viewport-positioned instead of sphere-positioned.
 *
 * Gradient ID must be unique per category. Inline <svg> elements
 * in HTML share the document's ID namespace, so a fixed ID like
 * "g" across six instances would resolve to the first defined
 * gradient for ALL of them — every dot ends up the same color.
 * Suffixing with the category name namespaces them properly.
 *
 * The viewBox is sized to give the gradient room to fade out past
 * the visible circle's edge (so there's no hard cutoff at the
 * gradient's 100% stop).
 */
function CategoryGlowDot({ category }: { category: Category }) {
  const colorToken: Record<Category, string> = {
    games: "--category-games",
    "full-stack": "--category-fullstack",
    frontend: "--category-frontend",
    api: "--category-apis",
    python: "--category-python",
    exercises: "--category-exercises",
  };
  const token = colorToken[category];
  const gradientId = `legend-glow-${category}`;
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <defs>
        <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255, 255, 255, 1)" />
          <stop offset="35%" stopColor={`var(${token})`} stopOpacity={0.95} />
          <stop offset="65%" stopColor={`var(${token})`} stopOpacity={0.7} />
          <stop offset="100%" stopColor={`var(${token})`} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx="8" cy="8" r="8" fill={`url(#${gradientId})`} />
    </svg>
  );
}

function ListCard({
  project,
  registerRef,
}: {
  project: Project;
  registerRef: (slug: string, el: HTMLAnchorElement | null) => void;
}) {
  return (
    <Link
      key={project.slug}
      ref={(el) => registerRef(project.slug, el)}
      href={project.href ?? projectLandingUrl(project)}
      className={styles.listCardLink}
      // backdrop-filter is applied inline because Turbopack/Lightning CSS
      // in this project strips it from CSS Modules (confirmed via
      // computed-style inspection — the property was dropped from the
      // served stylesheet). Inline survives the pipeline untouched.
      // `--i` is a per-card random in [0, 1) (hashed from slug for
      // stability) — CSS multiplies it by a spread to derive the
      // transition-delay for the scale-in/scale-out cascade.
      style={
        {
          backdropFilter: "blur(2px) saturate(1.4)",
          WebkitBackdropFilter: "blur(2px) saturate(1.4)",
          "--i": hash01(project.slug),
        } as React.CSSProperties
      }
      // data-category drives a faint background tint (--category-* token at
      // low alpha) so category identity is visible without section headers
      // — see .listCardLink[data-category=...] in the module CSS.
      data-category={project.category}
      // BreathingMesh queries this selector each frame and pushes dots
      // out of the card's bbox (+18px padding). Tagging is opt-in so the
      // mesh doesn't dodge arbitrary content.
      data-mesh-dodge=""
    >
      <h3 className={styles.listCardTitle}>{project.title}</h3>
      <p className={`text-sm ${styles.listCardDescription}`}>
        {project.description}
      </p>
      <div className={styles.listCardTech}>
        {(
          project.techOriginal ??
          project.techEnhanced ??
          project.techReimagined ??
          []
        ).map((tech) => (
          <span key={tech} className={`text-xs ${styles.techChip}`}>
            {tech}
          </span>
        ))}
      </div>
      <p className={`text-xs ${styles.listCardYear}`}>{project.year}</p>
    </Link>
  );
}

/*
 * Sort projects according to the active sort axis.
 *  - "category" — group by category in the order CATEGORY_LABELS defines,
 *    then by time (newest first) within each category.
 *  - "time" — flat newest-first, ignoring category. Category identity is
 *    still visible via per-card tint (no headers needed).
 */
const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as Category[];
function sortProjects(projects: readonly Project[], sort: SortMode): Project[] {
  if (sort === "time") {
    return [...projects].sort((a, b) =>
      projectSortKey(b.year).localeCompare(projectSortKey(a.year)),
    );
  }
  return [...projects].sort((a, b) => {
    const ci = CATEGORY_ORDER.indexOf(a.category);
    const cj = CATEGORY_ORDER.indexOf(b.category);
    if (ci !== cj) return ci - cj;
    return projectSortKey(b.year).localeCompare(projectSortKey(a.year));
  });
}

/*
 * Flat grid in both modes. The sort axis only changes the ordering; the
 * DOM structure stays identical so a FLIP transition morphs each card
 * from its old position to its new one. Category identity is rendered as
 * a per-card background tint (no headers) — see ListCard.
 *
 * FLIP (First Last Invert Play) implementation:
 *  - prevRects: each card's bbox captured at the end of the previous
 *    render (keyed by project.slug).
 *  - useLayoutEffect runs after DOM commit but before paint. It measures
 *    each card's NEW bbox, computes the delta from prev, and applies an
 *    inverse translate + transitionless transform so the card visually
 *    stays put. Then on the next frame, the inverse is removed with a
 *    transition restored — the browser interpolates from inverse → none,
 *    which renders as a smooth flight from old to new position.
 *
 * Using `key={project.slug}` upstream means React reuses each card's
 * DOM node across reorders, so the transition fires on the same element
 * rather than mounting/unmounting.
 */
const FLIP_DURATION_MS = 500;
const FLIP_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

function ListView({ sort }: { sort: SortMode }) {
  const projects = sortProjects(PROJECTS, sort);

  // Live element refs keyed by slug. ListCard registers/unregisters itself.
  const elementRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  // Last measured rect for each slug — what FLIP inverts against.
  const prevRects = useRef<Map<string, DOMRect>>(new Map());

  const registerRef = (slug: string, el: HTMLAnchorElement | null) => {
    if (el) elementRefs.current.set(slug, el);
    else elementRefs.current.delete(slug);
  };

  useLayoutEffect(() => {
    const nextRects = new Map<string, DOMRect>();
    elementRefs.current.forEach((el, slug) => {
      nextRects.set(slug, el.getBoundingClientRect());
    });

    // First pass: apply inverse transform + disable transition so each
    // card visually stays at its previous position despite the new DOM
    // order. Skip cards that didn't move (or are new — no prev rect).
    elementRefs.current.forEach((el, slug) => {
      const prev = prevRects.current.get(slug);
      const next = nextRects.get(slug);
      if (!prev || !next) return;
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (dx === 0 && dy === 0) return;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    });

    // Second pass on the next frame: release the inverse with a real
    // transition. requestAnimationFrame guarantees the inverse painted
    // first; if we cleared synchronously the browser would coalesce
    // both styles into a single repaint and the user would see no motion.
    const raf = requestAnimationFrame(() => {
      elementRefs.current.forEach((el) => {
        if (!el.style.transform) return;
        el.style.transition = `transform ${FLIP_DURATION_MS}ms ${FLIP_EASING}`;
        el.style.transform = "";
      });
    });

    prevRects.current = nextRects;
    return () => cancelAnimationFrame(raf);
  }, [sort]);

  return (
    <div className={styles.listShell}>
      <div className={styles.listGrid}>
        {projects.map((project) => (
          <ListCard
            key={project.slug}
            project={project}
            registerRef={registerRef}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Outer LandingView wraps the inner reader in <Suspense> because
 * useSearchParams() triggers a Suspense boundary on the static-rendered
 * landing route. Same pattern as api-client's ApiClient → ApiClientInner.
 */
export function LandingView() {
  return (
    <Suspense
      fallback={
        <div className={styles.shell}>
          <h1 className={`font-bold ${styles.heroTitle}`}>UNLV Museum</h1>
        </div>
      }
    >
      <LandingViewInner />
    </Suspense>
  );
}

function LandingViewInner() {
  const searchParams = useSearchParams();
  // Seed view + sort from URL on first render so a deep-link to e.g.
  // `/?view=list&sort=time` lands with the right surface already active.
  // Unknown values silently fall back to the default — defensive against
  // hand-edited URLs.
  const [view, setViewState] = useState<ViewMode>(() => {
    const raw = searchParams.get("view");
    return raw === "list" ? "list" : VIEW_DEFAULT;
  });
  // Sort axis is orthogonal to view. Globe ignores it (its spatial order is
  // fixed for stability); only List re-renders against it.
  const [sort, setSortState] = useState<SortMode>(() => {
    const raw = searchParams.get("sort");
    return raw === "time" ? "time" : SORT_DEFAULT;
  });
  // Setters update local state AND mirror to URL. State is authoritative
  // for rendering; URL is the shareable derived form.
  const setView = (next: ViewMode) => {
    setViewState(next);
    syncUrlState(next, sort);
  };
  const setSort = (next: SortMode) => {
    setSortState(next);
    syncUrlState(view, next);
  };
  // Legend is a floating fixed panel shown in both views. Collapsing
  // dismisses the panel down to a single chevron toggle so the page
  // breathes when the user wants it out of the way. Not URL-backed —
  // private chrome behavior, not a shareable view dimension.
  const [legendOpen, setLegendOpen] = useState(true);

  // ─── Touch input mode ────────────────────────────────────────
  //
  // Touch devices have no hover signal, so the per-vertex label
  // preview (hover-to-type) isn't accessible by default. The
  // "Hover" mode renders a crosshair that follows the user's
  // finger; while it's active, the vertex nearest the crosshair
  // gets engagement (label types in), and a tap routes to that
  // same nearest vertex's open-card action — so the user can
  // explore titles without committing to a specific dot's hit area.
  //
  // Default "tap" mode = current behavior (drag rotates, tap on
  // dot opens). Toggle is only shown on touch devices (coarse
  // pointer, no hover); on hybrid devices the user can opt into
  // either via the same toggle, with mouse interactions still
  // working alongside.
  type TouchMode = "tap" | "hover";
  const [touchMode, setTouchMode] = useState<TouchMode>("tap");
  // Coarse-pointer detection drives whether the toggle is rendered
  // at all. Default false on SSR; the client effect re-derives.
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(pointer: coarse) and (hover: none)");
    const apply = () => setIsTouchDevice(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  // Help modal — defaults closed so the SSR render matches the
  // first-paint client render (avoids hydration mismatch). On mount,
  // if localStorage doesn't have the dismissed flag, open it. Manual
  // re-open via the help button in the header.
  //
  // The setHelpOpen call is deferred via queueMicrotask so it doesn't
  // run synchronously inside the effect body — React 19's lint rule
  // flags synchronous setState there (see CLAUDE.md note). Microtask
  // scheduling drops the call onto the next tick, which is enough to
  // pass the rule while keeping the behavior identical.
  const [helpOpen, setHelpOpen] = useState(false);
  // Theme — the legend gets a redundant toggle alongside the corner
  // ThemeToggle so the feature is discoverable from the inline
  // category-row vocabulary too.
  const { resolvedMode, toggleMode } = useTheme();
  useEffect(() => {
    queueMicrotask(() => {
      if (localStorage.getItem(HELP_DISMISSED_KEY) !== "1") {
        setHelpOpen(true);
      }
    });
  }, []);
  const closeHelp = () => {
    setHelpOpen(false);
    try {
      localStorage.setItem(HELP_DISMISSED_KEY, "1");
    } catch {
      // localStorage can throw in private-browsing / disabled-storage
      // environments. Silently fail — the modal still closes; it'll
      // just reappear next visit, which is acceptable.
    }
  };

  // Ref on the globe wrapper. BreathingMesh measures it each frame to align
  // its circular cutout to wherever the globe is rendered (centers, scrolls,
  // etc.). In List view the ref is passed as null and the mesh fills.
  const globeWrapRef = useRef<HTMLDivElement | null>(null);

  // ─── Sphere transform state (owned by LandingView) ──────────
  //
  // Both the anchored-state zoom and the user-controlled zoom are
  // applied on globeScaleHost (the element globeWrapRef points to,
  // which BreathingMesh measures for its cutout). The transforms
  // live HERE — not inside PolyhedronGlobe — because the cutout
  // calculation depends on getBoundingClientRect of the same DOM
  // element that gets the transform. Splitting the transform across
  // PolyhedronGlobe + globeScaleHost would either desync the cutout
  // from the visible sphere or require manual multipliers, both of
  // which sacrifice correctness for ease-of-implementation.
  //
  // PolyhedronGlobe owns the underlying state but reports it up via
  // callbacks (onAnchoredChange, onWheelZoom). Single source of
  // truth: the transform applied here matches the state up there.
  const [anchored, setAnchored] = useState(false);
  const [userZoom, setUserZoom] = useState(1);
  const handleWheelZoom = (deltaY: number) => {
    const ratio = Math.exp(-deltaY * USER_ZOOM_WHEEL_SENSITIVITY);
    setUserZoom((z) =>
      Math.max(USER_ZOOM_MIN, Math.min(USER_ZOOM_MAX, z * ratio)),
    );
  };
  // Mirror userZoom into a ref so BreathingMesh's animation frame loop
  // can read it without forcing a re-render of the mesh component each
  // time the zoom changes. Updated in a layout effect to satisfy the
  // React 19 lint rule prohibiting ref writes during render.
  const userZoomRef = useRef(1);
  useLayoutEffect(() => {
    userZoomRef.current = userZoom;
  }, [userZoom]);

  // Window-level wheel listener so visitors can zoom by scrolling
  // ANYWHERE on the page, not only over the sphere. The sphere has
  // its own internal wheel listener (which also preventDefault's to
  // suppress ctrl+wheel browser zoom on the sphere); we skip the
  // event here when its target is inside that stage so we don't
  // double-handle.
  //
  // Only active in Globe view — when in List view, the user expects
  // the wheel to scroll the list normally.
  useEffect(() => {
    if (view !== "globe") return;
    const onWheel = (e: WheelEvent) => {
      // Skip if the sphere's own listener will handle it.
      const target = e.target as Node | null;
      const stage = document.querySelector(`.${styles.globeZoomLayer}`);
      if (stage && target && stage.contains(target)) return;
      handleWheelZoom(e.deltaY);
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [view]);
  // Two nested transform layers, each on its own transition duration:
  //
  //   outer (.globeScaleHost): view-toggle + anchored zoom/translate
  //     on the long 900ms transition matching the rotation slerp.
  //   inner (.globeZoomLayer): user-controlled zoom on a short
  //     transition so wheel-driven updates feel direct but smoothed.
  //
  // BreathingMesh measures the INNER layer's bounding rect, which
  // accounts for both ancestor transforms (getBoundingClientRect
  // returns viewport-space rect, post-cumulative-transform). The
  // cutout therefore tracks the visible sphere automatically.
  const viewToggleScale = view === "globe" ? 1 : 0;
  const outerScale = viewToggleScale * (anchored ? ANCHOR_ZOOM_SCALE : 1);
  const outerTranslateY = anchored ? ANCHOR_ZOOM_TRANSLATE_Y_PCT : 0;

  // ─── Viewport-aware vertical framing ─────────────────────────
  //
  // Anchor point: the sphere's TOP EDGE sits at a fixed fraction
  // (TOP_ANCHOR_FRACTION) of the viewport's height, regardless of
  // viewport size or zoom level. This keeps the visual "horizon"
  // of the sphere consistent across devices — on tall desktops the
  // sphere center sits well below middle; on short / mobile screens
  // the sphere extends past the bottom but its top edge anchors
  // the composition.
  //
  // Math (derived from the actual transform stack):
  //   host_layout_top   = (viewport_h - STAGE_SIZE) / 2
  //   host_rendered_top = host_layout_top + (1-outerScale)*STAGE_SIZE/2 + transY
  //     (outerScale applied about origin 50% 50% on globeScaleHost)
  //   zoomLayer_top     = host_rendered_top
  //     (userZoom applied about origin 50% 0% on globeZoomLayer)
  //   sphere_top        = zoomLayer_top + PADDING * outerScale * userZoom
  //     (PADDING is the empty stage margin around the sphere = 100)
  //
  // Solve sphere_top = target_y for transY:
  //   transY = target_y - host_layout_top
  //          - (1-outerScale)*STAGE_SIZE/2
  //          - PADDING*outerScale*userZoom
  //
  // STAGE_SIZE and PADDING duplicate values from PolyhedronGlobe's
  // internal stageSize = radius*2 + 200 formula. Kept in sync by
  // referencing the same SPHERE_BASE_RADIUS constant used to pass
  // the radius prop below — single source of truth.
  const SPHERE_BASE_RADIUS = 500;
  const STAGE_SIZE = SPHERE_BASE_RADIUS * 2 + 200;
  const STAGE_PADDING = 100; // (STAGE_SIZE - 2*SPHERE_BASE_RADIUS) / 2
  const TOP_ANCHOR_FRACTION = 0.22;
  const [viewportH, setViewportH] = useState(() =>
    typeof window === "undefined" ? 800 : window.innerHeight,
  );
  useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const targetSphereTop = viewportH * TOP_ANCHOR_FRACTION;
  const hostLayoutTop = (viewportH - STAGE_SIZE) / 2;
  // Anchored state adds an additional drop (matches the prior
  // ANCHOR_ZOOM_TRANSLATE_Y_PCT semantics — % of stage size).
  const anchoredAdditionalPx = (outerTranslateY / 100) * STAGE_SIZE;
  const totalTranslateYPx =
    targetSphereTop -
    hostLayoutTop -
    ((1 - outerScale) * STAGE_SIZE) / 2 -
    STAGE_PADDING * outerScale * userZoom +
    anchoredAdditionalPx;
  // User-zoom transition duration: long enough to smooth step changes
  // between wheel events, short enough to feel direct. ~120ms is
  // around the lower bound of perceptual "instant" — fast enough
  // that the cursor feels in control, slow enough that adjacent
  // wheel events blend into a continuous motion.
  const USER_ZOOM_TRANSITION_MS = 120;

  // polyhedron-hover-type: assign projects to vertices.
  //
  // Each vertex of the icosphere gets one project, in `orderedProjects`
  // order. Frequency-2 icosphere has 42 vertices (12 degree-5 + 30
  // degree-6). With ~30-50 projects, first 42 win their vertex; the
  // rest aren't on the sphere this phase (still accessible via list
  // view).
  //
  // Reshuffling on sort change is intentional — same as the legacy
  // Fibonacci-globe behavior, where sort changes re-mapped which
  // project occupied which Fibonacci slot.
  const orderedProjects = useMemo(
    () =>
      sort === "time"
        ? [...PROJECTS].sort((a, b) =>
            projectSortKey(b.year).localeCompare(projectSortKey(a.year)),
          )
        : PROJECTS,
    [sort],
  );
  const vertexAssignments: VertexAssignment[] = useMemo(() => {
    const vertexCount = geodesic(2).vertices.length;
    return orderedProjects.slice(0, vertexCount).map((project, i) => ({
      vertexIdx: i,
      project,
    }));
  }, [orderedProjects]);

  return (
    <div className={styles.shell}>
      {/*
        Page-wide breathing triangular mesh sits behind everything (fixed
        position, z-index: -1, pointerEvents none). The globe wrapper is
        always mounted (just scaled to 0 in List view), so its ref stays
        live and we always pass it as the cutout target. As the globe's
        wrapper shrinks via CSS scale, its bounding rect shrinks too, and
        the cutout naturally tracks it down to zero. Going back to Globe,
        the wrapper scales 0 → 1 and the cutout opens in lockstep.
      */}
      <BreathingMesh cutoutTarget={globeWrapRef} meshZoom={userZoomRef} />

      {/*
        Top-left fixed back-link. Separated from the floating header
        because conventionally the back-arrow lives at the page corner,
        not as a member of the centered header panel. Persists across
        view toggles and the header's collapsed state.
      */}
      <a
        href="https://software.infinite-syndicate.com"
        className={`text-sm ${styles.portfolioLink}`}
      >
        ← Software Portfolio
      </a>

      {/*
        Floating header: position: fixed, top-center, persists across
        both views. Now purely a control surface — view + sort toggles.
        The museum title + lede moved to the HelpModal welcome card so
        the header stays compact and the intro content lives in the
        same place visitors can summon it from later.
      */}
      <div className={styles.floatingHeader}>
        <div
          className={styles.headerBody}
          // Inline backdrop-filter (Lightning CSS strips it from CSS
          // modules in this project). Same workaround as .legendBody.
          style={{
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
          }}
        >
          <div className={styles.toggleRow}>
            <div className={styles.viewToggle}>
              <button
                onClick={() => setView("globe")}
                className={`${styles.viewButton} ${
                  view === "globe"
                    ? styles.viewButtonActive
                    : styles.viewButtonIdle
                }`}
              >
                <GlobeIcon size={14} />
                Globe
              </button>
              <button
                onClick={() => setView("list")}
                className={`${styles.viewButton} ${
                  view === "list"
                    ? styles.viewButtonActive
                    : styles.viewButtonIdle
                }`}
              >
                <List size={14} />
                List
              </button>
            </div>
            {/*
              Sort axis: applies to both views. In List it swaps section
              grouping; in Globe it re-shuffles Fibonacci-sphere positions
              and cards fly to their new spots (stable `key={item.id}` +
              a CSS transition on .item's transform).
            */}
            <div className={styles.viewToggle}>
              <button
                onClick={() => setSort("category")}
                className={`${styles.viewButton} ${
                  sort === "category"
                    ? styles.viewButtonActive
                    : styles.viewButtonIdle
                }`}
              >
                <FolderTree size={14} />
                Category
              </button>
              <button
                onClick={() => setSort("time")}
                className={`${styles.viewButton} ${
                  sort === "time"
                    ? styles.viewButtonActive
                    : styles.viewButtonIdle
                }`}
              >
                <Clock size={14} />
                Time
              </button>
            </div>
            {/*
              Touch-mode toggle. Only rendered on touch devices (coarse
              pointer + no hover). Lets touch users opt into a crosshair-
              cursor "Hover" mode where finger movement previews vertex
              labels instead of immediately opening cards.
            */}
            {isTouchDevice && view === "globe" && (
              <div className={styles.viewToggle}>
                <button
                  onClick={() => setTouchMode("tap")}
                  className={`${styles.viewButton} ${
                    touchMode === "tap"
                      ? styles.viewButtonActive
                      : styles.viewButtonIdle
                  }`}
                >
                  <Hand size={14} />
                  Tap
                </button>
                <button
                  onClick={() => setTouchMode("hover")}
                  className={`${styles.viewButton} ${
                    touchMode === "hover"
                      ? styles.viewButtonActive
                      : styles.viewButtonIdle
                  }`}
                >
                  <Crosshair size={14} />
                  Hover
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/*
        Both views are always mounted. Switching toggles a data-view
        attribute on each surface; CSS scales the inactive one to 0
        (and reduces its height to 0 so it doesn't reserve layout space
        when collapsed). Keeping the globe in the tree means its ref
        stays live during the close animation — the mesh cutout shrinks
        in lockstep with the globe rather than snapping at unmount.
      */}
      <div className={styles.globeWrap} data-view-active={view === "globe"}>
        <div
          className={styles.globeScaleHost}
          // The translateY depends on window.innerHeight which is
          // only known on the client. SSR uses an 800px default; the
          // first client render corrects it. suppressHydrationWarning
          // because this attribute legitimately differs between server
          // and client (it's window-sized) and we accept the one-frame
          // pop on initial paint as a known cost of viewport-aware
          // framing — alternative would be deferring all sphere
          // rendering until after mount, which is worse.
          suppressHydrationWarning
          style={{
            // Outer layer: viewport-aware vertical offset (computed
            // in JS above to honor "keep the sphere's top edge in
            // frame at any viewport size + zoom level") + view-
            // toggle / anchored scales. Long transition tied to the
            // rotation slerp so anchor + scale move as one gesture.
            transform: `translateY(${totalTranslateYPx}px) scale(${outerScale})`,
            transition: `transform ${ANCHOR_SWING_MS}ms ${ANCHOR_ZOOM_EASING}`,
          }}
        >
          <div
            ref={globeWrapRef}
            className={styles.globeZoomLayer}
            style={{
              // Inner layer: user-controlled zoom only. Short
              // transition for smooth wheel input. BreathingMesh
              // measures THIS element — its bounding rect reflects
              // BOTH this scale and the ancestor scale (cumulative).
              transform: `scale(${userZoom})`,
              transition: `transform ${USER_ZOOM_TRANSITION_MS}ms ease-out`,
            }}
          >
            <PolyhedronGlobe
              radius={500}
              assignments={vertexAssignments}
              onAnchoredChange={setAnchored}
              onWheelZoom={handleWheelZoom}
              touchMode={touchMode}
              userZoom={userZoom}
            />
          </div>
        </div>
      </div>
      <div className={styles.listMount} data-view-active={view === "list"}>
        <ListView sort={sort} />
      </div>

      {/*
        Floating legend: position: fixed, persists across both views. The
        panel itself is user-select: none (so dragging the globe doesn't
        select its text); only the chevron toggle is interactive. A
        radial gradient backing softens the mesh behind it so the dot
        colors stay legible. Collapses to just the chevron when dismissed.
      */}
      <div className={styles.floatingLegend} data-legend-open={legendOpen}>
        <div
          className={styles.legendBody}
          // No data-mesh-dodge here: the radial gradient + 2px blur
          // already give the legend enough legibility on top of the
          // mesh, and tagging it would (a) push mesh dots out of the
          // legend's bbox even when collapsed, and (b) leave a
          // card-shaped hole in the mesh under the panel that drew
          // the eye more than the panel itself.
          //
          // Inline backdrop-filter (Lightning CSS strips it from CSS
          // modules in this project). Applied on the body — not the
          // outer wrapper — because the wrapper is pointer-events:none
          // and isn't the painted surface; .legendBody is the visible
          // pill.
          style={{
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
          }}
        >
          {/*
            Category legend rows. The "drag to rotate / click a card"
            instructions moved into the HelpModal; the help row at
            the end of this list is the entry point back to that
            modal. Each category dot is a radial gradient styled to
            visually echo the polyhedron's vertex glow.
          */}
          <div className={styles.legendDots}>
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => (
              <span key={cat} className={`text-xs ${styles.legendItem}`}>
                <CategoryGlowDot category={cat} />
                {CATEGORY_LABELS[cat]}
              </span>
            ))}
            <button
              type="button"
              className={`text-xs ${styles.legendItem} ${styles.legendHelpButton}`}
              onClick={() => setHelpOpen(true)}
              aria-label="Show help"
            >
              <HelpCircle size={12} className={styles.legendHelpIcon} />
              help
            </button>
            {/*
              Redundant theme toggle — same visual treatment as the
              help button so the pair reads as a tight cluster.
              Label and icon are the *destination* mode (the action
              the click performs), matching the corner ThemeToggle's
              convention.
            */}
            <button
              type="button"
              className={`text-xs ${styles.legendItem} ${styles.legendHelpButton}`}
              onClick={toggleMode}
              aria-label={
                resolvedMode === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >
              {resolvedMode === "dark" ? (
                <Sun size={12} className={styles.legendHelpIcon} />
              ) : (
                <Moon size={12} className={styles.legendHelpIcon} />
              )}
              {resolvedMode === "dark" ? "light" : "dark"}
            </button>
          </div>
        </div>
        <button
          type="button"
          className={styles.legendToggle}
          style={{
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
          }}
          onClick={() => setLegendOpen((v) => !v)}
          aria-label={legendOpen ? "Hide legend" : "Show legend"}
          aria-expanded={legendOpen}
        >
          {legendOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>

      {/*
        Theme toggle — sibling to the HelpModal's closed-state button,
        offset to its left. Fades out while the modal is open so the
        corner cluster doesn't compete with the foregrounded card.
        Lives outside HelpModal because the toggle's lifetime and
        positioning are independent — it never opens into a modal,
        it just flips a class on <html>.
      */}
      <ThemeToggle variant="landing" hidden={helpOpen} />

      {/*
        Help modal. Auto-opens on first visit (when no
        unlv-museum.help-dismissed flag in localStorage); manual reopen
        via the top-right help button. Any close path (X, ESC, backdrop
        click, "Got it") persists the dismissal flag.
      */}
      <HelpModal
        open={helpOpen}
        onOpen={() => setHelpOpen(true)}
        onClose={closeHelp}
      />
    </div>
  );
}
