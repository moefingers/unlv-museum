/**
 * /api/v2/music-tour/search — Enhanced-tier cross-resource search.
 *
 *   GET /search?q=<term>&limit=<n>
 *
 * Searches `bands.name`, `events.name`, and `stages.stage_name` in one
 * shot, case-insensitive substring match. Returns:
 *
 *   { bands: [...], events: [...], stages: [...] }
 *
 * Where each array contains rows from the matching table. Per-table
 * limit defaults to 20 (configurable via `?limit=`).
 *
 * Read-only, no sign-in required. v2 lets visitors do in one request
 * what v1 required three separate calls for.
 */

import { db } from "@/lib/db";
import { bands, events, stages } from "@/lib/schema/music-tour";
import { asc, ilike } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) {
    return NextResponse.json({ bands: [], events: [], stages: [] });
  }
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20),
  );
  const pattern = `%${q}%`;

  const [bandRows, eventRows, stageRows] = await Promise.all([
    db
      .select()
      .from(bands)
      .where(ilike(bands.name, pattern))
      .orderBy(asc(bands.name))
      .limit(limit),
    db
      .select()
      .from(events)
      .where(ilike(events.name, pattern))
      .orderBy(asc(events.date))
      .limit(limit),
    db
      .select()
      .from(stages)
      .where(ilike(stages.stageName, pattern))
      .orderBy(asc(stages.stageName))
      .limit(limit),
  ]);

  return NextResponse.json({
    query: q,
    bands: bandRows,
    events: eventRows,
    stages: stageRows,
  });
}
