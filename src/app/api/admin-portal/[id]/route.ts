import { db } from "@/lib/db";
import {
  pgSchema,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const schema = pgSchema("admin_portal");
const books = schema.table("books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  year: text("year"),
  quantity: integer("quantity").default(0),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bookId = parseInt(id, 10);
  if (isNaN(bookId))
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const [book] = await db.select().from(books).where(eq(books.id, bookId));
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(book);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bookId = parseInt(id, 10);
  if (isNaN(bookId))
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    year?: string;
    quantity?: number;
  };

  const [updated] = await db
    .update(books)
    .set({
      ...(body.title && { title: body.title.slice(0, 200) }),
      ...(body.description && { description: body.description.slice(0, 500) }),
      ...(body.year && { year: body.year.slice(0, 10) }),
      ...(body.quantity !== undefined && { quantity: body.quantity }),
    })
    .where(eq(books.id, bookId))
    .returning();

  if (!updated)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bookId = parseInt(id, 10);
  if (isNaN(bookId))
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const [deleted] = await db
    .delete(books)
    .where(eq(books.id, bookId))
    .returning();

  if (!deleted)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ message: "Deleted", book: deleted });
}
