/**
 * Dynamic museum-header banner endpoint.
 *
 *   GET /github-banners/<slug>
 *
 * Looks up the project by museum slug in projects.tsx, derives runtime
 * data (commit count by moefingers on `original`, languages, fork state,
 * upstream parent), and returns the rendered SVG with aggressive caching
 * so camo/the README can fetch it cheaply.
 *
 * GitHub data fetching is best-effort: if a probe fails (rate limit,
 * offline), the banner still renders with whatever it does have.
 */

import {
  renderBanner,
  type BannerInput,
  type TierState,
} from "@/lib/banner-svg";
import { PROJECTS, getSourceRef, formatProjectDate } from "@/lib/projects";

const OWNER_USERNAME = "moefingers";

// Curated language → color (GitHub's `linguist` palette for the common ones).
// Unknown languages fall back to a neutral.
const LANG_COLORS: Record<string, string> = {
  JavaScript: "#f7df1e",
  TypeScript: "#3178c6",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Python: "#3572a5",
  Java: "#b07219",
  C: "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  Go: "#00add8",
  Rust: "#dea584",
  Ruby: "#701516",
  PHP: "#4f5d95",
  Shell: "#89e051",
  Dockerfile: "#384d54",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Astro: "#ff5d01",
  Markdown: "#083fa1",
};

function langColor(name: string): string {
  return LANG_COLORS[name] ?? "#9ca3af";
}

interface GhRepo {
  fork: boolean;
  parent?: { full_name: string } | null;
  created_at: string;
  default_branch: string;
}

async function ghJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "unlv-museum-banner",
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
      // Next data cache: 1h. camo on the GitHub side caches longer anyway.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchRepoFacts(repoSlug: string) {
  const repo = await ghJson<GhRepo>(`/repos/${repoSlug}`);

  // Count owner commits on the right ref:
  //   - If `original` branch exists (the project has been converted), use it —
  //     keeps museum-ready housekeeping commits out of the count.
  //   - Otherwise, use the default branch (main/master/shepherd/whatever) —
  //     captures real work on pre-conversion repos.
  const commitsRef = repo
    ? repo.default_branch === "museum-ready/original"
      ? "original"
      : repo.default_branch
    : null;

  const [languagesRaw, ownerCommits] = await Promise.all([
    ghJson<Record<string, number>>(`/repos/${repoSlug}/languages`),
    commitsRef
      ? ghJson<{ sha: string }[]>(
          `/repos/${repoSlug}/commits?author=${OWNER_USERNAME}&sha=${encodeURIComponent(commitsRef)}&per_page=100`,
        )
      : Promise.resolve([]),
  ]);

  const languages = languagesRaw
    ? (() => {
        const total = Object.values(languagesRaw).reduce((a, b) => a + b, 0);
        if (total === 0) return [];
        return Object.entries(languagesRaw)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, bytes]) => ({
            name,
            pct: (bytes / total) * 100,
            color: langColor(name),
          }));
      })()
    : [];

  return {
    fork: repo?.fork ?? false,
    parent: repo?.parent?.full_name ?? null,
    createdAt: repo?.created_at ?? null,
    languages,
    ownerCommitCount: Array.isArray(ownerCommits) ? ownerCommits.length : 0,
  };
}

function formatMonthYear(iso: string): string {
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

function smartDateLabel(opts: {
  isFork: boolean;
  ownerCommitCount: number;
  ownerFirst: string | null;
  ownerLast: string | null;
  createdAt: string | null;
}): string {
  // Substantive owner work → "Active <range>"
  if (opts.ownerCommitCount > 0 && opts.ownerFirst && opts.ownerLast) {
    const first = formatMonthYear(opts.ownerFirst);
    const last = formatMonthYear(opts.ownerLast);
    return first === last ? `Active ${first}` : `Active ${first} – ${last}`;
  }
  // Fork starter with zero owner commits → "Forked <date>"
  if (opts.isFork && opts.createdAt) {
    return `Forked ${formatMonthYear(opts.createdAt.slice(0, 10))}`;
  }
  // Own repo with no commits or sources data → "Created <date>"
  if (opts.createdAt) {
    return `Created ${formatMonthYear(opts.createdAt.slice(0, 10))}`;
  }
  return "";
}

function tiersFor(slug: string): { label: string; state: TierState }[] {
  const p = PROJECTS.find((x) => x.slug === slug);
  if (!p) return [];

  const liveOriginal = p.original != null || p.href != null;
  const liveEnhanced =
    p.enhanced != null
      ? !isComingSoonPlaceholder(p.enhanced)
      : p.enhancedExternal != null;
  const liveReimagined =
    p.reimagined != null
      ? !isComingSoonPlaceholder(p.reimagined)
      : p.reimaginedExternal != null;

  const all = [
    {
      mode: "original" as const,
      label: "Original",
      state: (liveOriginal ? "live" : "coming-soon") as TierState,
    },
    {
      mode: "enhanced" as const,
      label: "Enhanced",
      state: (liveEnhanced ? "live" : "coming-soon") as TierState,
    },
    {
      mode: "reimagined" as const,
      label: "Reimagined",
      state: (liveReimagined ? "live" : "coming-soon") as TierState,
    },
  ];

  // Default: all three tiers. Override via plannedTiers on the project.
  const planned = p.plannedTiers ?? ["original", "enhanced", "reimagined"];
  return all
    .filter((t) => planned.includes(t.mode))
    .map(({ label, state }) => ({ label, state }));
}

/**
 * The COMING_SOON placeholder in projects.tsx is a React element wrapping
 * a div with the literal text "Coming soon". We detect it heuristically
 * since we can't import COMING_SOON itself (server-only React rendering).
 */
function isComingSoonPlaceholder(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const el = node as { props?: { label?: unknown } };
  return el.props?.label === "Coming soon";
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const themeParam = new URL(req.url).searchParams.get("theme");
  const theme: "light" | "dark" | undefined =
    themeParam === "light" || themeParam === "dark" ? themeParam : undefined;

  const project = PROJECTS.find((p) => p.slug === slug);
  if (!project) {
    return new Response(`Unknown museum slug: ${slug}`, { status: 404 });
  }
  if (!project.synopsis) {
    return new Response(
      `Project ${slug} has no synopsis yet — add one to projects.tsx`,
      { status: 422 },
    );
  }

  const ref = getSourceRef(slug);
  // Prefer the explicit project.repo when set; fall back to sources.generated
  // for already-converted projects.
  const repoSlug = project.repo ?? (ref?.repo?.includes("/") ? ref.repo : null);
  const facts = repoSlug
    ? await fetchRepoFacts(repoSlug)
    : {
        fork: false,
        parent: null,
        createdAt: null,
        languages: [],
        ownerCommitCount: 0,
      };

  const dateLabel =
    smartDateLabel({
      isFork: facts.fork,
      ownerCommitCount: facts.ownerCommitCount,
      ownerFirst: ref?.ownerFirstCommit ?? null,
      ownerLast: ref?.ownerLastCommit ?? null,
      createdAt: facts.createdAt,
    }) ||
    // Fall back to the date helper that uses sources.generated.json data
    // even without GitHub API access.
    (ref ? formatProjectDate(ref) : null) ||
    project.year;

  const techStack =
    project.techOriginal && project.techOriginal.length > 0
      ? project.techOriginal
      : [];

  const input: BannerInput = {
    title: project.title,
    synopsis: project.synopsis,
    techStack,
    dateLabel,
    commitsByMe: facts.ownerCommitCount,
    languages: facts.languages,
    tiers: tiersFor(slug),
    forkedFrom: facts.fork ? facts.parent : null,
    theme,
  };

  const svg = renderBanner(input);

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // 1h fresh + 24h stale-while-revalidate at the CDN.
      "Cache-Control":
        "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
