/**
 * /api/v2/rest-rant/search — Enhanced-tier search across places.
 *
 *   GET /search?q=<term>&limit=<n>
 *
 * Searches `places.name`, `places.city`, and `places.cuisines` in
 * parallel, case-insensitive substring match. v1 only had GET /places
 * which returned everything; v2 lets visitors find restaurants without
 * scanning the full list.
 *
 * Scope: places only. Users + comments are intentionally NOT searchable
 * — user search would surface email addresses of museum visitors who
 * created project-level accounts, and comment-content search is a
 * different kind of full-text problem (post-MVP if visitors ask).
 *
 * Read-only, no sign-in required.
 */

import { db } from "@/lib/db";
import { places } from "@/lib/schema/rest-rant";
import { asc, ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { serializePlace } from "@/lib/rest-rant";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20),
  );

  if (!q) {
    return NextResponse.json({ query: "", count: 0, rows: [] });
  }
  const pattern = `%${q}%`;

  const rows = await db
    .select()
    .from(places)
    .where(
      or(
        ilike(places.name, pattern),
        ilike(places.city, pattern),
        ilike(places.cuisines, pattern),
      ),
    )
    .orderBy(asc(places.name))
    .limit(limit);

  return NextResponse.json({
    query: q,
    count: rows.length,
    rows: rows.map(serializePlace),
  });
}
