import { type ReactNode } from "react";
import { OriginalFrame } from "@/components/ui/OriginalFrame";
import { PythonFundamentalsOriginal } from "@/components/originals/PythonFundamentalsOriginal";
import { ServerAppOriginal } from "@/components/originals/ServerAppOriginal";
import { JsDomEventsEnhanced } from "@/components/enhanced/JsDomEventsEnhanced";
import { AdminPortalEnhanced } from "@/components/enhanced/AdminPortalEnhanced";
import sourcesGenerated from "./sources.generated.json";

/**
 * One navigable page inside a multi-page original. The label appears in
 * the per-project page rail; `src` is the iframe URL (typically a
 * /originals/<slug>/... static asset path). See <MultiPageOriginal> and
 * the `pages` field on Project below.
 */
export interface ProjectPage {
  label: string;
  src: string;
}

/**
 * URL-safe slug derived from a page's label. Used as the `?page=<slug>`
 * query-param value so multi-page originals are shareable / bookmarkable
 * (mirrors api-client's `?api=<id>` pattern). Lowercase, kebab-cased,
 * non-alphanumerics collapsed to single hyphens, with trim.
 *
 * Stability: the slug shifts if a label is reworded, which is acceptable
 * — labels are stable in practice, and the route-level normalization
 * (unknown ?page= redirects to the first page) recovers any stale link.
 */
export function pageSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type ViewMode = "original" | "enhanced" | "reimagined";

/**
 * Pointer to a source repo that backs an original tier. Populated by
 * `scripts/sync-source.ts` and stored in `sources.generated.json`.
 * See CONTEXT/internal_docs/sources.md for the full submodule workflow.
 */
export interface SourceRef {
  repo: string; // "owner/repo"
  branch: string; // typically "museum-ready"
  commit: string; // SHA pinned at last sync
  lockHash: string; // sha256 of public/originals/<slug>/
  /** ISO YYYY-MM-DD of owner's first commit on `original`, or null. */
  ownerFirstCommit: string | null;
  /** ISO YYYY-MM-DD of owner's last commit on `original`, or null. */
  ownerLastCommit: string | null;
  /** ISO YYYY-MM-DD of GitHub repo creation (= fork date for forks), or null. */
  forkedAt: string | null;
}

/**
 * Pretty-format the display date for a project using a cascade:
 *   1. Owner has commits on `original` → first-to-last range (or single date
 *      if same month).
 *   2. No owner commits (forked starter) → fork creation date.
 *   3. Manual `Project.year` override wins when set; this function only
 *      handles the derived-from-git path.
 *
 * Returns null when no derivable date is available — caller falls back.
 */
export function formatProjectDate(ref: SourceRef): string | null {
  if (ref.ownerFirstCommit && ref.ownerLastCommit) {
    return formatDateRange(ref.ownerFirstCommit, ref.ownerLastCommit);
  }
  if (ref.forkedAt) return formatMonthYear(ref.forkedAt);
  return null;
}

function formatMonthYear(iso: string): string {
  // iso is YYYY-MM-DD; parse as UTC to avoid TZ shifts at month boundaries.
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[m - 1]} ${y}`;
}

function formatDateRange(firstIso: string, lastIso: string): string {
  const first = formatMonthYear(firstIso);
  const last = formatMonthYear(lastIso);
  if (first === last) return first;
  return `${first} – ${last}`;
}

/**
 * Container registry — sibling groups for projects that share a series.
 *
 * A container is a navigation affordance, not a registry tier. Each
 * containerized project still has its own slug, its own original/enhanced/
 * reimagined tiers, and its own card on the landing page. The container
 * shows up in two places only:
 *   1. The URL — `/<container>/<slug>` instead of `/<slug>`
 *   2. The project detail chrome — a SiblingRail listing the other leaves
 *
 * Containers do NOT have their own pages. `/<container>` redirects to a
 * default leaf (declared in `next.config.ts`).
 *
 * Adding a container: declare it here, then set `container` on each member
 * project. Leaf slug uniqueness is per-container — `bootstrap` under
 * `react-exercises` and `bootstrap` under some other series wouldn't collide.
 */
export const CONTAINERS = {
  // UNLV curriculum chapter 2 (HTML). Leaves: restaurant-menu (2.3.2),
  // bird-songs (2.4.1), improved-form (2.5.2), layouts (2.x).
  "html-fundamentals": { title: "HTML Fundamentals" },
  // UNLV curriculum chapter 3 (CSS). Leaves: css-demo, hacker-times
  // (3.2.4), animations (3.3.2), responsive-boxes (3.4.3).
  "css-fundamentals": { title: "CSS Fundamentals" },
  // UNLV curriculum chapter 5 (JavaScript). Leaves are array-ordered by
  // chapter number so the future Globe graph layout (curriculum-curve on
  // sphere surface — see project notes 2026-05-21) can read leaf
  // positions directly from the PROJECTS array without a separate
  // ordinal field.
  "js-exercises": { title: "JavaScript Exercises" },
  // UNLV curriculum chapter ~6 (React Router series).
  "react-exercises": { title: "React Router Series" },
} as const;

export type ContainerId = keyof typeof CONTAINERS;

export interface Project {
  /**
   * Leaf slug. Unique within a container, or globally when `container` is
   * unset. URL composition goes through `projectPath()` — never concatenate
   * container and slug by hand.
   */
  slug: string;
  /**
   * Container ID for projects that belong to a sibling group (React Router
   * exercises, web-game parts, python fundamentals, etc.). When set, the URL
   * becomes `/<container>/<slug>` and the project detail chrome renders a
   * SiblingRail with the other leaves. When unset, the project is a flat
   * top-level entry at `/<slug>`. Containers themselves are declared in the
   * `CONTAINERS` map below.
   */
  container?: ContainerId;
  title: string;
  description: string;
  /**
   * Full-sentence project synopsis used for the source repo's GitHub
   * description. Composed as: "Now hosted in my UNLV Museum - ${synopsis}
   * (UNLV Assignment, ${year})". Distinct from `description`, which is a
   * short tagline shown on the museum landing card.
   */
  synopsis?: string;
  year: string;
  category: Category;
  /** Override link destination (e.g. /api-client?api=X) */
  href?: string;
  /**
   * GitHub "owner/repo" slug for the project's ORIGINAL-tier source
   * repository, when one exists. Used by the /github-banners endpoint
   * to fetch live repo facts (fork status, languages, commits) even
   * before sync:source has populated sources.generated.json, and by
   * `resolveTierRepoUrl` to render the chrome's source link.
   *
   * `repoEnhanced` / `repoReimagined` carry the same idea for the
   * later tiers, which often live in independent repos. Each tier's
   * URL is resolved independently — surface only the link for the
   * tier the user is currently viewing.
   */
  repo?: string;
  repoEnhanced?: string;
  repoReimagined?: string;
  /**
   * Which tiers are part of this project's museum journey. Banner tier
   * indicators only show the entries listed here. Defaults to all three;
   * narrow for simple repos that will never get a reimagined version.
   */
  plannedTiers?: ViewMode[];
  /** Tech labels per tier. Omit to suppress that tier label. */
  techOriginal?: string[];
  techEnhanced?: string[];
  techReimagined?: string[];
  /** Content per tier. Omit to indicate the tier doesn't exist. */
  original?: ReactNode;
  enhanced?: ReactNode;
  reimagined?: ReactNode;
  /** Escape hatch: enhanced lives in another deployment (rare). */
  enhancedExternal?: string;
  /** Typical reimagined: dedicated rebuild in its own repo + Vercel project. */
  reimaginedExternal?: string;
  progression?: boolean;
  /** Per-mode contextual notes shown in collapsible header */
  notes?: Partial<Record<ViewMode, string>>;
  /**
   * Multi-page originals: sibling HTML files that form a tour or
   * walkthrough. When set, render the project's `original` as
   * `<MultiPageOriginal pages={p.pages} />` so the viewer gets a page
   * picker beside the iframe. Order in the array is the order shown
   * in the rail (and the page-1 default is `pages[0]`).
   */
  pages?: ProjectPage[];
  /**
   * Cross-link to the api-client entry that exposes this project's
   * backend. Set on the FRONTEND half of an api+client pair (e.g.
   * admin-portal points at "admin-portal-api"). Value is the target
   * project's `slug`, not a URL — `resolveTierSources` composes the
   * `/api-client?api=<slug>` link.
   *
   * Pairing convention: any project that ships both a public frontend
   * (iframe-served original or pages) AND a poke-able JSON backend
   * gets two museum entries — the frontend lives at /<slug>, the
   * backend lives at /api-client?api=<slug>. The two are linked
   * bidirectionally via siblingApiClient ↔ siblingFrontend so visitors
   * can hop between them from either side. See
   * CONTEXT/internal_docs/architecture.md for the full pattern.
   */
  siblingApiClient?: string;
  /**
   * Cross-link from an api-client entry back to its frontend
   * counterpart. Set on the BACKEND half of an api+client pair (e.g.
   * admin-portal-api points at "admin-portal"). Value is the frontend
   * project's `slug`; `resolveTierSources` composes the `/<slug>` link.
   * Mirror of siblingApiClient — keep both in sync when pairing.
   */
  siblingFrontend?: string;
}

export type Category =
  | "games"
  | "full-stack"
  | "frontend"
  | "api"
  | "python"
  | "exercises";

export const CATEGORY_LABELS: Record<Category, string> = {
  games: "Games",
  "full-stack": "Full-Stack Applications",
  frontend: "Frontend & UI",
  api: "APIs & Backend",
  python: "Python",
  exercises: "Learning Exercises",
};

function Placeholder({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "60vh",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <p
        className="text-muted"
        style={{ color: "oklch(from var(--muted-foreground) l c h / 0.6)" }}
      >
        {label}
      </p>
    </div>
  );
}

const COMING_SOON = <Placeholder label="Coming soon" />;

/**
 * Look up the source pointer for a slug, if its conversion has been run.
 * Returns undefined for projects whose submodule conversion is pending,
 * or that have no source repo (backend-only, Next.js-native).
 */
export function getSourceRef(slug: string): SourceRef | undefined {
  const sources = sourcesGenerated as Record<string, SourceRef>;
  return sources[slug];
}

/**
 * One row in the chrome's source-links panel. A `label` (used as the
 * link text — "Original source", "Enhanced source", "main branch",
 * etc.) and the absolute GitHub URL it points to.
 */
export interface TierSource {
  label: string;
  url: string;
}

/**
 * Source links to surface in the chrome for a specific tier. Returns
 * an array so a single tier can carry multiple pointers — today it's
 * one entry per tier, but the shape is forward-compatible with
 * museum-ready vs. main, monorepo subdirectories, etc., which will
 * land here as additional rows without touching the consumer.
 *
 * Original tier: when a SourceRef exists, the URL targets the pinned
 * museum-ready branch (sources.generated.json's `branch`) so the link
 * lands on the same code the iframe serves. Without a SourceRef, falls
 * back to the repo root — branch is the upstream default.
 *
 * Enhanced/Reimagined: use the tier-specific `repoEnhanced` /
 * `repoReimagined` field directly. No branch suffix — these repos
 * aren't museum-pinned. `enhancedExternal` / `reimaginedExternal`
 * are deployment URLs and intentionally NOT consulted here; they
 * point to live sites, not source code.
 */
export function resolveTierSources(
  project: Project,
  tier: ViewMode,
): TierSource[] {
  // `#readme` lands the visitor scrolled past the file listing and onto
  // the README block — where the museum banner lives. The page renders
  // the same with or without the fragment; this just sets initial scroll
  // position so the project intro is the first thing in view.
  const README_FRAGMENT = "#readme";
  if (tier === "original") {
    if (!project.repo) return [];
    const ref = getSourceRef(project.slug);
    if (ref?.branch) {
      return [
        {
          label: "Original source",
          url: `https://github.com/${project.repo}/tree/${ref.branch}${README_FRAGMENT}`,
        },
      ];
    }
    return [
      {
        label: "Original source",
        url: `https://github.com/${project.repo}${README_FRAGMENT}`,
      },
    ];
  }
  const tierRepo =
    tier === "enhanced" ? project.repoEnhanced : project.repoReimagined;
  if (!tierRepo) return [];
  const label = tier === "enhanced" ? "Enhanced source" : "Reimagined source";
  return [{ label, url: `https://github.com/${tierRepo}${README_FRAGMENT}` }];
}

/**
 * Cross-link to the paired half of an api+client project, when one is
 * declared. Returns null for projects that aren't half of a pair.
 *
 * Used by ProjectChrome to render a "Try the live API" / "Open the
 * frontend" affordance alongside the source-on-GitHub links in the
 * notes panel. The two ends of a pair point at each other:
 *
 *   admin-portal       (frontend) → siblingApiClient: "admin-portal"
 *   admin-portal-api   (backend)  → siblingFrontend:  "admin-portal"
 *
 * IMPORTANT asymmetry: `siblingApiClient` is the api-client's `?api=`
 * query value (matches an entry in `api-data.ts`), while
 * `siblingFrontend` is a PROJECT SLUG (matches a `slug` on a Project
 * in PROJECTS). They look similar — both are short identifiers — but
 * they index different namespaces. For admin-portal the two values
 * happen to be the same string ("admin-portal"); for the sql-demo
 * pair they don't (api id is "sql-demo", frontend slug is
 * "sql-injection-demo").
 *
 * Either end's link surfaces only its own direction — the function
 * inspects which sibling field is set on the passed project. The
 * resolver doesn't validate that the target slug exists; that's the
 * caller's job (or a future build-time linter). See
 * CONTEXT/internal_docs/architecture.md for the pairing convention.
 */
export interface SiblingLink {
  label: string;
  url: string;
}
export function resolveSiblingLink(
  project: Project,
  tier: ViewMode = "original",
): SiblingLink | null {
  if (project.siblingApiClient) {
    // The frontend → api-client direction: the target is a viewer-route
    // entry (`/api-client?api=<id>`), not a museum project path, so
    // projectPath() doesn't apply here. The api-client's `?api=` value
    // is the partner slug.
    //
    // Tier-aware: when the visitor is on the frontend's Enhanced tier,
    // route to the api-client's v=2 view so they land on the matching
    // endpoint list (the source-faithful endpoints belong to v1; the
    // Replaced UI exercises v2). Same logic for Reimagined when that
    // tier has its own api shape (none yet, but the field is in place).
    const params = new URLSearchParams();
    params.set("api", project.siblingApiClient);
    if (tier === "enhanced") params.set("v", "2");
    return {
      label: tier === "enhanced" ? "Try the live API (v2)" : "Try the live API",
      url: `/api-client?${params.toString()}`,
    };
  }
  if (project.siblingFrontend) {
    // The api-client → frontend direction: the target IS a museum
    // project slug that may live inside a container. Look up the target
    // and compose via projectPath() so containerized leaves resolve
    // correctly (e.g. admin-portal is now /js-exercises/admin-portal).
    // Falls back to a flat `/<slug>` URL when the target isn't found —
    // shouldn't happen at runtime (the cross-link only renders when
    // both ends are wired), but the fallback keeps the chrome safe
    // against stale data.
    //
    // Tier-aware: when the visitor is on the API's Enhanced view, link
    // to the frontend's Enhanced tier (the Replaced UI) instead of the
    // first multi-page-original landing URL.
    const target = PROJECTS.find((p) => p.slug === project.siblingFrontend);
    let url: string;
    if (target) {
      if (tier === "enhanced" && target.enhanced != null) {
        url = `/${projectPath(target)}/enhanced`;
      } else if (tier === "reimagined" && target.reimagined != null) {
        url = `/${projectPath(target)}/reimagined`;
      } else {
        url = projectLandingUrl(target);
      }
    } else {
      url = `/${project.siblingFrontend}`;
    }
    return {
      label:
        tier === "enhanced"
          ? "Open the Enhanced frontend"
          : "Open the frontend",
      url,
    };
  }
  return null;
}

/**
 * URL path for a project. `/<container>/<slug>` if the project belongs to
 * a container, `/<slug>` otherwise. Single source of truth for URL
 * composition — never concatenate the parts by hand at call sites.
 */
export function projectPath(p: Project): string {
  return p.container ? `${p.container}/${p.slug}` : p.slug;
}

/**
 * Canonical landing URL for the named tier of a project. Single source of
 * truth for link composition across the museum — the tier picker,
 * SiblingRail, search results, and any future cross-link generator all
 * call into this so that the URL a visitor actually lands on is the URL
 * baked into the link's `href`.
 *
 * The Original tier of a multi-page original needs a `?page=<first>`
 * suffix because the route's `renderProjectBody()` resolves a bare
 * `/<path>` against `pages[0]` and issues a server-side `redirect()`
 * to the canonical page URL. Composing the suffix here means the
 * `<Link href>` is already at the destination — the click fires one
 * client-side navigation, one view transition, no chrome flicker. The
 * redirect stays in place as a safety net for direct URL hits and
 * bookmarks of the bare path, but never fires for in-app clicks.
 *
 * For external tiers (enhancedExternal / reimaginedExternal) we return
 * the absolute URL the museum redirects to.
 */
export function projectLandingUrl(
  p: Project,
  mode: ViewMode = "original",
): string {
  if (mode === "enhanced") {
    return p.enhancedExternal ?? `/${projectPath(p)}/enhanced`;
  }
  if (mode === "reimagined") {
    return p.reimaginedExternal ?? `/${projectPath(p)}/reimagined`;
  }
  // Original.
  const base = `/${projectPath(p)}`;
  if (p.pages && p.pages.length > 0) {
    return `${base}?page=${pageSlug(p.pages[0]!.label)}`;
  }
  return base;
}

/**
 * Reverse direction: given a URL path (with or without leading slash, with
 * or without trailing tier segment like `/enhanced`), find the matching
 * project. Container + leaf collisions are allowed by design — the lookup
 * uses (container, slug) as a composite key.
 *
 * Returns undefined when no project matches.
 */
export function findByPath(path: string): Project | undefined {
  const segments = path.replace(/^\/+|\/+$/g, "").split("/");
  if (segments.length === 0 || !segments[0]) return undefined;

  // Drop a trailing tier segment if present so /react-exercises/music-search/enhanced
  // resolves to the same project as /react-exercises/music-search.
  const TIER_SUFFIXES = new Set(["enhanced", "reimagined"]);
  const tail = segments[segments.length - 1]!;
  if (segments.length > 1 && TIER_SUFFIXES.has(tail)) segments.pop();

  if (segments.length === 1) {
    return PROJECTS.find((p) => !p.container && p.slug === segments[0]);
  }
  if (segments.length === 2) {
    const [container, slug] = segments;
    return PROJECTS.find((p) => p.container === container && p.slug === slug);
  }
  return undefined;
}

export const PROJECTS: Project[] = [
  // GAMES
  {
    slug: "milestown",
    repo: "moefingers/UNLV-MilestO-W-N",
    title: "MilestO-W-N",
    description:
      "1-4 player territory game. Three generations: original, multiplayer remake, and OWN3.",
    synopsis:
      "1-4 player territory game built in vanilla JS — the seed of a three-generation chain: the original, a multiplayer WebSocket remake, and the OWN3 rebuild.",
    year: "Jan 2024",
    category: "games",
    techOriginal: ["JavaScript", "HTML", "CSS"],
    techEnhanced: ["JavaScript", "WebSocket", "P2P Mesh"],
    techReimagined: ["Next.js", "Drizzle", "Neon", "WebRTC"],
    original: <OriginalFrame src="/originals/milestown/index.html" />,
    enhanced: COMING_SOON,
    enhancedExternal: "https://moefingers.github.io/milestown2/",
    reimagined: COMING_SOON,
    reimaginedExternal: "https://own3.vercel.app",
    progression: true,
  },
  {
    slug: "gwhac-a-mole",
    title: "Gwhac-A-Mole",
    description: "Guacamole-themed whack-a-mole React game.",
    year: "Mar 2024",
    category: "games",
    techOriginal: ["React", "Create React App", "CSS"],
    original: <OriginalFrame src="/originals/gwhac-a-mole/index.html" />,
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  // FULL-STACK
  {
    slug: "rest-rant",
    repo: "moefingers/rest-rant-monorepo",
    title: "Rest-Rant (SPA)",
    description:
      "Restaurant rating and review SPA. May 2024 — CRA frontend + separate Express/Postgres backend.",
    synopsis:
      "Restaurant rating and review monorepo from May 2024 — a CRA + React Router SPA paired with an Express + Sequelize + Postgres backend. The museum preserves the frontend as-is and reimplements the backend in Next.js + Drizzle so the SPA functions end-to-end against the same API surface.",
    year: "May 2024",
    category: "full-stack",
    techOriginal: ["React (CRA)", "React Router", "Express", "PostgreSQL"],
    original: <OriginalFrame src="/originals/rest-rant/index.html" />,
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
    notes: {
      original:
        "Frontend SPA preserved as-is. Its Express/Postgres backend was reimplemented as /api/rest-rant (Next.js + Drizzle/Neon) so the SPA functions end-to-end — see the Rest-Rant API card in /api-client.",
    },
  },
  {
    slug: "rest-rant-ssr",
    repo: "moefingers/UNLV-rest-rant",
    title: "Rest-Rant (SSR)",
    description:
      "Restaurant rating SSR app. Feb 2024 — JSX views, form-driven mutations.",
    synopsis:
      "Restaurant rating SSR app from Feb 2024 — original used Express + express-react-views + MongoDB, server-rendering JSX views. The museum preserves the JSX views and SSR character verbatim while reimplementing the data layer as Next.js Server Components + Drizzle/Neon.",
    year: "Feb 2024",
    category: "full-stack",
    techOriginal: [
      "Next.js Server Components",
      "Server Actions",
      "Drizzle",
      "Neon",
    ],
    original: <OriginalFrame src="/originals/rest-rant-ssr" />,
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
    notes: {
      original:
        "The underlying architecture has been vastly altered. The Feb 2024 source ran on Express + express-react-views + MongoDB — none of which is statically hostable. The JSX views and the SSR character (server-rendered per route, form-driven mutations) are preserved verbatim, but the data layer is now Next.js Server Components + Server Actions + Postgres/Neon, sharing storage with the Rest-Rant (SPA) entry. The debug `* { outline: 1px solid black }` rule and the placebear placeholder images are preserved from the original.",
      enhanced:
        "Future: same SSR feel, but with the debug outline removed, polished Bootstrap styling, and accurate restaurant photos instead of placebear stand-ins.",
    },
  },
  {
    slug: "commerce-array",
    title: "Commerce Array",
    description: "Full-stack e-commerce platform.",
    year: "Apr 2024",
    category: "full-stack",
    techOriginal: ["Express", "PostgreSQL", "Sequelize", "React"],
    original: <OriginalFrame src="/originals/commerce-array/index.html" />,
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  {
    slug: "enterprize",
    title: "EnterPrize",
    description:
      "Enterprise asset management. Evolved from QuirkTruck through multiple iterations.",
    year: "Jun 2024",
    category: "full-stack",
    techOriginal: ["Next.js 15", "Prisma", "NeonDB"],
    original: <OriginalFrame src="/originals/quirk-truck/index.html" />,
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
    reimaginedExternal: "https://enterprize-pi.vercel.app",
    progression: true,
  },
  {
    slug: "nextjs-dashboard",
    title: "Next.js Dashboard",
    description: "Next.js app with authentication and database.",
    year: "Jun 2024",
    category: "full-stack",
    techOriginal: ["Next.js 16", "NextAuth v5", "Vercel Postgres"],
    original: (
      <ServerAppOriginal
        title="Next.js Dashboard"
        tech="Next.js 16 + NextAuth v5 + Vercel Postgres"
        description="Full-featured dashboard with invoices, authentication, and database integration. Built following the official Next.js tutorial."
        note="This was a full-stack Next.js app. The original deployment is no longer live."
      />
    ),
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },

  // HTML FUNDAMENTALS (chapter 2.x)
  // Container leaves in curriculum-chapter order.
  {
    slug: "restaurant-menu",
    container: "html-fundamentals",
    repo: "moefingers/html-1-restaurant-menu-activity",
    title: "Restaurant Menu",
    description: "Multi-page restaurant website (chapter 2.3.2).",
    year: "Oct 2023",
    category: "exercises",
    techOriginal: ["HTML", "CSS"],
    original: (
      <OriginalFrame src="/originals/html-fundamentals/restaurant-menu/index.html" />
    ),
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  {
    slug: "bird-songs",
    container: "html-fundamentals",
    repo: "moefingers/HTML-Bird-Songs",
    title: "Bird Songs",
    description: "Five-page bird gallery (chapter 2.4.1).",
    year: "Oct 2023",
    category: "exercises",
    techOriginal: ["HTML"],
    original: (
      <OriginalFrame src="/originals/html-fundamentals/bird-songs/index.html" />
    ),
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  {
    slug: "improved-form",
    container: "html-fundamentals",
    repo: "moefingers/HTML-Improved-Form",
    title: "Improved Sign-up Form",
    description: "Form with validation + results page (chapter 2.5.2).",
    year: "Oct 2023",
    category: "exercises",
    techOriginal: ["HTML"],
    original: (
      <OriginalFrame src="/originals/html-fundamentals/improved-form/index.html" />
    ),
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  {
    slug: "layouts",
    container: "html-fundamentals",
    repo: "moefingers/UNLV-html-layouts-activity",
    title: "HTML Layouts",
    description: "Layouts activity (chapter 2.x).",
    year: "Oct 2023",
    category: "exercises",
    techOriginal: ["HTML", "CSS"],
    original: (
      <OriginalFrame src="/originals/html-fundamentals/layouts/index.html" />
    ),
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },

  // CSS FUNDAMENTALS (chapter 3.x)
  // Container leaves in curriculum-chapter order. css-demo (own, no specific
  // chapter) leads as the introductory sketch; the rest are graded labs.
  {
    slug: "css-demo",
    container: "css-fundamentals",
    repo: "moefingers/css-demo",
    title: "CSS Demo",
    description: "Early CSS sketch (own, pre-chapter-3 labs).",
    year: "Nov 2023",
    category: "exercises",
    techOriginal: ["HTML", "CSS"],
    original: (
      <OriginalFrame src="/originals/css-fundamentals/css-demo/index.html" />
    ),
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  {
    slug: "hacker-times",
    container: "css-fundamentals",
    repo: "moefingers/CSS-The-Hacker-Times-Part-1",
    title: "Hacker Times",
    description: "Newspaper-styled CSS practice (chapter 3.2.4).",
    year: "Nov 2023",
    category: "exercises",
    techOriginal: ["HTML", "CSS"],
    original: (
      <OriginalFrame src="/originals/css-fundamentals/hacker-times/index.html" />
    ),
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  {
    slug: "animations",
    container: "css-fundamentals",
    repo: "moefingers/CSS-Transform-Transition-and-Animations-Oh-My",
    title: "CSS Transforms, Transitions & Animations",
    description: "Three-activity sampler (chapter 3.3.2).",
    year: "Nov 2023",
    category: "exercises",
    techOriginal: ["HTML", "CSS"],
    // Three sub-activities live in the artifact tree (animation/transform/
    // transition); default iframe is the first. A `pages` rail with all
    // three is a candidate for the next audit pass.
    original: (
      <OriginalFrame src="/originals/css-fundamentals/animations/animation-activity/index.html" />
    ),
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  {
    slug: "responsive-boxes",
    container: "css-fundamentals",
    repo: "moefingers/CSS-Responsive-Boxes",
    title: "Responsive Boxes",
    description: "Media queries + flexbox (chapter 3.4.3).",
    year: "Nov 2023",
    category: "exercises",
    techOriginal: ["HTML", "CSS", "Media Queries"],
    // Three media-query sub-exercises live in the artifact tree
    // (medial-queries1/2/3); default iframe is the first. Pages-rail
    // candidate for the next audit pass.
    original: (
      <OriginalFrame src="/originals/css-fundamentals/responsive-boxes/medial-queries1/index.html" />
    ),
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },

  // JS EXERCISES (chapter 5.x)
  // Container leaves are array-ordered by curriculum chapter so the future
  // Globe graph layout (curriculum-curve on sphere surface) can read leaf
  // positions directly from this order. See CONTAINERS["js-exercises"]
  // for the architectural note.
  {
    slug: "web-game",
    container: "js-exercises",
    title: "Web Game Series",
    description: "Progressive game built across multiple assignments.",
    year: "Dec 2023 – Jan 2024",
    category: "games",
    techOriginal: ["JavaScript", "HTML", "live-server"],
    original: (
      <OriginalFrame src="/originals/js-exercises/web-game/part-7/index.html" />
    ),
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
    notes: {
      original:
        "The original project only demanded movement via arrow keys and inventory pickup via clicking. NPCs, win conditions, and HP were not part of the original scope.",
    },
  },
  {
    slug: "jacks-paint",
    container: "js-exercises",
    title: "Jack's Paint",
    description: "Browser-based paint application.",
    year: "Dec 2023",
    category: "frontend",
    techOriginal: ["JavaScript", "jQuery", "Canvas"],
    original: (
      <OriginalFrame src="/originals/js-exercises/jacks-paint/index.html" />
    ),
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  {
    slug: "js-dom-events",
    container: "js-exercises",
    repo: "moefingers/JS-Events-Demonstration",
    title: "JavaScript & DOM",
    description: "Event handling, DOM manipulation, OOP.",
    synopsis:
      "This project demonstrates JavaScript event handling, DOM manipulation, and OOP fundamentals through interactive web page demos.",
    year: "Dec 2023 – Feb 2024",
    category: "exercises",
    plannedTiers: ["original", "enhanced"],
    techOriginal: ["JavaScript", "DOM API", "Fetch"],
    // `pages` is the single source of truth; the route auto-wraps it
    // with <MultiPageOriginal> when `original` is unset, so the entry
    // doesn't need to duplicate the list in JSX. See [...path]/page.tsx.
    pages: [
      {
        label: "The Target Element",
        src: "/originals/js-exercises/js-dom-events/events-demo/1. The Target Element.html",
      },
      {
        label: "Event Bubbling",
        src: "/originals/js-exercises/js-dom-events/events-demo/2. Event Bubbling.html",
      },
      {
        label: "Event Capturing",
        src: "/originals/js-exercises/js-dom-events/events-demo/3. Event Capturing.html",
      },
      {
        label: "Prevent Default",
        src: "/originals/js-exercises/js-dom-events/events-demo/4. Prevent Default.html",
      },
      {
        label: "Stop Propagation",
        src: "/originals/js-exercises/js-dom-events/events-demo/5. Stop Propagation.html",
      },
    ],
    techEnhanced: ["React 19", "Native DOM events", "Radial gradients", "CSS"],
    enhanced: <JsDomEventsEnhanced />,
    notes: {
      original:
        "The original is a five-page walkthrough of DOM event mechanics — target resolution, bubbling, capturing, preventDefault, and stopPropagation. Each concept lives on its own HTML file; use the page rail to step through. Behavior is preserved byte-for-byte from the museum-ready branch; only hosting-compatibility fixes were applied.",
      enhanced:
        "The five concepts collapse into one interactive playground. Three nested rings stand in for a DOM ancestor chain; native addEventListener handlers (with capture + bubble pairs on each ring) report each phase to a live event log. Radial-gradient pulses animate as the wavefront passes through each ring on capture and again on bubble. Toggles for stopPropagation and preventDefault demonstrate the modifiers without context-switching to a separate page.",
    },
  },
  {
    slug: "shared-counter",
    container: "js-exercises",
    repo: "moefingers/JS-Building-a-Shared-Counter-Part-1",
    title: "Shared Counter — Part 1",
    description: "Counter buttons with local state, Bootstrap-styled.",
    synopsis:
      "Click-to-increment counter built in vanilla JS with Bootstrap. Part 1 of a planned three-part series — local state only, no shared backend yet; later parts wire up json-server and finally a real persisted store.",
    year: "Dec 2023",
    category: "exercises",
    plannedTiers: ["original", "enhanced"],
    techOriginal: ["JavaScript", "Bootstrap"],
    original: (
      <OriginalFrame src="/originals/js-exercises/shared-counter/index.html" />
    ),
    enhanced: COMING_SOON,
  },
  {
    slug: "admin-portal",
    container: "js-exercises",
    repo: "moefingers/JS-Building-an-Admin-Portal",
    title: "Admin Portal",
    description: "Admin interface with dynamic form fields.",
    synopsis:
      "Book inventory admin — JavaScript frontend with Bootstrap, Express + JSON-file backend, Fetch-driven CRUD against a starter API.",
    year: "Dec 2023",
    category: "frontend",
    techOriginal: ["JavaScript", "Express", "Fetch API"],
    // Three-page original: the Admin CRUD UI was the entry point, the
    // Books list was the customer-facing view, and the API Docs page
    // documented the underlying Express endpoints. Rail order puts the
    // admin UI first since that's the project's headline feature.
    pages: [
      {
        label: "Admin",
        src: "/originals/js-exercises/admin-portal/admin.html",
      },
      {
        label: "Books",
        src: "/originals/js-exercises/admin-portal/index.html",
      },
      {
        label: "API Docs (blank)",
        src: "/originals/js-exercises/admin-portal/api-docs.html",
      },
    ],
    enhanced: <AdminPortalEnhanced />,
    techEnhanced: ["React", "Next.js", "Drizzle", "@vercel/firewall"],
    reimagined: COMING_SOON,
    siblingApiClient: "admin-portal",
    notes: {
      original:
        "Frontend preserved as-is; Express backend reimplemented as /api/admin-portal/* — see the Admin Portal card in /api-client to poke at the JSON endpoints. URLs in admin.js/index.js were rewritten from localhost:3001 to /api/admin-portal.",
      enhanced:
        "Freshly-written React admin UI that talks to /api/v2/admin-portal/* — inline search, low-stock badges, modal forms with live cover preview, audit-row toast after every successful write. Sign-in required for mutations (helpful 401 with worked example if you try unauth). The /api/v2/admin-portal/cover/<id> endpoint synthesizes a deterministic SVG cover for any book without an imageURL, keyed by id+title+year.",
    },
  },
  {
    slug: "interactive-map",
    container: "js-exercises",
    repo: "moefingers/JS-Making-an-Interactive-Map",
    title: "Interactive Map",
    description: "Geolocation mapping with Leaflet.",
    synopsis:
      "Geolocation mapping in vanilla JS — the browser's GPS pin is plotted on a Leaflet + OpenStreetMap tile map, and a select-then-submit form queries the Foursquare Places API to drop nearby business markers around the user's location.",
    year: "Jan 2024",
    category: "frontend",
    techOriginal: ["JavaScript", "Leaflet", "Foursquare API"],
    original: (
      <OriginalFrame src="/originals/js-exercises/interactive-map/index.html" />
    ),
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
    notes: {
      original:
        "The original committed the Foursquare API key to client JS, the way the assignment was taught. For the museum-ready branch, the key was redacted and getFoursquare() early-returns an empty list so the business-search button no-ops gracefully; the geolocation pin and tile layer still work. The original branch retains the historical commit. A 3s geolocation timeout falls back to Las Vegas coordinates when the sandboxed iframe blocks the browser prompt.",
    },
  },

  // FRONTEND & UI
  {
    slug: "art-gallery",
    title: "React Art Gallery",
    description: "React-based art gallery.",
    year: "Mar 2024",
    category: "frontend",
    techOriginal: ["React", "Babel", "CSS"],
    original: <OriginalFrame src="/originals/art-gallery/index.html" />,
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  {
    slug: "quirk-truck",
    repo: "moefingers/quirkTruck",
    title: "Quirk Truck",
    description: "Dynamic truck catalog. Precursor to EnterPrize.",
    synopsis:
      "Dynamic truck catalog built in React on Create React App — the precursor to the EnterPrize enterprise rewrite.",
    year: "Feb 2024",
    category: "frontend",
    techOriginal: ["React", "Create React App", "CSS"],
    original: <OriginalFrame src="/originals/quirk-truck/index.html" />,
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  {
    slug: "timer-stopwatch",
    title: "Timer & Stopwatch",
    description: "Feature-packed timer/stopwatch combo.",
    year: "Apr – May 2024",
    category: "frontend",
    techOriginal: ["React", "Vite", "Ant Design"],
    original: <OriginalFrame src="/originals/timer-stopwatch/index.html" />,
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  {
    slug: "food-truck",
    title: "Food Truck",
    description: "Food truck website with menu and jQuery animations.",
    year: "Oct 2023",
    category: "frontend",
    techOriginal: ["HTML", "CSS", "jQuery"],
    original: <OriginalFrame src="/originals/food-truck/index.html" />,
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  {
    slug: "stock-charts",
    title: "Stock Charts",
    description: "Financial data visualization.",
    year: "Jan 2024",
    category: "frontend",
    techOriginal: ["JavaScript", "Chart.js", "Express"],
    original: <OriginalFrame src="/originals/stock-charts/index.html" />,
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  {
    slug: "copycat",
    title: "Copycat Activity",
    description: "HTML/CSS recreation from a design mockup.",
    year: "Nov 2023",
    category: "frontend",
    techOriginal: ["HTML", "CSS"],
    original: <OriginalFrame src="/originals/copycat/index.html" />,
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  {
    slug: "my-values",
    title: "My Values",
    description: "Personal values visualization.",
    year: "Dec 2023",
    category: "frontend",
    techOriginal: ["HTML", "CSS", "JavaScript"],
    original: <OriginalFrame src="/originals/my-values/index.html" />,
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },

  // APIs & BACKEND
  {
    slug: "music-tour-api",
    repo: "moefingers/SQL-Music-Tour-API",
    // Backend-only API project — its museum surface IS the /api-client
    // viewer. project-route.tsx redirects rail clicks from any tier to
    // the right path-segment leaf (/api-client for original,
    // /api-client/v2 for enhanced), so this project's tier-body fields
    // are intentionally unset — they'd never render.
    href: "/api-client?api=music-tour",
    title: "Music Tour API",
    description: "REST API for music tour management.",
    synopsis:
      "REST API for managing bands and their tour events — the original UNLV exercise used Express + Sequelize against Postgres; the museum reimplements the same routes in Next.js + Drizzle and surfaces them via /api-client.",
    year: "Apr 2024",
    category: "api",
    techOriginal: ["Express", "PostgreSQL", "Sequelize"],
    plannedTiers: ["original", "enhanced"],
  },
  {
    slug: "sql-injection-demo",
    repo: "moefingers/iam-2-sql-injection-demo",
    title: "SQL Injection Demo",
    description: "Login form with vulnerable + safe SQL — see injection live.",
    synopsis:
      "Educational demo from UNLV's Information Assurance coursework — a login form runs both a vulnerable (string-interpolated) and a safe (parameterized) query against an in-memory SQLite user table, so students see firsthand that `' OR '1'='1' --` bypasses one and is neutralized by the other.",
    year: "May 2024",
    category: "api",
    techOriginal: ["Express", "SQLite", "HTML"],
    // Forward pointer to the api-client lab surface. Value is the
    // api-data.ts `id` (`?api=sql-demo`), not the partner project's
    // slug — see resolveSiblingLink's docstring for the asymmetry.
    siblingApiClient: "sql-demo",
    // SPA-style card: the visitor-facing form is iframed at /api/sql-demo/
    // (the route handler serves index.html with a <base> injection so the
    // form-submit posts to /api/sql-demo/login-html). The api-client lab
    // surface lives at the sibling `sql-injection-demo-api` entry below.
    original: <OriginalFrame src="/api/sql-demo/" />,
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
    notes: {
      original:
        "Frontend preserved as-is. The form action was rewritten from `/login` to `/api/sql-demo/login-html` on museum-ready/original so the form-submit flow reaches the museum's route handler instead of the dead `/login` of the original Express server. Vulnerability surface is unchanged: try `' OR '1'='1' --` in the username field.",
    },
  },
  {
    slug: "sql-injection-demo-api",
    // Backend-only — `href` drives the rail click to /api-client; the
    // tier-body fields are intentionally unset because project-route
    // redirects before any of them would render.
    href: "/api-client?api=sql-demo",
    title: "SQL Injection Demo API",
    description:
      "Same vulnerability surface, JSON-shaped for structured inspection in /api-client.",
    year: "May 2024",
    category: "api",
    techOriginal: ["Express", "SQLite"],
    plannedTiers: ["original", "enhanced"],
    // Reverse pointer for the api+client pair. The frontend half
    // (`sql-injection-demo`) carries `siblingApiClient: "sql-demo"`
    // (the api-client `?api=` value); this back-pointer is a slug,
    // resolved through resolveSiblingLink → PROJECTS.find. The api-
    // client UI doesn't surface the reverse hop today, but the field
    // is set so the pairing is schema-honest and any future linter
    // catches it.
    siblingFrontend: "sql-injection-demo",
    notes: {
      original:
        "Backend half of the SQL Demo pair — the original Express server returned an HTML success page or a hash-redirect; this card exposes the same vulnerable + safe queries with structured JSON responses (parsed rows, the raw SQL string, an `injected` flag) so visitors can dissect what the queries actually do. The visitor-facing form lives at /sql-injection-demo.",
    },
  },
  {
    slug: "admin-portal-api",
    // Backend-only — `href` drives the rail click to /api-client; the
    // tier-body fields are intentionally unset because project-route
    // redirects before any of them would render.
    href: "/api-client?api=admin-portal",
    title: "Admin Portal API",
    description:
      "Book inventory REST API. JSON CRUD + HTML routes for admin and customer UIs.",
    year: "Dec 2023",
    category: "api",
    techOriginal: ["Express", "JSON file store"],
    plannedTiers: ["original", "enhanced"],
    // Reverse pointer for the api+client pair. Frontend half
    // (`admin-portal`) carries `siblingApiClient: "admin-portal"`
    // (the api-client `?api=` value); this back-pointer is a slug,
    // resolved through resolveSiblingLink → PROJECTS.find. The api-
    // client UI doesn't render the reverse hop today, but populating
    // the field keeps the schema honest.
    siblingFrontend: "admin-portal",
    notes: {
      original:
        "Backend half of the Admin Portal pair — the original Express server served both JSON endpoints (listBooks/addBook/updateBook/removeBook) and HTML at /  and /index.html. The frontend lives at /admin-portal as a separate entry; this one is the API itself, browsable via the api-client.",
    },
  },
  {
    slug: "jaskis",
    repo: "moefingers/API-JASKIS",
    href: "/mongo-client?project=jaskis",
    title: "JASKIS",
    description: "Animal-bounties registry — MongoDB shell tutorial.",
    synopsis:
      "Animal-bounties registry from the UNLV MongoDB shell tutorial — the museum runs real Mongo shell syntax (find, insertOne, updateMany, $set, $gte, $and) against a Postgres-backed translator so visitors can type the same commands the original exercise used.",
    year: "Feb 2024",
    category: "api",
    techOriginal: ["MongoDB shell"],
    techEnhanced: ["Postgres", "Drizzle", "Audit log"],
    original: <OriginalFrame src="/mongo-client?project=jaskis" />,
    enhanced: <OriginalFrame src="/mongo-client/enhanced?project=jaskis" />,
    reimagined: COMING_SOON,
    notes: {
      original:
        "JASKIS was never an HTTP API — it was a MongoDB shell exercise from FSWD Lesson 6.7.3. The museum exposes it via /mongo-client, where visitors type real Mongo shell commands and a hand-written parser (no eval) translates them to Drizzle queries against the same data shape the original tutorial used.",
      enhanced:
        "Adds an auditLog collection that records every mutation across both Original and Enhanced tiers — author (GitHub login), operation, before/after, timestamp. Sign-in required for writes on both tiers; the audit log makes mutations publicly attributable.",
    },
  },

  // PYTHON
  {
    slug: "petfax",
    title: "PetFax",
    description: "Pet information catalog.",
    year: "May 2024",
    category: "python",
    techOriginal: ["Python", "Flask"],
    original: <OriginalFrame src="/originals/petfax/index.html" />,
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  {
    slug: "python-fundamentals",
    title: "Python Fundamentals",
    description: "OOP, functional programming, error handling.",
    year: "May 2024",
    category: "python",
    techOriginal: ["Python"],
    original: <PythonFundamentalsOriginal />,
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },

  // EXERCISES
  {
    slug: "music-search",
    container: "react-exercises",
    repo: "moefingers/RR-Music-Search",
    title: "Music Search",
    description: "iTunes search SPA — query, results grid, album detail.",
    year: "Mar 2024",
    category: "exercises",
    techOriginal: ["React", "React Router", "iTunes API", "CRA"],
    original: (
      <OriginalFrame src="/originals/react-exercises/music-search/index.html" />
    ),
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  {
    slug: "montys-mineral-spa",
    container: "react-exercises",
    repo: "moefingers/RR-React-Router-Montys-Mineral-Spa",
    title: "Monty's Mineral Spa",
    description: "Multi-page React Router exercise.",
    year: "Mar 2024",
    category: "exercises",
    techOriginal: ["React", "React Router", "CRA"],
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  {
    slug: "bootstrap",
    container: "react-exercises",
    repo: "moefingers/RR-Getting-Started-With-Bootstrap",
    title: "React + Bootstrap",
    description: "Bootstrap components composed into a React app.",
    year: "Mar 2024",
    category: "exercises",
    techOriginal: ["React", "Bootstrap", "CRA"],
    original: (
      <OriginalFrame src="/originals/react-exercises/bootstrap/index.html" />
    ),
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  {
    slug: "stylesheets",
    container: "react-exercises",
    repo: "moefingers/RR-Stylesheets-React",
    title: "Stylesheets in React",
    description: "CSS modules vs global stylesheets vs inline styles.",
    year: "Mar 2024",
    category: "exercises",
    techOriginal: ["React", "CSS Modules", "CRA"],
    original: (
      <OriginalFrame src="/originals/react-exercises/stylesheets/index.html" />
    ),
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  {
    slug: "rainbow",
    container: "react-exercises",
    repo: "moefingers/rr-react-rainbow",
    title: "React Rainbow",
    description: "Color components and prop-driven rendering.",
    year: "Mar 2024",
    category: "exercises",
    techOriginal: ["React", "CRA"],
    original: (
      <OriginalFrame src="/originals/react-exercises/rainbow/index.html" />
    ),
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  {
    slug: "css-responsive-nav",
    title: "Responsive Navigation",
    description: "Pure CSS responsive navigation.",
    year: "Jun 2024",
    category: "exercises",
    techOriginal: ["HTML", "CSS", "JavaScript"],
    original: <OriginalFrame src="/originals/css-responsive-nav/index.html" />,
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
];
