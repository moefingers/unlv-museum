/**
 * Deterministic SVG book-cover generator for the Enhanced-tier
 * admin-portal Replaced UI.
 *
 * Each cover is seeded from the book row's id (or any stable string), so
 * the same book always renders the same cover across requests. The point
 * is unique-looking placeholders — not real cover art — so every dial is
 * randomized: palette family, gradient angle, pattern overlay, typography
 * choice, decorative shapes.
 *
 * Pure function. No fs, no fetch. Consumed by the
 * /api/v2/admin-portal/cover/[id] route, which is the Enhanced-tier
 * carve-out for era-impossible client features (the source's db.json
 * has real cover URLs OR no cover at all — synthesizing one for the
 * Original tier would have falsified the data shape).
 *
 * This module was deleted at commit 80ea80a when synthetic covers were
 * removed from the Original tier (correctly — that was a faithfulness
 * regression). The Enhanced-tier Replaced UI is the right home for it.
 */

const W = 320;
const H = 480;

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rnd: () => number, arr: readonly T[]): T =>
  arr[Math.floor(rnd() * arr.length)]!;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// HSL → hex for compact embedding.
function hsl(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  const toHex = (x: number) =>
    Math.round(255 * x)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/** Wrap text into N-char lines, returning at most maxLines lines. */
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length <= maxChars) {
      line = candidate;
    } else {
      if (line) out.push(line);
      line = w;
      if (out.length >= maxLines) break;
    }
  }
  if (line && out.length < maxLines) out.push(line);
  return out.slice(0, maxLines);
}

const FONT_STACKS = [
  '"Georgia", "Times New Roman", serif',
  '"Helvetica Neue", "Arial", sans-serif',
  '"Courier New", "Courier", monospace',
  '"Palatino", "Book Antiqua", serif',
  '"Trebuchet MS", "Lucida Sans", sans-serif',
  '"Impact", "Charcoal", sans-serif',
];

const PATTERNS = [
  "none",
  "dots",
  "stripes-h",
  "stripes-d",
  "grid",
  "rings",
] as const;
type Pattern = (typeof PATTERNS)[number];

function patternDef(p: Pattern, id: string, ink: string): string {
  if (p === "none") return "";
  if (p === "dots") {
    return `<pattern id="${id}" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="9" cy="9" r="1.6" fill="${ink}" fill-opacity="0.25"/></pattern>`;
  }
  if (p === "stripes-h") {
    return `<pattern id="${id}" width="10" height="10" patternUnits="userSpaceOnUse"><rect x="0" y="0" width="10" height="3" fill="${ink}" fill-opacity="0.18"/></pattern>`;
  }
  if (p === "stripes-d") {
    return `<pattern id="${id}" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect x="0" y="0" width="14" height="3" fill="${ink}" fill-opacity="0.18"/></pattern>`;
  }
  if (p === "grid") {
    return `<pattern id="${id}" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0L0 0 0 22" stroke="${ink}" stroke-opacity="0.18" fill="none"/></pattern>`;
  }
  // rings
  return `<pattern id="${id}" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="14" fill="none" stroke="${ink}" stroke-opacity="0.18"/></pattern>`;
}

/** Pick #18181b or #fafafa based on the background's perceived luminance. */
function contrastText(hex: string): string {
  if (!hex.startsWith("#") || hex.length < 7) return "#fafafa";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#18181b" : "#fafafa";
}

export interface CoverInput {
  /** Stable seed — typically the book's row id stringified. */
  seed: string;
  title: string;
  year?: string | null;
}

export function renderBookCover({ seed, title, year }: CoverInput): string {
  const rnd = prng(hashString(seed));

  // Two-color gradient seeded from the same PRNG.
  const hueA = Math.floor(rnd() * 360);
  const hueB = (hueA + 60 + Math.floor(rnd() * 240)) % 360;
  const sat = 50 + Math.floor(rnd() * 40);
  const lightA = 35 + Math.floor(rnd() * 35);
  const lightB = 35 + Math.floor(rnd() * 35);
  const colorA = hsl(hueA, sat, lightA);
  const colorB = hsl(hueB, sat, lightB);

  // Gradient angle.
  const angle = Math.floor(rnd() * 360);
  const x2 = 50 + 50 * Math.cos((angle * Math.PI) / 180);
  const y2 = 50 + 50 * Math.sin((angle * Math.PI) / 180);

  const ink = contrastText(colorA);
  const pattern = pick(rnd, PATTERNS);
  const font = pick(rnd, FONT_STACKS);

  const titleLines = wrap(title, 14, 4);
  const titleSize = titleLines.length > 2 ? 30 : 38;
  const titleStart = 110 + (4 - titleLines.length) * 12;

  const gradientId = `cv-grad-${seed}`;
  const patternId = `cv-pat-${seed}`;
  const patternFill =
    pattern === "none"
      ? ""
      : `<rect width="${W}" height="${H}" fill="url(#${patternId})"/>`;

  // Decorative shape band (varies position + size).
  const bandY = Math.floor(rnd() * 200) + 200;
  const bandH = 8 + Math.floor(rnd() * 14);
  const bandShape = `<rect x="${Math.floor(rnd() * 60)}" y="${bandY}" width="${W - Math.floor(rnd() * 100)}" height="${bandH}" fill="${ink}" fill-opacity="0.35"/>`;

  // A second decorative element: corner shape (circle, square, or chevron).
  const cornerType = Math.floor(rnd() * 3);
  let corner = "";
  const cs = 40 + Math.floor(rnd() * 60);
  if (cornerType === 0) {
    corner = `<circle cx="${W - 50}" cy="50" r="${cs / 2}" fill="${ink}" fill-opacity="0.25"/>`;
  } else if (cornerType === 1) {
    corner = `<rect x="${W - cs - 30}" y="20" width="${cs}" height="${cs}" fill="${ink}" fill-opacity="0.25"/>`;
  } else {
    corner = `<polygon points="${W - 80},20 ${W - 20},20 ${W - 20},80" fill="${ink}" fill-opacity="0.25"/>`;
  }

  // Vertical "spine" rule on the left edge.
  const spine = `<rect x="0" y="0" width="14" height="${H}" fill="${ink}" fill-opacity="0.18"/>`;

  // Title text — one tspan per wrapped line.
  const titleTspans = titleLines
    .map(
      (line, i) =>
        `<tspan x="30" dy="${i === 0 ? 0 : titleSize + 4}">${esc(line)}</tspan>`,
    )
    .join("");

  const yearLabel = year
    ? `<text x="30" y="${H - 38}" fill="${ink}" fill-opacity="0.8" font-family='${font}' font-size="16" font-weight="700">${esc(year)}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title)} placeholder cover">
  <defs>
    <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="${x2}%" y2="${y2}%">
      <stop offset="0" stop-color="${colorA}"/>
      <stop offset="1" stop-color="${colorB}"/>
    </linearGradient>
    ${patternDef(pattern, patternId, ink)}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#${gradientId})"/>
  ${patternFill}
  ${spine}
  ${corner}
  ${bandShape}
  <text x="30" y="${titleStart}" fill="${ink}" font-family='${font}' font-size="${titleSize}" font-weight="800" letter-spacing="-0.01em">${titleTspans}</text>
  ${yearLabel}
  <text x="${W - 30}" y="${H - 24}" fill="${ink}" fill-opacity="0.6" font-family='${font}' font-size="11" font-weight="600" text-anchor="end" letter-spacing="0.12em">UNLV MUSEUM</text>
</svg>`;
}
