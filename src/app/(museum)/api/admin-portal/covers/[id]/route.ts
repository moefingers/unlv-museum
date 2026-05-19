/**
 * Placeholder book-cover endpoint.
 *
 *   GET /api/admin-portal/covers/<id>
 *
 * Looks up the book by id, renders a deterministic SVG cover seeded by
 * the row's id, and serves it inline. The cover always reflects the
 * book's current title/year, so an in-place title rename swaps the
 * cover art on next paint.
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { books } from "../../_schema";
import { renderBookCover } from "@/lib/book-cover-svg";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const idNum = Number.parseInt(id, 10);
  if (!Number.isFinite(idNum)) {
    return new Response(`Invalid book id: ${id}`, { status: 400 });
  }

  const [book] = await db.select().from(books).where(eq(books.id, idNum));
  if (!book) {
    return new Response(`No book with id ${idNum}`, { status: 404 });
  }

  const svg = renderBookCover({
    seed: String(book.id),
    title: book.title,
    year: book.year,
  });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control":
        "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
