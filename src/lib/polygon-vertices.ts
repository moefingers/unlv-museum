/**
 * Compute the vertex positions of a regular n-gon under a uniform
 * topology of N vertices (N >= n).
 *
 * When N > n, the extra "vertices" are placed on the edges of the
 * n-gon, evenly distributed, so they sit invisibly on a straight
 * segment. This lets the unfold animation use a single fixed vertex
 * count (the final hexagon's 6) while morphing between intermediate
 * shapes — promoting a mid-edge vertex to a real corner happens by
 * pulling its target angle to a corner of the higher-n polygon, and
 * the per-vertex springs handle the motion.
 *
 * Special case stage=0 ("dot"): all topology vertices collapse onto
 * the centroid (radius=0). Used as the starting state for the unfold —
 * every vertex springs out from a single point.
 */

interface ShapeConfig {
  /** Number of real corners (3=triangle, 4=square, 6=hexagon, etc). */
  sides: number;
  /** Radius from center to each corner, in viewBox units. */
  radius: number;
  /**
   * Rotation offset in degrees. 0 puts the first vertex at the top
   * (12 o'clock); 90 puts it on the right. Used to align shapes
   * pleasingly during morph — e.g. a triangle and a hexagon both
   * pointing up.
   */
  rotation?: number;
}

/**
 * Compute the (x, y) coordinates of `topologyCount` points distributed
 * around the perimeter of a regular polygon of `sides` corners with
 * the given radius and rotation. Real corners are spaced sides-apart;
 * the remaining points fall on the straight edges between them.
 *
 * Center is at (0, 0). Caller is responsible for translating to viewBox.
 */
function polygonPerimeterPoints(
  config: ShapeConfig,
  topologyCount: number,
): { x: number; y: number }[] {
  const { sides, radius, rotation = 0 } = config;
  const rotRad = (rotation * Math.PI) / 180;

  // Real corner positions for the polygon's `sides` corners.
  const corners: { x: number; y: number }[] = [];
  for (let i = 0; i < sides; i++) {
    // Start at -π/2 so the first corner is at the top (12 o'clock).
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / sides + rotRad;
    corners.push({
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    });
  }

  // Distribute `topologyCount` points around the perimeter. Each
  // point is parametrized by a position `t` in [0, sides), where the
  // integer part identifies the edge and the fractional part is the
  // position along that edge from corner[i] to corner[i+1].
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < topologyCount; i++) {
    const t = (i * sides) / topologyCount;
    const edgeIndex = Math.floor(t) % sides;
    const frac = t - Math.floor(t);
    const a = corners[edgeIndex]!;
    const b = corners[(edgeIndex + 1) % sides]!;
    out.push({
      x: a.x + (b.x - a.x) * frac,
      y: a.y + (b.y - a.y) * frac,
    });
  }
  return out;
}

export function unfoldStageVertices(
  stage: number,
  topologyCount: number,
  radius: number,
  rotation = 0,
): { x: number; y: number }[] {
  if (stage <= 0) {
    // Dot — all vertices collapsed at origin.
    return Array.from({ length: topologyCount }, () => ({ x: 0, y: 0 }));
  }
  if (stage === 1) {
    // Line — two real endpoints on opposite sides, mid-edge slots on
    // the line between them. polygonPerimeterPoints with sides=2 gives
    // a degenerate "polygon" (line): the two corners are at (radius, 0)
    // and (-radius, 0), the rest are interpolated along that segment.
    return polygonPerimeterPoints(
      { sides: 2, radius, rotation },
      topologyCount,
    );
  }
  // n-gon under uniform topology for n >= 2.
  return polygonPerimeterPoints(
    { sides: stage + 1, radius, rotation },
    topologyCount,
  );
}

/**
 * Stage labels for UI debugging — what shape each stage represents.
 */
export const STAGE_LABELS = [
  "dot",
  "line",
  "triangle",
  "square",
  "pentagon",
  "hexagon",
] as const;

export const FINAL_STAGE = STAGE_LABELS.length - 1; // hexagon, 5
