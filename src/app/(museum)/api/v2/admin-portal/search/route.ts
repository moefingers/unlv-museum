/**
 * /api/v2/admin-portal/search — Enhanced-tier text search.
 *
 *   GET /search?q=<term>&limit=<n>
 *
 * Searches `books.title` and `books.description` in one shot,
 * case-insensitive substring match. Returns:
 *
 *   { query, count, rows: [...] }
 *
 * Where each row carries the source's wire shape (imageURL renamed,
 * etc. — same as listBooks). Limit defaults to 20.
 *
 * Read-only, no sign-in required. v1 only had listBooks (no filter);
 * v2 lets visitors find a book without scanning the full list.
 */

import { db } from "@/lib/db";
import { books } from "../../../admin-portal/_schema";
import { asc, ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";

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
    .from(books)
    .where(or(ilike(books.title, pattern), ilike(books.description, pattern)))
    .orderBy(asc(books.title))
    .limit(limit);

  const wireRows = rows.map(({ imageUrl, ...rest }) => ({
    ...rest,
    imageURL: imageUrl,
  }));

  return NextResponse.json({
    query: q,
    count: wireRows.length,
    rows: wireRows,
  });
}
