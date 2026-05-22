import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { guardMutation } from "@/lib/api-guard";
import { writeAuditEntry } from "@/lib/audit";
import { books, auditLog } from "../../_schema";

/**
 * Mirrors original Express DELETE /removeBook/:id from server.js — id
 * comes from the URL.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardMutation(request);
  if (guard.response) return guard.response;

  const { id } = await params;
  const bookId = parseInt(id, 10);
  if (Number.isNaN(bookId)) {
    return NextResponse.json(
      {
        error: true,
        message:
          "'id' is required in the request body when calling 'updateBook'. Make sure you're stringifying the body of your request, and sending the appropriate headers.",
      },
      { status: 400 },
    );
  }

  const [deleted] = await db
    .delete(books)
    .where(eq(books.id, bookId))
    .returning();

  if (!deleted) {
    return NextResponse.json(
      {
        error: true,
        message: `Could not find a book with an id of ${bookId}`,
      },
      { status: 404 },
    );
  }

  await writeAuditEntry(
    {
      auditLogTable: auditLog,
      tier: guard.tier,
      actor: guard.actor,
    },
    {
      collection: "books",
      op: "deleteOne",
      before: deleted,
      after: null,
    },
  );

  return NextResponse.json(deleted);
}
