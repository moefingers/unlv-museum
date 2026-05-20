/**
 * Text wrapping utility for face-aligned labels.
 *
 * Wraps a title into a *rectangular* text band, with greedy line breaking
 * and shrink-to-fit font sizing. The output is consumed by PolyhedronGlobe,
 * which renders the text inside each face's tangent-plane coordinate system
 * (oriented with "up" toward the sphere's north pole) and clips overflow
 * to the face polygon. So this utility doesn't need to know about the
 * triangle's shape envelope — face clipping handles overflow visually.
 *
 * Algorithm:
 *   1. Try a starting font size. Compute line height.
 *   2. Determine maxLines = floor(bandHeight / lineHeight).
 *   3. Greedy-wrap words into lines that fit bandWidth.
 *   4. If words don't all fit, shrink font and retry.
 *   5. At minFontSize, accept the partial fit and mark truncated=true.
 */

export interface WrapInput {
  /** Width of the rectangular text band, in caller's unit. */
  bandWidth: number;
  /** Height of the rectangular text band, in caller's unit. */
  bandHeight: number;
  /** Starting font size to try (in caller's unit). */
  startFontSize: number;
  /** Smallest font size we'll accept; below this, text gets truncated. */
  minFontSize: number;
  /**
   * Measurement function — given a string and font size, returns its
   * rendered width. The default heuristic works for UI sans-serif
   * proportions; callers can pass a measureWidth function that uses
   * Canvas's measureText on the actual rendered font for exactness.
   */
  measureWidth?: (text: string, fontSize: number) => number;
}

export interface WrapLine {
  text: string;
  /**
   * Y position along the band's vertical axis [0, 1], where 0 is the
   * top of the band (toward "north") and 1 is the bottom (toward "south").
   */
  y: number;
}

export interface WrapResult {
  lines: WrapLine[];
  fontSize: number;
  /** Number of attempts (font size steps) before fitting. */
  attempts: number;
  /** True when even minFontSize couldn't fit — text will be truncated. */
  truncated: boolean;
}

/**
 * Heuristic width measurement. We assume the typeface is roughly the
 * proportions of a UI sans-serif (Inter, Geist, system-ui). Lowercase
 * letters average ~0.55 × fontSize; uppercase ~0.65; digits ~0.6;
 * spaces ~0.3; punctuation ~0.4.
 *
 * This is approximate. For exact widths, callers can pass a measureWidth
 * function that uses Canvas's measureText on the actual rendered font.
 * For our use case (titles on a sphere where users will drag-pan to
 * read), the heuristic is more than accurate enough.
 */
export function defaultMeasureWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const ch of text) {
    if (ch === " ") width += fontSize * 0.3;
    else if (/[A-Z]/.test(ch)) width += fontSize * 0.65;
    else if (/[0-9]/.test(ch)) width += fontSize * 0.6;
    else if (/[a-z]/.test(ch)) width += fontSize * 0.55;
    else width += fontSize * 0.4;
  }
  return width;
}

/**
 * Wrap a title into lines that fit a rectangular text band, sized so the
 * text *fills* the band — large enough that further growth would either
 * force an extra line or push a line past the band's width.
 *
 * The lines' `y` positions are in [0, 1] along the band's vertical axis
 * — 0 at the top edge (toward north on the consuming face), 1 at the
 * bottom edge.
 *
 * Algorithm:
 *   1. Start at maxFontSize and shrink until the title fits (the
 *      "shrink to fit" phase — handles titles too long to fit big).
 *   2. From the fitting size, *grow* by small steps until growing
 *      further would no longer fit — this finds the largest font that
 *      uses the same line count. Returns that as the final size.
 *   3. At minFontSize without fitting → accept partial fit, ellipsize.
 *
 * The combined shrink + grow makes short titles ("PetFax") render large
 * to fill the band, while long titles ("MilestO-W-N Multiplayer") still
 * fit gracefully.
 */
export function wrapTriangleText(title: string, input: WrapInput): WrapResult {
  const {
    bandWidth,
    bandHeight,
    startFontSize,
    minFontSize,
    measureWidth = defaultMeasureWidth,
  } = input;

  const LINE_SPACING = 1.15;
  const SHRINK_STEP = 0.92;
  const GROW_STEP = 1.04;
  const MAX_ATTEMPTS = 40;

  const words = title.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return {
      lines: [],
      fontSize: startFontSize,
      attempts: 0,
      truncated: false,
    };
  }

  // ─── Phase 1: shrink to fit ─────────────────────────────────────
  // Begin at startFontSize. If text doesn't fit, shrink. Continues
  // until either text fits OR we hit minFontSize (in which case we
  // accept truncation).
  let fontSize = startFontSize;
  let attempts = 0;
  let fittingResult: TryWrapResult | null = null;

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;
    const result = layoutAt(
      fontSize,
      bandHeight,
      bandWidth,
      words,
      LINE_SPACING,
      measureWidth,
    );

    if (result.placedAll) {
      fittingResult = result;
      break;
    }

    if (fontSize <= minFontSize) {
      // Floor: accept the partial fit, ellipsize last line.
      const truncatedLines = result.lines.slice(0, result.linesUsed);
      if (truncatedLines.length > 0) {
        const last = truncatedLines[truncatedLines.length - 1]!;
        truncatedLines[truncatedLines.length - 1] = {
          ...last,
          text: last.text.replace(/[\s.,;]+$/, "") + "…",
        };
      }
      return {
        lines: truncatedLines,
        fontSize,
        attempts,
        truncated: true,
      };
    }

    fontSize = Math.max(minFontSize, fontSize * SHRINK_STEP);
  }

  if (!fittingResult) {
    // Shouldn't reach: MAX_ATTEMPTS exhausted without fitting. Bail.
    return {
      lines: [],
      fontSize,
      attempts,
      truncated: true,
    };
  }

  // ─── Phase 2: grow to fill ──────────────────────────────────────
  // We have a font size that fits. Try larger sizes; keep the largest
  // that still fits. Cap at a reasonable expansion ceiling to prevent
  // a 1-word title from blowing up to 10× its surroundings — text
  // should be *large but proportionate*, not gigantic.
  //
  // Cap on font size: never grow past 3× startFontSize. This keeps very
  // short titles from looking absurdly oversized relative to longer
  // siblings on the sphere.
  let bestResult = fittingResult;
  let bestSize = fontSize;
  let growSize = fontSize;
  const growCap = startFontSize * 3;

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;
    growSize = growSize * GROW_STEP;
    if (growSize > growCap) break;
    const result = layoutAt(
      growSize,
      bandHeight,
      bandWidth,
      words,
      LINE_SPACING,
      measureWidth,
    );
    if (!result.placedAll) break;
    bestResult = result;
    bestSize = growSize;
  }

  return {
    lines: bestResult.lines.slice(0, bestResult.linesUsed),
    fontSize: bestSize,
    attempts,
    truncated: false,
  };
}

/**
 * One pass at fitting `words` into a band of given dimensions at fontSize.
 * Computes max lines from band height and line height, distributes lines
 * evenly, and greedy-wraps. Used by both shrink and grow phases.
 */
function layoutAt(
  fontSize: number,
  bandHeight: number,
  bandWidth: number,
  words: string[],
  lineSpacing: number,
  measureWidth: (text: string, fontSize: number) => number,
): TryWrapResult {
  const lineHeight = fontSize * lineSpacing;
  const maxLines = Math.max(1, Math.floor(bandHeight / lineHeight));
  const yPositions: number[] = [];
  for (let i = 0; i < maxLines; i++) {
    yPositions.push((i + 0.5) / maxLines);
  }
  return tryWrap(words, fontSize, bandWidth, yPositions, measureWidth);
}

interface TryWrapResult {
  lines: WrapLine[];
  linesUsed: number;
  placedAll: boolean;
}

/**
 * One pass at fitting `words` into the given y-positions at fontSize,
 * with each line constrained to bandWidth (with small horizontal margin).
 */
function tryWrap(
  words: string[],
  fontSize: number,
  bandWidth: number,
  yPositions: number[],
  measureWidth: (text: string, fontSize: number) => number,
): TryWrapResult {
  const lines: WrapLine[] = [];
  let wordIdx = 0;
  // Small horizontal margin (5%) so text doesn't kiss the band edges.
  const usableWidth = bandWidth * 0.95;

  for (let li = 0; li < yPositions.length; li++) {
    const y = yPositions[li]!;
    const lineWords: string[] = [];
    while (wordIdx < words.length) {
      const candidate = [...lineWords, words[wordIdx]!].join(" ");
      if (measureWidth(candidate, fontSize) <= usableWidth) {
        lineWords.push(words[wordIdx]!);
        wordIdx += 1;
      } else if (lineWords.length === 0) {
        // Single word doesn't fit — accept anyway, will overflow
        // (face clip will trim it visually).
        lineWords.push(words[wordIdx]!);
        wordIdx += 1;
        break;
      } else {
        break;
      }
    }

    if (lineWords.length === 0) break;
    lines.push({ text: lineWords.join(" "), y });

    if (wordIdx >= words.length) {
      return { lines, linesUsed: li + 1, placedAll: true };
    }
  }

  return {
    lines,
    linesUsed: lines.length,
    placedAll: wordIdx >= words.length,
  };
}
