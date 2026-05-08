import { type ReactNode } from "react";
import { OriginalFrame } from "@/components/ui/OriginalFrame";
import { PythonFundamentalsOriginal } from "@/components/originals/PythonFundamentalsOriginal";
import { ServerAppOriginal } from "@/components/originals/ServerAppOriginal";
import { MusicTourOriginal } from "@/components/originals/MusicTourOriginal";
import { JaskisOriginal } from "@/components/originals/JaskisOriginal";
import { AdminPortalOriginal } from "@/components/originals/AdminPortalOriginal";
import { SqlDemoOriginal } from "@/components/originals/SqlDemoOriginal";
import {
  GwhacAMoleReimagined,
  RestRantReimagined,
  CommerceArrayReimagined,
  JacksPaintReimagined,
  SqlInjectionReimagined,
  TimerStopwatchReimagined,
  WebGameReimagined,
  ArtGalleryReimagined,
  PetFaxReimagined,
  PlaceholderReimagined,
} from "@/components/reimagined";
import {
  GwhacAMole,
  TimerStopwatch,
  RestaurantMenu,
  JacksPaint,
  ResponsiveNav,
  HtmlCssFundamentals,
  FoodTruck,
  CopycatActivity,
  MyValues,
  JsDomEvents,
  ReactExercises,
  AdminPortal,
  InteractiveMap,
  StockCharts,
  ArtGallery,
  QuirkTruck,
  RestRant,
  CommerceArray,
  SqlInjectionDemo,
  Enterprize,
  MusicTourApi,
  PetFax,
  PythonFundamentals,
  WebGame,
  NextjsDashboard,
  Jaskis,
} from "@/components/remastered";

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
  // GAMES
  {
    slug: "milestown",
    title: "MilestO-W-N",
    description:
      "1-4 player territory game. Three generations: original, multiplayer remake, and OWN3.",
    year: "Jan 2024",
    category: "games",
    techOriginal: ["JavaScript", "HTML", "CSS"],
    techRemastered: ["JavaScript", "WebSocket", "P2P Mesh"],
    techReimagined: ["React", "Canvas", "WebRTC", "Server Actions"],
    original: <OriginalFrame src="/originals/milestown/index.html" />,
    remastered: (
      <Placeholder label="milestown2 — multiplayer remake (May 2024)" />
    ),
    reimagined: <Placeholder label="OWN3 — the definitive version" />,
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
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["React", "Canvas", "Leaderboard", "Sound", "Levels"],
    original: <OriginalFrame src="/originals/gwhac-a-mole/index.html" />,
    remastered: <GwhacAMole />,
    reimagined: <GwhacAMoleReimagined />,
  },
  {
    slug: "web-game",
    title: "Web Game Series",
    description: "Progressive game built across multiple assignments.",
    year: "Dec 2023 – Jan 2024",
    category: "games",
    techOriginal: ["JavaScript", "HTML", "live-server"],
    techRemastered: ["TypeScript", "React", "Keyboard Controls"],
    techReimagined: ["React", "Canvas", "State Machine", "Animations"],
    original: <OriginalFrame src="/originals/web-game/part-7/index.html" />,
    remastered: <WebGame />,
    reimagined: <WebGameReimagined />,
  },

  // FULL-STACK
  {
    slug: "rest-rant",
    title: "Rest-Rant",
    description: "Restaurant rating and review application.",
    year: "Feb – May 2024",
    category: "full-stack",
    techOriginal: ["Express", "React", "MongoDB"],
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["React", "Server Actions", "Maps", "Auth", "Drizzle"],
    original: <OriginalFrame src="/originals/rest-rant/index.html" />,
    remastered: <RestRant />,
    reimagined: <RestRantReimagined />,
    progression: true,
  },
  {
    slug: "commerce-array",
    title: "Commerce Array",
    description: "Full-stack e-commerce platform.",
    year: "Apr 2024",
    category: "full-stack",
    techOriginal: ["Express", "PostgreSQL", "Sequelize", "React"],
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["React", "Server Actions", "Stripe", "Drizzle"],
    original: <OriginalFrame src="/originals/commerce-array/index.html" />,
    remastered: <CommerceArray />,
    reimagined: <CommerceArrayReimagined />,
  },
  {
    slug: "enterprize",
    title: "EnterPrize",
    description:
      "Enterprise asset management. Evolved from QuirkTruck through multiple iterations.",
    year: "Jun 2024",
    category: "full-stack",
    techOriginal: ["Next.js 15", "Prisma", "NeonDB"],
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["Next.js", "Drizzle", "RBAC", "Audit Log"],
    original: <OriginalFrame src="/originals/quirk-truck/index.html" />,
    remastered: <Enterprize />,
    reimagined: <Placeholder label="EnterPrize — live deployment" />,
    progression: true,
    externalLink: "https://enterprize-pi.vercel.app",
  },
  {
    slug: "nextjs-dashboard",
    title: "Next.js Dashboard",
    description: "Next.js app with authentication and database.",
    year: "Jun 2024",
    category: "full-stack",
    techOriginal: ["Next.js 16", "NextAuth v5", "Vercel Postgres"],
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["React", "Charts", "RBAC", "Real-time"],
    original: (
      <ServerAppOriginal
        title="Next.js Dashboard"
        tech="Next.js 16 + NextAuth v5 + Vercel Postgres"
        description="Full-featured dashboard with invoices, authentication, and database integration. Built following the official Next.js tutorial."
        note="This was a full-stack Next.js app. The original deployment is no longer live."
      />
    ),
    remastered: <NextjsDashboard />,
    reimagined: <PlaceholderReimagined title="" />,
  },

  // FRONTEND & UI
  {
    slug: "art-gallery",
    title: "React Art Gallery",
    description: "React-based art gallery.",
    year: "Mar 2024",
    category: "frontend",
    techOriginal: ["React", "Babel", "CSS"],
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["React", "Masonry", "Lightbox", "API Integration"],
    original: <OriginalFrame src="/originals/art-gallery/index.html" />,
    remastered: <ArtGallery />,
    reimagined: <ArtGalleryReimagined />,
  },
  {
    slug: "quirk-truck",
    title: "Quirk Truck",
    description: "Dynamic truck catalog. Precursor to EnterPrize.",
    year: "Feb 2024",
    category: "frontend",
    techOriginal: ["React", "Create React App", "CSS"],
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["React", "Server Components", "Image Optimization"],
    original: <OriginalFrame src="/originals/quirk-truck/index.html" />,
    remastered: <QuirkTruck />,
    reimagined: <PlaceholderReimagined title="" />,
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
    remastered: <TimerStopwatch />,
    reimagined: <TimerStopwatchReimagined />,
  },
  {
    slug: "food-truck",
    title: "Food Truck",
    description: "Food truck website with menu and jQuery animations.",
    year: "Oct 2023",
    category: "frontend",
    techOriginal: ["HTML", "CSS", "jQuery"],
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["React", "Server Components", "CMS", "Ordering"],
    original: <OriginalFrame src="/originals/food-truck/index.html" />,
    remastered: <FoodTruck />,
    reimagined: <PlaceholderReimagined title="" />,
  },
  {
    slug: "admin-portal",
    title: "Admin Portal",
    description: "Admin interface with dynamic form fields.",
    year: "Dec 2023",
    category: "frontend",
    techOriginal: ["JavaScript", "Express", "Fetch API"],
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["React", "CRUD", "Validation", "Toast Notifications"],
    original: <AdminPortalOriginal />,
    remastered: <AdminPortal />,
    reimagined: <PlaceholderReimagined title="" />,
  },
  {
    slug: "interactive-map",
    title: "Interactive Map",
    description: "Geolocation mapping with Leaflet.",
    year: "Jan 2024",
    category: "frontend",
    techOriginal: ["JavaScript", "Leaflet", "Foursquare API"],
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["React", "Mapbox", "Search", "Directions"],
    original: <OriginalFrame src="/originals/interactive-map/index.html" />,
    remastered: <InteractiveMap />,
    reimagined: <PlaceholderReimagined title="" />,
  },
  {
    slug: "stock-charts",
    title: "Stock Charts",
    description: "Financial data visualization.",
    year: "Jan 2024",
    category: "frontend",
    techOriginal: ["JavaScript", "Chart.js", "Express"],
    techRemastered: ["TypeScript", "React", "SVG Charts"],
    techReimagined: ["React", "Real-time", "WebSocket", "Candlestick"],
    original: <OriginalFrame src="/originals/stock-charts/index.html" />,
    remastered: <StockCharts />,
    reimagined: <PlaceholderReimagined title="" />,
  },
  {
    slug: "jacks-paint",
    title: "Jack's Paint",
    description: "Browser-based paint application.",
    year: "Dec 2023",
    category: "frontend",
    techOriginal: ["JavaScript", "jQuery", "Canvas"],
    techRemastered: ["TypeScript", "Canvas API", "Tailwind"],
    techReimagined: ["React", "Canvas", "Layers", "Tools", "Export"],
    original: <OriginalFrame src="/originals/jacks-paint/index.html" />,
    remastered: <JacksPaint />,
    reimagined: <JacksPaintReimagined />,
  },
  {
    slug: "copycat",
    title: "Copycat Activity",
    description: "HTML/CSS recreation from a design mockup.",
    year: "Nov 2023",
    category: "frontend",
    techOriginal: ["HTML", "CSS"],
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["React", "Responsive", "Animations", "Dark Mode"],
    original: <OriginalFrame src="/originals/copycat/index.html" />,
    remastered: <CopycatActivity />,
    reimagined: <PlaceholderReimagined title="" />,
  },
  {
    slug: "my-values",
    title: "My Values",
    description: "Personal values visualization.",
    year: "Dec 2023",
    category: "frontend",
    techOriginal: ["HTML", "CSS", "JavaScript"],
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["React", "Animations", "Interactive", "Shareable"],
    original: <OriginalFrame src="/originals/my-values/index.html" />,
    remastered: <MyValues />,
    reimagined: <PlaceholderReimagined title="" />,
  },

  // APIs & BACKEND
  {
    slug: "music-tour-api",
    title: "Music Tour API",
    description: "REST API for music tour management.",
    year: "Apr 2024",
    category: "api",
    techOriginal: ["Express", "PostgreSQL", "Sequelize"],
    techRemastered: ["TypeScript", "React", "Mock API"],
    techReimagined: ["Next.js API Routes", "Drizzle", "OpenAPI"],
    original: <MusicTourOriginal />,
    remastered: <MusicTourApi />,
    reimagined: <PlaceholderReimagined title="" />,
  },
  {
    slug: "sql-injection-demo",
    title: "SQL Injection Demo",
    description: "Educational SQL injection demonstration.",
    year: "May 2024",
    category: "api",
    techOriginal: ["Express", "SQLite", "HTML"],
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["React", "Interactive Tutorial", "Sandbox"],
    original: <SqlDemoOriginal />,
    remastered: <SqlInjectionDemo />,
    reimagined: <SqlInjectionReimagined />,
  },
  {
    slug: "jaskis",
    title: "JASKIS",
    description: "Snack spot discovery and CRUD.",
    year: "Feb 2024",
    category: "api",
    techOriginal: ["MongoDB", "Express"],
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["Next.js API Routes", "Drizzle", "CRUD UI"],
    original: <JaskisOriginal />,
    remastered: <Jaskis />,
    reimagined: <PlaceholderReimagined title="" />,
  },

  // PYTHON
  {
    slug: "petfax",
    title: "PetFax",
    description: "Pet information catalog.",
    year: "May 2024",
    category: "python",
    techOriginal: ["Python", "Flask"],
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["Next.js", "Server Actions", "Image Upload"],
    original: <OriginalFrame src="/originals/petfax/index.html" />,
    remastered: <PetFax />,
    reimagined: <PetFaxReimagined />,
  },
  {
    slug: "python-fundamentals",
    title: "Python Fundamentals",
    description: "OOP, functional programming, error handling.",
    year: "May 2024",
    category: "python",
    techOriginal: ["Python"],
    techRemastered: ["Python → TypeScript", "Side-by-Side"],
    techReimagined: ["Next.js", "Interactive REPL"],
    original: <PythonFundamentalsOriginal />,
    remastered: <PythonFundamentals />,
    reimagined: <PlaceholderReimagined title="" />,
  },

  // EXERCISES
  {
    slug: "html-css-fundamentals",
    title: "HTML & CSS Fundamentals",
    description: "Layouts, forms, responsive design, animations.",
    year: "Oct – Dec 2023",
    category: "exercises",
    techOriginal: ["HTML", "CSS", "Media Queries"],
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["React", "Interactive Demos"],
    original: (
      <OriginalFrame src="/originals/html-css-fundamentals/hacker-times/index.html" />
    ),
    remastered: <HtmlCssFundamentals />,
    reimagined: <PlaceholderReimagined title="" />,
  },
  {
    slug: "js-dom-events",
    title: "JavaScript & DOM",
    description: "Event handling, DOM manipulation, OOP.",
    year: "Dec 2023 – Feb 2024",
    category: "exercises",
    techOriginal: ["JavaScript", "DOM API", "Fetch"],
    techRemastered: ["TypeScript", "React", "Interactive Demos"],
    techReimagined: ["React", "Interactive Tutorial"],
    original: (
      <OriginalFrame src="/originals/js-dom-events/events-demo/1. The Target Element.html" />
    ),
    remastered: <JsDomEvents />,
    reimagined: <PlaceholderReimagined title="" />,
  },
  {
    slug: "react-exercises",
    title: "React Learning Path",
    description: "Bootstrap, routing, music search, stylesheets.",
    year: "Mar – Apr 2024",
    category: "exercises",
    techOriginal: ["React", "React Router", "Bootstrap", "CRA"],
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["React", "Server Components"],
    original: (
      <OriginalFrame src="/originals/react-exercises/music-search/index.html" />
    ),
    remastered: <ReactExercises />,
    reimagined: <PlaceholderReimagined title="" />,
  },
  {
    slug: "css-responsive-nav",
    title: "Responsive Navigation",
    description: "Pure CSS responsive navigation.",
    year: "Jun 2024",
    category: "exercises",
    techOriginal: ["HTML", "CSS", "JavaScript"],
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["React", "Animated Menu", "Mobile-First"],
    original: <OriginalFrame src="/originals/css-responsive-nav/index.html" />,
    remastered: <ResponsiveNav />,
    reimagined: <PlaceholderReimagined title="" />,
  },
  {
    slug: "restaurant-menu",
    title: "Restaurant Menu",
    description: "Multi-page restaurant website.",
    year: "Oct 2023",
    category: "exercises",
    techOriginal: ["HTML", "CSS"],
    techRemastered: ["TypeScript", "React", "Tailwind"],
    techReimagined: ["React", "CMS", "Online Ordering"],
    original: <OriginalFrame src="/originals/restaurant-menu/index.html" />,
    remastered: <RestaurantMenu />,
    reimagined: <PlaceholderReimagined title="" />,
  },
];
