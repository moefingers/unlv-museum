"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Globe } from "@/components/ui/Globe";
import { BreathingMesh } from "@/components/ui/BreathingMesh";
import {
  PROJECTS,
  CATEGORY_LABELS,
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
} from "lucide-react";
import styles from "./LandingView.module.css";

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
 * Globe-card hex pairs. Kept as literal hex (not zcanon tokens) because
 * the globe cards force a white-ish surface for legibility regardless of
 * museum theme — the category accent only shows through as a faint
 * gradient tint blended over a white front face. Token-based oklch
 * mixing would break that contrast guarantee on dark backgrounds.
 *
 * The category-color identity for non-globe surfaces (list cards, legend
 * dots, etc.) uses the `--category-*` tokens in globals.css instead,
 * accessed via the `.categoryDot[data-category=...]` CSS Module rule.
 */
const CATEGORY_HEX: Record<Category, { light: string; dark: string }> = {
  games: { light: "#22c55e", dark: "#15803d" },
  "full-stack": { light: "#3b82f6", dark: "#1d4ed8" },
  frontend: { light: "#a855f7", dark: "#7e22ce" },
  api: { light: "#f59e0b", dark: "#b45309" },
  python: { light: "#06b6d4", dark: "#0e7490" },
  exercises: { light: "#ec4899", dark: "#be185d" },
};

const DEPTH_LAYERS = 5;
const LAYER_STEP = 1.5;

function ProjectCard({ project }: { project: Project }) {
  const hex = CATEGORY_HEX[project.category];

  return (
    <Link
      href={project.href ?? `/${project.slug}`}
      className={styles.projectCard}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className={styles.projectCardLayer}>
        <div
          className={styles.projectFront}
          style={{
            background: `linear-gradient(315deg, rgba(255,255,255,0.97), rgba(255,255,255,0.78)), linear-gradient(315deg, ${hex.light}22, ${hex.dark}66)`,
          }}
        >
          <div className={styles.projectFrontBody}>
            <h3
              className={`text-sm font-semibold truncate ${styles.projectTitle}`}
            >
              {project.title}
            </h3>
            <p className={`text-xs ${styles.projectYear}`}>{project.year}</p>
          </div>
        </div>

        {Array.from({ length: DEPTH_LAYERS }, (_, i) => {
          const t = (i + 1) / DEPTH_LAYERS;
          const z = -(i + 1) * LAYER_STEP;
          const grow = t * 2;
          return (
            <div
              key={i}
              className={styles.projectBackingLayer}
              style={{
                inset: `${-grow}px`,
                transform: `translateZ(${z}px)`,
                background: `linear-gradient(135deg, ${hex.light}, ${hex.dark})`,
                opacity: 0.7 + t * 0.3,
              }}
            />
          );
        })}
      </div>
    </Link>
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
      href={project.href ?? `/${project.slug}`}
      className={styles.listCardLink}
      // backdrop-filter is applied inline because Turbopack/Lightning CSS
      // in this project strips it from CSS Modules (confirmed via
      // computed-style inspection — the property was dropped from the
      // served stylesheet). Inline survives the pipeline untouched.
      style={{
        backdropFilter: "blur(2px) saturate(1.4)",
        WebkitBackdropFilter: "blur(2px) saturate(1.4)",
      }}
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
function sortProjects(
  projects: readonly Project[],
  sort: "category" | "time",
): Project[] {
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

function ListView({ sort }: { sort: "category" | "time" }) {
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

export function LandingView() {
  const [view, setView] = useState<"globe" | "list">("globe");
  // Sort axis is orthogonal to view. Globe ignores it (its spatial order is
  // fixed for stability); only List re-renders against it.
  const [sort, setSort] = useState<"category" | "time">("category");
  // Legend is a floating fixed panel shown in both views. Collapsing
  // dismisses the panel down to a single chevron toggle so the page
  // breathes when the user wants it out of the way.
  const [legendOpen, setLegendOpen] = useState(true);

  // Ref on the globe wrapper. BreathingMesh measures it each frame to align
  // its circular cutout to wherever the globe is rendered (centers, scrolls,
  // etc.). In List view the ref is passed as null and the mesh fills.
  const globeWrapRef = useRef<HTMLDivElement | null>(null);

  // Apply the sort axis to BOTH List and Globe. For Globe this changes which
  // Fibonacci-sphere index each project maps to, so toggling re-shuffles
  // positions. With `key={item.id}` stable, React reuses each card's DOM
  // node and only its transform changes — CSS transition on .item handles
  // the flight across the sphere.
  const orderedProjects =
    sort === "time"
      ? [...PROJECTS].sort((a, b) =>
          projectSortKey(b.year).localeCompare(projectSortKey(a.year)),
        )
      : PROJECTS;
  const projectCards = orderedProjects.map((project) => ({
    id: project.slug,
    node: <ProjectCard project={project} />,
  }));
  const globeItems = [
    { id: "_spacer-top", node: <div /> },
    ...projectCards,
    { id: "_spacer-bottom", node: <div /> },
  ];

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
      <BreathingMesh cutoutTarget={globeWrapRef} />
      <a
        href="https://software.infinite-syndicate.com"
        className={`text-sm ${styles.portfolioLink}`}
      >
        ← Software Portfolio
      </a>
      <h1 className={`font-bold ${styles.heroTitle}`}>UNLV Museum</h1>
      <p className={styles.heroLede}>
        Projects from UNLV&apos;s software development course, rebuilt across
        three tiers: original, enhanced, and reimagined.
      </p>

      <div className={styles.toggleRow}>
        <div className={styles.viewToggle}>
          <button
            onClick={() => setView("globe")}
            className={`${styles.viewButton} ${
              view === "globe" ? styles.viewButtonActive : styles.viewButtonIdle
            }`}
          >
            <GlobeIcon size={14} />
            Globe
          </button>
          <button
            onClick={() => setView("list")}
            className={`${styles.viewButton} ${
              view === "list" ? styles.viewButtonActive : styles.viewButtonIdle
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
              sort === "time" ? styles.viewButtonActive : styles.viewButtonIdle
            }`}
          >
            <Clock size={14} />
            Time
          </button>
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
        <div ref={globeWrapRef} className={styles.globeScaleHost}>
          <Globe items={globeItems} />
        </div>
        <p className={`text-xs ${styles.globeHint}`}>
          Drag to rotate. Click a card to explore.
        </p>
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
      <div
        className={styles.floatingLegend}
        data-legend-open={legendOpen}
        // Mesh dodge so the breathing dots avoid the legend backing.
        data-mesh-dodge=""
      >
        <div
          className={styles.legendBody}
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
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => (
            <span key={cat} className={`text-xs ${styles.legendItem}`}>
              <span className={styles.categoryDot} data-category={cat} />
              {CATEGORY_LABELS[cat]}
            </span>
          ))}
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
    </div>
  );
}
