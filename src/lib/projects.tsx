import { type ReactNode } from "react";

export interface Project {
  slug: string;
  title: string;
  description: string;
  year: string;
  techOriginal: string[];
  techRemastered: string[];
  techReimagined: string[];
  original: ReactNode;
  remastered: ReactNode;
  reimagined: ReactNode;
}

function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="text-zinc-400 dark:text-zinc-600">{label}</p>
    </div>
  );
}

export const PROJECTS: Project[] = [
  {
    slug: "milestown",
    title: "MilestO-W-N",
    description:
      "1-4 player territory game. Dynamic map rendering from matrices.",
    year: "Jan 2024",
    techOriginal: ["JavaScript", "HTML", "CSS"],
    techRemastered: ["TypeScript", "Canvas API", "CSS"],
    techReimagined: ["React", "Canvas", "WebSocket", "Server Actions"],
    original: <Placeholder label="Original — coming soon" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "commerce-array",
    title: "Commerce Array",
    description: "Full-stack e-commerce website with basic functionality.",
    year: "Apr 2024",
    techOriginal: ["JavaScript", "HTML", "CSS", "Express"],
    techRemastered: ["TypeScript", "Server Components", "Tailwind"],
    techReimagined: ["React", "Server Actions", "Stripe", "Drizzle"],
    original: <Placeholder label="Original — coming soon" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "enterprize",
    title: "EnterPrize",
    description: "Enterprise data dashboard for employees.",
    year: "Jun 2024",
    techOriginal: ["TypeScript", "Next.js", "PostgreSQL"],
    techRemastered: ["TypeScript", "Server Components", "Drizzle"],
    techReimagined: ["React", "Charts", "RBAC", "Real-time"],
    original: <Placeholder label="Original — coming soon" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "rest-rant",
    title: "Rest-Rant",
    description: "Restaurant rating and review application.",
    year: "Feb 2024",
    techOriginal: ["JavaScript", "Express", "CSS"],
    techRemastered: ["TypeScript", "Server Components", "Tailwind"],
    techReimagined: ["React", "Server Actions", "Maps", "Auth"],
    original: <Placeholder label="Original — coming soon" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
  {
    slug: "art-gallery",
    title: "React Art Gallery",
    description: "React-based art gallery.",
    year: "Mar 2024",
    techOriginal: ["JavaScript", "React", "CSS"],
    techRemastered: ["TypeScript", "React", "CSS Grid", "View Transitions"],
    techReimagined: ["React", "Masonry", "Lightbox", "API Integration"],
    original: <Placeholder label="Original — coming soon" />,
    remastered: <Placeholder label="Remastered — coming soon" />,
    reimagined: <Placeholder label="Reimagined — coming soon" />,
  },
];
