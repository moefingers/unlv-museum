/**
 * /api/v2/admin-portal/low-stock — Enhanced-tier inventory report.
 *
 *   GET /low-stock?threshold=<n>
 *
 * Returns books whose `quantity` is at or below the threshold (default 5),
 * sorted by quantity ascending (lowest stock first). v1 only exposed a
 * full list — visitors had to filter client-side, which made the original
 * admin UI slower with large catalogs.
 *
 * Read-only, no sign-in required. The point is operational visibility:
 * an inventory manager could poll this on a cron to surface restock alerts
 * without pulling the whole catalog.
 */

import { db } from "@/lib/db";
import { books } from "../../../admin-portal/_schema";
import { asc, lte } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const thresholdParam = url.searchParams.get("threshold");
  // parseInt("0") is 0 (falsy) so use explicit checks; clamp negatives to 0.
  const parsed = thresholdParam !== null ? parseInt(thresholdParam, 10) : 5;
  const threshold = Number.isNaN(parsed) ? 5 : Math.max(0, parsed);

  const rows = await db
    .select()
    .from(books)
    .where(lte(books.quantity, threshold))
    .orderBy(asc(books.quantity), asc(books.title));

  const wireRows = rows.map(({ imageUrl, ...rest }) => ({
    ...rest,
    imageURL: imageUrl,
  }));

  return NextResponse.json({
    threshold,
    count: wireRows.length,
    rows: wireRows,
  });
}
