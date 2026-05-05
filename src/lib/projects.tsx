import { type ReactNode } from "react";
import { OriginalFrame, ExternalFrame } from "@/components/ui/OriginalFrame";

export type ViewMode = "original" | "remastered" | "reimagined";

export interface Project {
  slug: string;
  title: string;
  description: string;
  year: string;
  category: Category;
  techOriginal: string[];
  techRemastered: string[];
  techReimagined: string[];
  original: ReactNode;
  remastered: ReactNode;
  reimagined: ReactNode;
  progression?: boolean;
  externalLink?: string;
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

export const PROJECTS: Project[] = [
  // ═══════════════════════════════════════════
  // GAMES
  // ═══════════════════════════════════════════
  {
    slug: "milestown",
    title: "MilestO-W-N",
    description:
      "1-4 player territory game. Dynamic map rendering from matrices. Three generations.",
    year: "Jan 2024",
    category: "games",
    techOriginal: ["JavaScript", "HTML", "CSS"],
    techRemastered: ["JavaScript", "WebSocket", "P2P Mesh"],
    techReimagined: ["React", "Canvas", "WebRTC", "Server Actions"],
    original: <OriginalFrame src="/originals/milestown/index.html" />,
    remastered: <Placeholder label="Remastered — milestown2 (May 2024)" />,
    reimagined: <Placeholder label="Reimagined — OWN3" />,
    progression: true,
    externalLink: "https://own3.vercel.app",
  },
  {
    slug: "gwhac-a-mole",
    title: "Gwhac-A-Mole",
    description: "Guacamole-themed whack-a-mole React game.",
    year: "Mar 2024",
    category: "games",
    techOriginal: ["React", "Create React App", "CSS"],
    techRemastered: ["TypeScript", "React", "Canvas", "Tailwind"],
    techReimagined: ["React", "Canvas", "Leaderboard", "Sound", "Levels"],
    original: <OriginalFrame src="/originals/gwhac-a-mole/index.html" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "web-game",
    title: "Web Game Series",
    description:
      "Progressive game built across multiple assignments. Parts 1-7.",
    year: "Dec 2023 – Jan 2024",
    category: "games",
    techOriginal: ["JavaScript", "HTML", "live-server"],
    techRemastered: ["TypeScript", "Canvas", "ES Modules"],
    techReimagined: ["React", "Canvas", "State Machine", "Animations"],
    original: <OriginalFrame src="/originals/web-game/part-7/index.html" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },

  // ═══════════════════════════════════════════
  // FULL-STACK APPLICATIONS
  // ═══════════════════════════════════════════
  {
    slug: "rest-rant",
    title: "Rest-Rant",
    description: "Restaurant rating and review application.",
    year: "Feb – May 2024",
    category: "full-stack",
    techOriginal: ["Express", "React", "MongoDB"],
    techRemastered: ["TypeScript", "Server Components", "Tailwind"],
    techReimagined: ["React", "Server Actions", "Maps", "Auth", "Drizzle"],
    original: <OriginalFrame src="/originals/rest-rant/index.html" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
    progression: true,
  },
  {
    slug: "commerce-array",
    title: "Commerce Array",
    description: "Full-stack e-commerce platform with product management.",
    year: "Apr 2024",
    category: "full-stack",
    techOriginal: ["Express", "PostgreSQL", "Sequelize", "React"],
    techRemastered: ["TypeScript", "Server Components", "Tailwind"],
    techReimagined: ["React", "Server Actions", "Stripe", "Drizzle"],
    original: <OriginalFrame src="/originals/commerce-array/index.html" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "enterprize",
    title: "EnterPrize",
    description: "Enterprise asset management system.",
    year: "Jun 2024",
    category: "full-stack",
    techOriginal: ["Next.js 15", "Prisma", "NeonDB", "NextAuth v5"],
    techRemastered: ["TypeScript", "Server Components", "Drizzle"],
    techReimagined: ["React", "Charts", "RBAC", "Real-time", "Audit Log"],
    original: <ExternalFrame src="https://enterprize-pi.vercel.app" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "divvy",
    title: "Divvy",
    description: "Receipt splitter for groups. Assign items to people.",
    year: "May 2024",
    category: "full-stack",
    techOriginal: ["React", "React Query", "Express", "Decimal.js"],
    techRemastered: ["TypeScript", "Server Components", "Tailwind"],
    techReimagined: ["React", "Server Actions", "Real-time", "Auth"],
    original: <OriginalFrame src="/originals/divvy/index.html" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "nextjs-dashboard",
    title: "Next.js Dashboard",
    description: "Next.js app with authentication and Vercel Postgres.",
    year: "Jun 2024",
    category: "full-stack",
    techOriginal: ["Next.js 16", "NextAuth v5", "Vercel Postgres"],
    techRemastered: ["TypeScript", "Better Auth", "Drizzle", "Neon"],
    techReimagined: ["React", "Charts", "RBAC", "Real-time"],
    original: <Placeholder label="Original — server-side app (source view)" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },

  // ═══════════════════════════════════════════
  // FRONTEND & UI
  // ═══════════════════════════════════════════
  {
    slug: "art-gallery",
    title: "React Art Gallery",
    description: "React-based art gallery with image display.",
    year: "Mar 2024",
    category: "frontend",
    techOriginal: ["React", "Babel", "CSS"],
    techRemastered: ["TypeScript", "React", "CSS Grid", "View Transitions"],
    techReimagined: ["React", "Masonry", "Lightbox", "API Integration"],
    original: <OriginalFrame src="/originals/art-gallery/index.html" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "quirk-truck",
    title: "Quirk Truck",
    description: "Dynamic truck catalog with idiosyncrasies.",
    year: "Feb 2024",
    category: "frontend",
    techOriginal: ["React", "Create React App", "CSS"],
    techRemastered: ["TypeScript", "React", "Tailwind", "Search"],
    techReimagined: ["React", "Server Components", "Image Optimization"],
    original: <OriginalFrame src="/originals/quirk-truck/index.html" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "timer-stopwatch",
    title: "Timer & Stopwatch",
    description: "Feature-packed timer/stopwatch combo.",
    year: "Apr – May 2024",
    category: "frontend",
    techOriginal: ["React", "Vite", "Ant Design"],
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["React", "Web Workers", "Notifications", "PWA"],
    original: <OriginalFrame src="/originals/timer-stopwatch/index.html" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "hxh-logo",
    title: "Hunter x Hunter Animated Logo",
    description: "Animated anime-inspired logo recreation.",
    year: "May 2024",
    category: "frontend",
    techOriginal: ["React", "Vite", "CSS Animations"],
    techRemastered: ["TypeScript", "React", "CSS Animations"],
    techReimagined: ["React", "SVG", "GSAP", "Interactive"],
    original: <OriginalFrame src="/originals/hxh-logo/index.html" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "food-truck",
    title: "Food Truck",
    description: "Food truck business website with menu and jQuery animations.",
    year: "Oct 2023",
    category: "frontend",
    techOriginal: ["HTML", "CSS", "jQuery"],
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["React", "Server Components", "CMS", "Ordering"],
    original: <OriginalFrame src="/originals/food-truck/index.html" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "admin-portal",
    title: "Admin Portal",
    description: "Admin interface with dynamic form fields and API.",
    year: "Dec 2023",
    category: "frontend",
    techOriginal: ["JavaScript", "Express", "Fetch API"],
    techRemastered: ["TypeScript", "React", "Server Actions"],
    techReimagined: ["React", "CRUD", "Validation", "Toast Notifications"],
    original: <OriginalFrame src="/originals/admin-portal/index.html" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "interactive-map",
    title: "Interactive Map",
    description: "Geolocation mapping with Leaflet and Foursquare API.",
    year: "Jan 2024",
    category: "frontend",
    techOriginal: ["JavaScript", "Leaflet", "Foursquare API"],
    techRemastered: ["TypeScript", "React", "Mapbox GL"],
    techReimagined: ["React", "Mapbox", "Search", "Directions", "POI"],
    original: <OriginalFrame src="/originals/interactive-map/index.html" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "stock-charts",
    title: "Stock Charts",
    description: "Financial data visualization with Chart.js.",
    year: "Jan 2024",
    category: "frontend",
    techOriginal: ["JavaScript", "Chart.js", "Express"],
    techRemastered: ["TypeScript", "React", "Recharts"],
    techReimagined: ["React", "Real-time Data", "WebSocket", "Candlestick"],
    original: <OriginalFrame src="/originals/stock-charts/index.html" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "jacks-paint",
    title: "Jack's Paint",
    description: "Browser-based paint application with mouse drawing.",
    year: "Dec 2023",
    category: "frontend",
    techOriginal: ["JavaScript", "jQuery", "Canvas"],
    techRemastered: ["TypeScript", "Canvas API", "Tailwind"],
    techReimagined: ["React", "Canvas", "Layers", "Tools", "Export"],
    original: <OriginalFrame src="/originals/jacks-paint/index.html" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "copycat",
    title: "Copycat Activity",
    description: "HTML/CSS recreation exercise from a design mockup.",
    year: "Nov 2023",
    category: "frontend",
    techOriginal: ["HTML", "CSS"],
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["React", "Responsive", "Animations", "Dark Mode"],
    original: <OriginalFrame src="/originals/copycat/index.html" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "my-values",
    title: "My Values",
    description: "Personal values visualization page.",
    year: "Dec 2023",
    category: "frontend",
    techOriginal: ["HTML", "CSS", "JavaScript"],
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["React", "Animations", "Interactive", "Shareable"],
    original: <OriginalFrame src="/originals/my-values/index.html" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },

  // ═══════════════════════════════════════════
  // APIs & BACKEND
  // ═══════════════════════════════════════════
  {
    slug: "music-tour-api",
    title: "Music Tour API",
    description: "REST API for music tour management with PostgreSQL.",
    year: "Apr 2024",
    category: "api",
    techOriginal: ["Express", "PostgreSQL", "Sequelize"],
    techRemastered: ["TypeScript", "Hono", "Drizzle", "Neon"],
    techReimagined: ["Next.js API Routes", "Drizzle", "OpenAPI", "Auth"],
    original: (
      <Placeholder label="Original — Express/Sequelize API (source view)" />
    ),
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "sql-injection-demo",
    title: "SQL Injection Demo",
    description: "Educational demonstration of SQL injection vulnerabilities.",
    year: "May 2024",
    category: "api",
    techOriginal: ["Express", "SQLite", "HTML"],
    techRemastered: ["TypeScript", "Parameterized Queries", "Tailwind"],
    techReimagined: ["React", "Interactive Tutorial", "Safe vs Unsafe"],
    original: <OriginalFrame src="/originals/sql-injection-demo/index.html" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "jaskis",
    title: "JASKIS API",
    description: "MongoDB integration learning exercise.",
    year: "Feb 2024",
    category: "api",
    techOriginal: ["MongoDB", "Express"],
    techRemastered: ["TypeScript", "Drizzle", "Neon"],
    techReimagined: ["Next.js API Routes", "Drizzle", "CRUD UI"],
    original: (
      <Placeholder label="Original — MongoDB/Express API (source view)" />
    ),
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "github-commits",
    title: "How Many Commits",
    description: "GitHub API client that counts your commits.",
    year: "May 2024",
    category: "api",
    techOriginal: ["Express", "GitHub API"],
    techRemastered: ["TypeScript", "Server Components", "Octokit"],
    techReimagined: ["React", "GitHub OAuth", "Charts", "History"],
    original: (
      <Placeholder label="Original — Express/GitHub API (source view)" />
    ),
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },

  // ═══════════════════════════════════════════
  // PYTHON
  // ═══════════════════════════════════════════
  {
    slug: "petfax",
    title: "PetFax",
    description: "Pet information catalog built with Flask.",
    year: "May 2024",
    category: "python",
    techOriginal: ["Python", "Flask"],
    techRemastered: ["Python", "FastAPI", "Pydantic"],
    techReimagined: ["Next.js", "Server Actions", "Image Upload", "Auth"],
    original: <Placeholder label="Original — Flask app (source view)" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "python-fundamentals",
    title: "Python Fundamentals",
    description: "OOP, functional programming, error handling exercises.",
    year: "May 2024",
    category: "python",
    techOriginal: ["Python"],
    techRemastered: ["Python", "Type Hints", "Pytest"],
    techReimagined: ["Next.js", "Interactive REPL", "Code Playground"],
    original: <Placeholder label="Original — Python source (source view)" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },

  // ═══════════════════════════════════════════
  // LEARNING EXERCISES
  // ═══════════════════════════════════════════
  {
    slug: "html-css-fundamentals",
    title: "HTML & CSS Fundamentals",
    description:
      "Layouts, forms, responsive design, animations, and newspaper styling.",
    year: "Oct – Dec 2023",
    category: "exercises",
    techOriginal: ["HTML", "CSS", "Media Queries"],
    techRemastered: ["HTML", "Tailwind", "CSS Grid", "Container Queries"],
    techReimagined: ["React", "Tailwind", "Responsive", "Interactive Demos"],
    original: (
      <OriginalFrame src="/originals/html-css-fundamentals/hacker-times/index.html" />
    ),
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "js-dom-events",
    title: "JavaScript & DOM",
    description: "Event handling, DOM manipulation, fetch API, OOP exercises.",
    year: "Dec 2023 – Feb 2024",
    category: "exercises",
    techOriginal: ["JavaScript", "DOM API", "Fetch"],
    techRemastered: ["TypeScript", "ES Modules", "Modern APIs"],
    techReimagined: ["React", "Interactive Tutorial", "Code Sandbox"],
    original: (
      <OriginalFrame src="/originals/js-dom-events/events-demo/1. The Target Element.html" />
    ),
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "react-exercises",
    title: "React Learning Path",
    description: "Bootstrap, routing, music search, and stylesheets.",
    year: "Mar – Apr 2024",
    category: "exercises",
    techOriginal: ["React", "React Router", "Bootstrap", "CRA"],
    techRemastered: ["TypeScript", "React", "Tailwind", "App Router"],
    techReimagined: ["React", "Server Components", "Modern Patterns"],
    original: (
      <OriginalFrame src="/originals/react-exercises/music-search/index.html" />
    ),
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "css-responsive-nav",
    title: "Responsive Navigation",
    description: "Pure CSS responsive navigation with dynamic sections.",
    year: "Jun 2024",
    category: "exercises",
    techOriginal: ["HTML", "CSS", "JavaScript"],
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["React", "Animated Menu", "Mobile-First"],
    original: <OriginalFrame src="/originals/css-responsive-nav/index.html" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "restaurant-menu",
    title: "Restaurant Menu",
    description: "Multi-page restaurant website with menu, about, and contact.",
    year: "Oct 2023",
    category: "exercises",
    techOriginal: ["HTML", "CSS"],
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["React", "CMS", "Online Ordering", "Dark Mode"],
    original: <OriginalFrame src="/originals/restaurant-menu/index.html" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
];
