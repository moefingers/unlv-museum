import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { books } from "../_schema";

/**
 * Wire shape matches the original Express server (capital `imageURL`). The
 * frontend's admin.js reads `book.imageURL` and skips rendering the <img>
 * when it's falsy — and editBook() then crashes because the image element
 * doesn't exist. The drizzle column is `imageUrl`; we rename at the boundary.
 *
 * When a book has no stored imageUrl, we synthesize a deterministic
 * placeholder cover URL pointing at /api/admin-portal/covers/<id>. That
 * keeps the original frontend (which has a latent crash on imageless
 * books) working as-is without seeding image URLs into the database.
 */
export async function GET() {
  const all = await db.select().from(books).orderBy(desc(books.createdAt));
  return NextResponse.json(
    all.map(({ imageUrl, ...rest }) => ({
      ...rest,
      imageURL: imageUrl ?? `/api/admin-portal/covers/${rest.id}`,
    })),
  );
}
