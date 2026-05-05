"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

const NAV_ITEMS = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "services", label: "Services" },
  { id: "portfolio", label: "Portfolio" },
  { id: "contact", label: "Contact" },
];

const SECTIONS: Record<string, { title: string; content: string }> = {
  home: {
    title: "Welcome",
    content:
      "This is the home section. The navigation above is fully responsive — resize your browser to see it collapse into a hamburger menu on mobile.",
  },
  about: {
    title: "About",
    content:
      "This demonstrates a responsive navigation pattern. The original used pure CSS media queries and JavaScript for section generation.",
  },
  services: {
    title: "Services",
    content:
      "In the remastered version, we use Tailwind's responsive utilities and React state for the mobile toggle.",
  },
  portfolio: {
    title: "Portfolio",
    content:
      "The layout adapts from a horizontal nav bar on desktop to a full-screen overlay menu on mobile.",
  },
  contact: {
    title: "Contact",
    content:
      "This is the contact section. The smooth scrolling and active state tracking maintain the same UX as the original.",
  },
};

export function ResponsiveNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState("home");

  const navigate = (id: string) => {
    setActive(id);
    setMobileOpen(false);
  };

  return (
    <div className="flex min-h-[60vh] flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between px-6 py-3">
          <span className="font-bold">ResponsiveNav</span>

          {/* Desktop nav */}
          <nav className="hidden gap-1 sm:flex">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${active === item.id ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"}`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Mobile hamburger */}
          <button
            className="sm:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile overlay */}
        {mobileOpen && (
          <nav className="flex flex-col border-t border-zinc-200 bg-white p-4 sm:hidden dark:border-zinc-700 dark:bg-zinc-900">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`rounded-md px-4 py-2 text-left text-sm font-medium ${active === item.id ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h2 className="text-2xl font-bold">{SECTIONS[active]?.title}</h2>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            {SECTIONS[active]?.content}
          </p>
        </div>
      </main>
    </div>
  );
}
