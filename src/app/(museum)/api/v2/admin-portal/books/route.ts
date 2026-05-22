/**
 * /api/v2/admin-portal/books — Enhanced-tier REST alias for the original
 * verb-prefixed `/listBooks` + `/addBook` routes.
 *
 *   GET  /books           → list (same response shape as v1's listBooks)
 *   POST /books           → create (same body + response shape as v1's addBook)
 *
 * v2 reuses v1's logic by re-exporting the POST handler — the guard's
 * URL-prefix sniffing (tierFromUrl in api-guard.ts) auto-records audit
 * rows with tier="enhanced" when the request hits /api/v2/*.
 *
 * GET is a thin re-implementation because v2 also supports query-string
 * filters that v1 doesn't:
 *   - `?ids=1,2,3` → batch read of specific book ids
 *   - `?sort=title|year|quantity|createdAt` (default: createdAt desc)
 *   - `?order=asc|desc` (default: desc for createdAt, asc otherwise)
 *   - `?limit=N` (1..200, default 100)
 *
 * Bare `GET /books` with no params behaves exactly like `GET /listBooks`.
 */

import { db } from "@/lib/db";
import { books } from "../../../admin-portal/_schema";
import { asc, desc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

// Re-export v1's addBook POST — guard auto-records tier="enhanced".
export { POST } from "../../../admin-portal/addBook/route";

type SortColumn = "title" | "year" | "quantity" | "createdAt";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids");
  const sortParam = (url.searchParams.get("sort") ?? "createdAt") as SortColumn;
  const orderParam = url.searchParams.get("order");
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(
    200,
    Math.max(1, parseInt(limitParam ?? "100", 10) || 100),
  );

  const sortCol =
    sortParam === "title"
      ? books.title
      : sortParam === "year"
        ? books.year
        : sortParam === "quantity"
          ? books.quantity
          : books.createdAt;
  // createdAt defaults to desc (newest first) — every other column
  // defaults to asc (a–z, low–high).
  const defaultDesc = sortParam === "createdAt";
  const isDesc = orderParam === "desc" || (orderParam === null && defaultDesc);
  const orderBy = isDesc ? desc(sortCol) : asc(sortCol);

  let rows;
  if (idsParam) {
    const ids = idsParam
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n));
    if (ids.length === 0) return NextResponse.json([]);
    rows = await db
      .select()
      .from(books)
      .where(inArray(books.id, ids))
      .orderBy(orderBy)
      .limit(limit);
  } else {
    rows = await db.select().from(books).orderBy(orderBy).limit(limit);
  }

  // Same wire-shape rename as v1's listBooks: imageUrl → imageURL.
  return NextResponse.json(
    rows.map(({ imageUrl, ...rest }) => ({
      ...rest,
      imageURL: imageUrl,
    })),
  );
}
