"use client";

import { useState } from "react";
import Link from "next/link";
import { Globe } from "@/components/ui/Globe";
import {
  PROJECTS,
  CATEGORY_LABELS,
  type Category,
  type Project,
} from "@/lib/projects";
import { Globe as GlobeIcon, List } from "lucide-react";
import styles from "./LandingView.module.css";

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

function ListView() {
  const categories = Object.keys(CATEGORY_LABELS) as Category[];

  return (
    <div className={styles.listShell}>
      {categories.map((category) => {
        const projects = PROJECTS.filter((p) => p.category === category);
        if (projects.length === 0) return null;

        return (
          <section key={category} className={styles.listSection}>
            <h2 className={`text-xl font-semibold ${styles.listSectionTitle}`}>
              {CATEGORY_LABELS[category]}
            </h2>
            <div className={styles.listGrid}>
              {projects.map((project) => (
                <Link
                  key={project.slug}
                  href={project.href ?? `/${project.slug}`}
                  className={styles.listCardLink}
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
                  <p className={`text-xs ${styles.listCardYear}`}>
                    {project.year}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function LandingView() {
  const [view, setView] = useState<"globe" | "list">("globe");

  const projectCards = PROJECTS.map((project) => ({
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

      {view === "globe" ? (
        <div className={styles.globeWrap}>
          <Globe items={globeItems} />
          <div className={styles.globeLegend}>
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => (
              <span key={cat} className={`text-xs ${styles.legendItem}`}>
                <span className={styles.categoryDot} data-category={cat} />
                {CATEGORY_LABELS[cat]}
              </span>
            ))}
          </div>
          <p className={`text-xs ${styles.globeHint}`}>
            Drag to rotate. Click a card to explore.
          </p>
        </div>
      ) : (
        <div style={{ marginTop: "3rem", width: "100%" }}>
          <ListView />
        </div>
      )}
    </div>
  );
}
