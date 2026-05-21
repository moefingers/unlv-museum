import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { books } from "../_schema";

/**
 * Mirrors original Express PATCH /updateBook from server.js — id arrives
 * in the request body (NOT the URL), other fields merge with the existing
 * row.
 */
export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    id?: number;
    title?: string;
    description?: string;
    year?: string;
    quantity?: number | string;
    imageURL?: string;
  };

  if (!body.id) {
    return NextResponse.json(
      {
        error: true,
        message:
          "'id' is required in the request body when calling 'updateBook'. Make sure you're stringifying the body of your request, and sending the appropriate headers.",
      },
      { status: 400 },
    );
  }

  const [existing] = await db.select().from(books).where(eq(books.id, body.id));
  if (!existing) {
    return NextResponse.json(
      {
        error: true,
        message: `Could not find a book with an id of ${body.id}`,
      },
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
    .where(eq(books.id, body.id))
    .returning();

  // Rename `imageUrl` → `imageURL` on the wire to match the source's
  // db.json shape. No fallback — source returned whatever was in the
  // row, null included.
  const { imageUrl, ...rest } = updated!;
  return NextResponse.json({
    ...rest,
    imageURL: imageUrl,
  });
}
