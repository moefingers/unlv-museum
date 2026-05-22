/**
 * /api/v2/admin-portal/books/[id] — Enhanced-tier REST endpoint for a
 * single book.
 *
 *   GET    /books/:id     → fetch one
 *   PATCH  /books/:id     → update (id in URL, NOT in body — REST convention)
 *   DELETE /books/:id     → delete
 *
 * v1's PATCH /updateBook takes the id in the request body (Express-era
 * idiosyncrasy). v2's REST shape moves it to the URL where it belongs.
 * Apart from that the handlers behave identically to the v1 routes —
 * same validation, same wire shape (imageURL renamed), same audit rows.
 *
 * The DELETE handler is a re-export of v1's `/removeBook/[id]` because
 * its URL signature already matches the REST shape; the only museum-era
 * difference is the path prefix.
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { guardMutation } from "@/lib/api-guard";
import { writeAuditEntry } from "@/lib/audit";
import { books, auditLog } from "../../../../admin-portal/_schema";

// DELETE — v1's removeBook/[id] already takes id in the URL, so its
// signature aligns with REST. Re-export so tier="enhanced" is recorded
// automatically when hit at /api/v2/*.
export { DELETE } from "../../../../admin-portal/removeBook/[id]/route";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bookId = parseInt(id, 10);
  if (Number.isNaN(bookId)) {
    return NextResponse.json(
      { error: true, message: `'${id}' is not a valid book id` },
      { status: 400 },
    );
  }
  const [row] = await db.select().from(books).where(eq(books.id, bookId));
  if (!row) {
    return NextResponse.json(
      { error: true, message: `Could not find a book with an id of ${bookId}` },
      { status: 404 },
    );
  }
  const { imageUrl, ...rest } = row;
  return NextResponse.json({ ...rest, imageURL: imageUrl });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardMutation(request);
  if (guard.response) return guard.response;

  const { id } = await params;
  const bookId = parseInt(id, 10);
  if (Number.isNaN(bookId)) {
    return NextResponse.json(
      { error: true, message: `'${id}' is not a valid book id` },
      { status: 400 },
    );
  }

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    year?: string;
    quantity?: number | string;
    imageURL?: string;
  };

  const [existing] = await db.select().from(books).where(eq(books.id, bookId));
  if (!existing) {
    return NextResponse.json(
      { error: true, message: `Could not find a book with an id of ${bookId}` },
      { status: 404 },
    );
  }

  const quantityNum =
    body.quantity === undefined || body.quantity === null
      ? undefined
      : typeof body.quantity === "string"
        ? parseInt(body.quantity, 10)
        : body.quantity;

  const [updated] = await db
    .update(books)
    .set({
      ...(body.title !== undefined && { title: body.title.slice(0, 200) }),
      ...(body.description !== undefined && {
        description: body.description.slice(0, 500),
      }),
      ...(body.year !== undefined && { year: body.year.slice(0, 10) }),
      ...(quantityNum !== undefined &&
        !Number.isNaN(quantityNum) && { quantity: quantityNum }),
      ...(body.imageURL !== undefined && {
        imageUrl: body.imageURL.slice(0, 500),
      }),
    })
    .where(eq(books.id, bookId))
    .returning();

  await writeAuditEntry(
    {
      auditLogTable: auditLog,
      tier: guard.tier,
      actor: guard.actor,
    },
    {
      collection: "books",
      op: "updateOne",
      before: existing,
      after: updated,
    },
  );

  const { imageUrl, ...rest } = updated!;
  return NextResponse.json({ ...rest, imageURL: imageUrl });
}
