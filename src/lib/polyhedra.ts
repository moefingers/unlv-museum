/**
 * Polyhedron generation: icosahedron, frequency-N geodesic subdivisions,
 * and their Goldberg duals.
 *
 * Data model:
 *   Vec3:      { x, y, z } — a unit-sphere point (normalized).
 *   Mesh:      { vertices: Vec3[], faces: number[][] }
 *              faces are arrays of vertex indices, ordered counter-clockwise
 *              when viewed from outside the sphere.
 *
 * The face winding convention matters for backface culling at render time:
 *   compute the face normal as cross(B-A, C-A); if normal · viewVector > 0
 *   the face is back-facing and can be skipped.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Mesh {
  vertices: Vec3[];
  /**
   * Each face is a list of vertex indices, in CCW order viewed from
   * outside the sphere. Triangles have 3 indices; pentagons 5; hexagons
   * 6. Mixed face counts are fine — that's the Goldberg case.
   */
  faces: number[][];
}

// ─── Vec3 helpers ─────────────────────────────────────────────────

export function v3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(a: Vec3, k: number): Vec3 {
  return { x: a.x * k, y: a.y * k, z: a.z * k };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function length(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z);
}

export function normalize(a: Vec3): Vec3 {
  const l = length(a);
  if (l === 0) return { x: 0, y: 0, z: 0 };
  return { x: a.x / l, y: a.y / l, z: a.z / l };
}

export function centroid(points: Vec3[]): Vec3 {
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }),
    { x: 0, y: 0, z: 0 },
  );
  const n = points.length;
  return { x: sum.x / n, y: sum.y / n, z: sum.z / n };
}

// ─── Icosahedron (frequency-1 geodesic) ───────────────────────────

/**
 * Generate the icosahedron — 12 vertices and 20 equilateral triangular
 * faces inscribed in the unit sphere. Vertices come from the canonical
 * triple (±1, ±φ, 0) cyclic-permuted, then normalized.
 */
export function icosahedron(): Mesh {
  const phi = (1 + Math.sqrt(5)) / 2;
  const raw: Vec3[] = [
    // (±1, ±φ, 0) — three vertices? no, four per cyclic group, twelve total.
    { x: -1, y: phi, z: 0 },
    { x: 1, y: phi, z: 0 },
    { x: -1, y: -phi, z: 0 },
    { x: 1, y: -phi, z: 0 },

    { x: 0, y: -1, z: phi },
    { x: 0, y: 1, z: phi },
    { x: 0, y: -1, z: -phi },
    { x: 0, y: 1, z: -phi },

    { x: phi, y: 0, z: -1 },
    { x: phi, y: 0, z: 1 },
    { x: -phi, y: 0, z: -1 },
    { x: -phi, y: 0, z: 1 },
  ];
  const vertices = raw.map(normalize);

  // Canonical face list — each row is one triangle's three vertex indices.
  // Ordered CCW when viewed from outside.
  const faces: number[][] = [
    // top cap (around vertex 0)
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    // adjacent
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    // bottom adjacent
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    // bottom cap (around vertex 3, indirectly)
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];

  return { vertices, faces };
}

// ─── Frequency-N geodesic subdivision ──────────────────────────────

/**
 * Subdivide each triangular face into N² smaller triangles by trisecting
 * the edges into N segments and building a triangular grid. Each new
 * vertex is projected back onto the unit sphere.
 *
 * frequency = 1 returns the input unchanged.
 * frequency = 2 produces 80 triangles from a 20-tri icosahedron.
 * frequency = 3 produces 180 triangles.
 * frequency = 4 produces 320 triangles.
 *
 * Vertices on shared edges between adjacent input faces are deduplicated
 * by spatial hashing — without this, the dual operation produces wrong
 * neighbors.
 */
export function geodesicSubdivide(mesh: Mesh, frequency: number): Mesh {
  if (frequency <= 1) return mesh;

  const newVertices: Vec3[] = [];
  const vertexKey = new Map<string, number>();
  const KEY_PRECISION = 1e-6;

  const addVertex = (v: Vec3): number => {
    // Quantize coordinates for dedupe lookup.
    const k = `${Math.round(v.x / KEY_PRECISION)}|${Math.round(v.y / KEY_PRECISION)}|${Math.round(v.z / KEY_PRECISION)}`;
    const existing = vertexKey.get(k);
    if (existing !== undefined) return existing;
    const idx = newVertices.length;
    newVertices.push(v);
    vertexKey.set(k, idx);
    return idx;
  };

  const newFaces: number[][] = [];

  for (const face of mesh.faces) {
    const [iA, iB, iC] = face as [number, number, number];
    const A = mesh.vertices[iA]!;
    const B = mesh.vertices[iB]!;
    const C = mesh.vertices[iC]!;

    // Build a triangular grid of (frequency+1) rows. Row i has (N - i + 1)
    // points along it, going from (B + i*(A-B)/N) to (C + i*(A-C)/N).
    // The grid is parameterized by (i, j) where i is the row (0 = BC edge,
    // N = vertex A) and j is the column within the row (0 = B side, max = C side).
    const N = frequency;
    const grid: number[][] = [];
    for (let i = 0; i <= N; i++) {
      const row: number[] = [];
      const rowLen = N - i;
      for (let j = 0; j <= rowLen; j++) {
        // Barycentric coordinates: a + b + c = 1
        const a = i / N;
        const b = j === 0 && rowLen === 0 ? 0 : (rowLen - j) / N;
        const c = 1 - a - b;
        const p = normalize({
          x: a * A.x + b * B.x + c * C.x,
          y: a * A.y + b * B.y + c * C.y,
          z: a * A.z + b * B.z + c * C.z,
        });
        row.push(addVertex(p));
      }
      grid.push(row);
    }

    // Emit triangles. Each row i forms (N-i) "upward" triangles and (N-i-1)
    // "downward" triangles with row i+1.
    for (let i = 0; i < N; i++) {
      const rowLen = N - i;
      for (let j = 0; j < rowLen; j++) {
        // Upward triangle: (i,j) (i,j+1) (i+1,j)
        newFaces.push([grid[i]![j]!, grid[i]![j + 1]!, grid[i + 1]![j]!]);
      }
      for (let j = 0; j < rowLen - 1; j++) {
        // Downward triangle: (i,j+1) (i+1,j+1) (i+1,j)
        newFaces.push([
          grid[i]![j + 1]!,
          grid[i + 1]![j + 1]!,
          grid[i + 1]![j]!,
        ]);
      }
    }
  }

  return { vertices: newVertices, faces: newFaces };
}

// ─── Dual (Goldberg from geodesic) ─────────────────────────────────

/**
 * Build the dual polyhedron: each vertex of the input becomes a face,
 * each face becomes a vertex. The dual of a geodesic (triangular)
 * polyhedron is a Goldberg polyhedron (pentagons + hexagons).
 *
 * Construction:
 *   1. For each face F of the input, compute its centroid (projected
 *      back onto the sphere) — these are the dual's vertices.
 *   2. For each vertex V of the input, find every face that contains V.
 *      Those faces' centroids form the dual face around V. The face is
 *      a pentagon if 5 faces meet at V, a hexagon if 6 do.
 *   3. Order the dual face's vertices angularly around V's normal so the
 *      polygon winds correctly (CCW from outside).
 */
export function dual(mesh: Mesh): Mesh {
  // Step 1: dual vertices = original face centroids (projected to sphere)
  const dualVerts: Vec3[] = mesh.faces.map((f) => {
    const ps = f.map((i) => mesh.vertices[i]!);
    return normalize(centroid(ps));
  });

  // Step 2: build vertex → face adjacency. For each input vertex, list the
  // face indices that contain it.
  const vertexFaces: number[][] = mesh.vertices.map(() => []);
  mesh.faces.forEach((face, faceIdx) => {
    for (const vi of face) vertexFaces[vi]!.push(faceIdx);
  });

  // Step 3: for each input vertex, order its surrounding faces angularly.
  // Use the vertex's outward normal as the "up" axis; project each face
  // centroid onto the tangent plane and compute its angle.
  const dualFaces: number[][] = mesh.vertices.map((V, vi) => {
    const faces = vertexFaces[vi]!;
    if (faces.length < 3) return []; // degenerate, skip
    const normal = normalize(V);
    // Build an orthonormal frame (tangent, bitangent) on the plane perpendicular
    // to `normal`. Use Gram-Schmidt against an arbitrary non-parallel axis.
    const axis = Math.abs(normal.x) > 0.9 ? v3(0, 1, 0) : v3(1, 0, 0);
    const tangent = normalize(cross(normal, axis));
    const bitangent = cross(normal, tangent);

    // For each face centroid (in dual coords), project to tangent plane,
    // compute angle.
    const angled = faces.map((faceIdx) => {
      const c = dualVerts[faceIdx]!;
      // Vector from V to c on the unit sphere.
      const d = sub(c, V);
      const u = dot(d, tangent);
      const w = dot(d, bitangent);
      return { faceIdx, angle: Math.atan2(w, u) };
    });
    angled.sort((a, b) => a.angle - b.angle);
    return angled.map((a) => a.faceIdx);
  });

  return { vertices: dualVerts, faces: dualFaces.filter((f) => f.length >= 3) };
}

// ─── Composite constructors ───────────────────────────────────────

/** Frequency-N geodesic icosphere (all triangles). */
export function geodesic(frequency: number): Mesh {
  return geodesicSubdivide(icosahedron(), frequency);
}

/**
 * Goldberg polyhedron GP(m, 0) for now (class I — straightforward dual
 * of frequency-m geodesic).
 *
 * Face counts:
 *   GP(1,0) = dodecahedron, 12 pentagons.
 *   GP(2,0) = 12 pentagons + 30 hexagons = 42 faces.
 *   GP(3,0) = 12 pentagons + 80 hexagons = 92 faces.
 *   GP(4,0) = 12 pentagons + 150 hexagons = 162 faces.
 */
export function goldbergClassI(frequency: number): Mesh {
  return dual(geodesic(frequency));
}

// ─── Stats helper (for UI display) ────────────────────────────────

export interface MeshStats {
  vertices: number;
  faces: number;
  faceShapeCounts: Record<number, number>;
}

export function meshStats(mesh: Mesh): MeshStats {
  const shapeCounts: Record<number, number> = {};
  for (const f of mesh.faces) {
    shapeCounts[f.length] = (shapeCounts[f.length] ?? 0) + 1;
  }
  return {
    vertices: mesh.vertices.length,
    faces: mesh.faces.length,
    faceShapeCounts: shapeCounts,
  };
}
