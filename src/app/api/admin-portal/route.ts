import { db } from "@/lib/db";
import {
  pgSchema,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { desc } from "drizzle-orm";
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

export async function GET() {
  const allBooks = await db.select().from(books).orderBy(desc(books.createdAt));
  return NextResponse.json(allBooks);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    title?: string;
    description?: string;
    year?: string;
    quantity?: number;
  };

  if (!body.title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const [book] = await db
    .insert(books)
    .values({
      title: body.title.slice(0, 200),
      description: body.description?.slice(0, 500) ?? null,
      year: body.year?.slice(0, 10) ?? null,
      quantity: body.quantity ?? 0,
    })
    .returning();

  return NextResponse.json(book, { status: 201 });
}
