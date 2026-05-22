/**
 * /api/v2/admin-portal/books — Enhanced-tier REST alias for the original
 * verb-prefixed `/listBooks` + `/addBook` routes.
 *
 *   GET  /books           → list (same response shape as v1's listBooks)
 *   POST /books           → create (same body shape as v1's addBook,
 *                          with one Enhanced-only behavior: a missing
 *                          imageURL is auto-synthesized to point at
 *                          /api/v2/admin-portal/cover/<newId>)
 *
 * GET is a thin re-implementation because v2 also supports query-string
 * filters that v1 doesn't:
 *   - `?ids=1,2,3` → batch read of specific book ids
 *   - `?sort=title|year|quantity|createdAt` (default: createdAt desc)
 *   - `?order=asc|desc` (default: desc for createdAt, asc otherwise)
 *   - `?limit=N` (1..200, default 100)
 *
 * Bare `GET /books` with no params behaves exactly like `GET /listBooks`.
 *
 * Why POST is NOT a re-export of v1's addBook: the v1 handler
 * intentionally returns `imageURL: null` when none is supplied (Original
 * tier is faithful to the source's db.json shape — no synthesis). v2's
 * Enhanced-tier carve-out synthesizes a deterministic cover URL instead,
 * keyed by the new row's id, so the Replaced UI never shows imageless
 * books. The audit row records the final post-cover state.
 */

import { db } from "@/lib/db";
import { dbTx } from "@/lib/db-tx";
import { books, auditLog } from "../../../admin-portal/_schema";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/api-guard";

/**
 * Compose the deterministic cover URL for a newly-inserted book. The
 * cover endpoint is purely seeded from the id + title + year, so the
 * same book always renders the same cover. Title/year travel as query
 * params so the SVG can use them without an extra DB lookup; the path
 * id is what makes the URL stable per book.
 */
function coverUrlFor(id: number, title: string, year: string | null): string {
  const params = new URLSearchParams();
  params.set("title", title);
  if (year) params.set("year", year);
  return `/api/v2/admin-portal/cover/${id}?${params.toString()}`;
}

export async function POST(request: Request) {
  const guard = await guardMutation(request);
  if (guard.response) return guard.response;

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    year?: string;
    quantity?: number | string;
    imageURL?: string;
  };

  if (!body.title) {
    return NextResponse.json(
      {
        error: true,
        message: "'title' is required in the request body.",
      },
      { status: 400 },
    );
  }
  if (
    body.quantity === undefined ||
    body.quantity === null ||
    body.quantity === ""
  ) {
    return NextResponse.json(
      {
        error: true,
        message: "'quantity' is required in the request body.",
      },
      { status: 400 },
    );
  }
  if (!body.description) {
    return NextResponse.json(
      {
        error: true,
        message: "'description' is required in the request body.",
      },
      { status: 400 },
    );
  }

  const quantityNum =
    typeof body.quantity === "string"
      ? parseInt(body.quantity, 10) || 0
      : body.quantity;
  const title = body.title.slice(0, 200);
  const description = body.description.slice(0, 500);
  const year = body.year?.slice(0, 10) ?? null;
  const userSuppliedImage = body.imageURL?.slice(0, 500) ?? null;

  // Insert + (optionally) auto-cover-update + audit, all atomic.
  // The auto-cover update only fires when the user didn't supply an
  // imageURL — visitors who pass their own URL get the source-faithful
  // behavior on the wire (their URL is what's stored).
  const finalRow = await dbTx.transaction(async (tx) => {
    const [created] = await tx
      .insert(books)
      .values({
        title,
        description,
        year,
        quantity: quantityNum,
        imageUrl: userSuppliedImage,
      })
      .returning();
    if (!created) throw new Error("insert returned no row");

    let row = created;
    if (userSuppliedImage === null) {
      const coverUrl = coverUrlFor(created.id, title, year);
      const [updated] = await tx
        .update(books)
        .set({ imageUrl: coverUrl })
        .where(eq(books.id, created.id))
        .returning();
      if (updated) row = updated;
    }

    // Single audit row reflecting the final post-cover state, so the
    // audit log shows what the visitor actually got back. before=null
    // because the row didn't exist before this transaction.
    await tx.insert(auditLog).values({
      actorId: guard.actor.id,
      actorLogin: guard.actor.login,
      collection: "books",
      op: "insertOne",
      tier: guard.tier,
      before: null,
      after: row as never,
    });

    return row;
  });

  const { imageUrl, ...rest } = finalRow;
  return NextResponse.json({ ...rest, imageURL: imageUrl });
}

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
