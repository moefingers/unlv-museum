import { type ReactNode } from "react";
import { OriginalFrame } from "@/components/ui/OriginalFrame";
import { PythonFundamentalsOriginal } from "@/components/originals/PythonFundamentalsOriginal";
import { ServerAppOriginal } from "@/components/originals/ServerAppOriginal";
import { ApiOriginal } from "@/components/originals/ApiOriginal";
import sourcesGenerated from "./sources.generated.json";

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

export interface Project {
  slug: string;
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
   * GitHub "owner/repo" slug for the project's source repository, when
   * one exists. Used by the /github-banners endpoint to fetch live repo
   * facts (fork status, languages, commits) even before sync:source has
   * populated sources.generated.json.
   */
  repo?: string;
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
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="text-zinc-400 dark:text-zinc-600">{label}</p>
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
  {
    slug: "web-game",
    title: "Web Game Series",
    description: "Progressive game built across multiple assignments.",
    year: "Dec 2023 – Jan 2024",
    category: "games",
    techOriginal: ["JavaScript", "HTML", "live-server"],
    original: <OriginalFrame src="/originals/web-game/part-7/index.html" />,
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
    notes: {
      original:
        "The original project only demanded movement via arrow keys and inventory pickup via clicking. NPCs, win conditions, and HP were not part of the original scope.",
    },
  },

  // FULL-STACK
  {
    slug: "rest-rant",
    title: "Rest-Rant (SPA)",
    description:
      "Restaurant rating and review SPA. May 2024 — CRA frontend + separate Express/Postgres backend.",
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
    title: "Rest-Rant (SSR)",
    description:
      "Restaurant rating SSR app. Feb 2024 — JSX views, form-driven mutations.",
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
    slug: "admin-portal",
    repo: "moefingers/JS-Building-an-Admin-Portal",
    title: "Admin Portal",
    description: "Admin interface with dynamic form fields.",
    synopsis:
      "Book inventory admin — JavaScript frontend with Bootstrap, Express + JSON-file backend, Fetch-driven CRUD against a starter API.",
    year: "Dec 2023",
    category: "frontend",
    techOriginal: ["JavaScript", "Express", "Fetch API"],
    original: <OriginalFrame src="/originals/admin-portal/admin.html" />,
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
    notes: {
      original:
        "Frontend preserved as-is; Express backend reimplemented as /api/admin-portal/* — see the Admin Portal card in /api-client to poke at the JSON endpoints. URLs in admin.js/index.js were rewritten from localhost:3001 to /api/admin-portal.",
    },
  },
  {
    slug: "interactive-map",
    title: "Interactive Map",
    description: "Geolocation mapping with Leaflet.",
    year: "Jan 2024",
    category: "frontend",
    techOriginal: ["JavaScript", "Leaflet", "Foursquare API"],
    original: <OriginalFrame src="/originals/interactive-map/index.html" />,
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
    slug: "jacks-paint",
    title: "Jack's Paint",
    description: "Browser-based paint application.",
    year: "Dec 2023",
    category: "frontend",
    techOriginal: ["JavaScript", "jQuery", "Canvas"],
    original: <OriginalFrame src="/originals/jacks-paint/index.html" />,
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
    href: "/api-client?api=music-tour",
    title: "Music Tour API",
    description: "REST API for music tour management.",
    year: "Apr 2024",
    category: "api",
    techOriginal: ["Express", "PostgreSQL", "Sequelize"],
    original: <ApiOriginal startWith="Music Tour API" />,
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  {
    slug: "sql-injection-demo",
    href: "/api-client?api=sql-demo",
    title: "SQL Injection Demo",
    description: "Educational SQL injection demonstration.",
    year: "May 2024",
    category: "api",
    techOriginal: ["Express", "SQLite", "HTML"],
    original: <ApiOriginal startWith="SQL Injection Demo" />,
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  {
    slug: "jaskis",
    href: "/api-client?api=jaskis",
    title: "JASKIS",
    description: "Snack spot discovery and CRUD.",
    year: "Feb 2024",
    category: "api",
    techOriginal: ["MongoDB", "Express"],
    original: <ApiOriginal startWith="JASKIS API" />,
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
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
    slug: "html-css-fundamentals",
    title: "HTML & CSS Fundamentals",
    description: "Layouts, forms, responsive design, animations.",
    year: "Oct – Dec 2023",
    category: "exercises",
    techOriginal: ["HTML", "CSS", "Media Queries"],
    original: (
      <OriginalFrame src="/originals/html-css-fundamentals/hacker-times/index.html" />
    ),
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  {
    slug: "shared-counter",
    repo: "moefingers/JS-Building-a-Shared-Counter-Part-1",
    title: "Shared Counter — Part 1",
    description: "Counter buttons with local state, Bootstrap-styled.",
    synopsis:
      "Click-to-increment counter built in vanilla JS with Bootstrap. Part 1 of a planned three-part series — local state only, no shared backend yet; later parts wire up json-server and finally a real persisted store.",
    year: "Dec 2023",
    category: "exercises",
    plannedTiers: ["original", "enhanced"],
    techOriginal: ["JavaScript", "Bootstrap"],
    original: <OriginalFrame src="/originals/shared-counter/index.html" />,
    enhanced: COMING_SOON,
  },
  {
    slug: "js-dom-events",
    repo: "moefingers/JS-Events-Demonstration",
    title: "JavaScript & DOM",
    description: "Event handling, DOM manipulation, OOP.",
    synopsis:
      "This project demonstrates JavaScript event handling, DOM manipulation, and OOP fundamentals through interactive web page demos.",
    year: "Dec 2023 – Feb 2024",
    category: "exercises",
    plannedTiers: ["original", "enhanced"],
    techOriginal: ["JavaScript", "DOM API", "Fetch"],
    original: (
      <OriginalFrame src="/originals/js-dom-events/events-demo/1. The Target Element.html" />
    ),
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
  {
    slug: "react-exercises",
    title: "React Learning Path",
    description: "Bootstrap, routing, music search, stylesheets.",
    year: "Mar – Apr 2024",
    category: "exercises",
    techOriginal: ["React", "React Router", "Bootstrap", "CRA"],
    original: (
      <OriginalFrame src="/originals/react-exercises/music-search/index.html" />
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
  {
    slug: "restaurant-menu",
    title: "Restaurant Menu",
    description: "Multi-page restaurant website.",
    year: "Oct 2023",
    category: "exercises",
    techOriginal: ["HTML", "CSS"],
    original: <OriginalFrame src="/originals/restaurant-menu/index.html" />,
    enhanced: COMING_SOON,
    reimagined: COMING_SOON,
  },
];
