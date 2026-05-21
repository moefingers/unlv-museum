import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { books } from "../_schema";

/**
 * Mirrors original Express POST /addBook from server.js. The original
 * required title + quantity + description in the body and returned 400
 * with a specific error string for each missing field; we preserve those
 * messages so the frontend's expected validation messaging keeps working.
 */
export async function POST(request: Request) {
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
        message:
          "'title' is required in the request body when calling 'addBook'. Make sure you're stringifying the body of your request, and sending the appropriate headers.",
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
        message:
          "'quantity' is required in the request body when calling 'addBook'. Make sure you're stringifying the body of your request, and sending the appropriate headers.",
      },
      { status: 400 },
    );
  }
  if (!body.description) {
    return NextResponse.json(
      {
        error: true,
        message:
          "'description' is required in the request body when calling 'addBook'. Make sure you're stringifying the body of your request, and sending the appropriate headers.",
      },
      { status: 400 },
    );
  }

  const quantityNum =
    typeof body.quantity === "string"
      ? parseInt(body.quantity, 10) || 0
      : body.quantity;

  const [book] = await db
    .insert(books)
    .values({
      title: body.title.slice(0, 200),
      description: body.description.slice(0, 500),
      year: body.year?.slice(0, 10) ?? null,
      quantity: quantityNum,
      imageUrl: body.imageURL?.slice(0, 500) ?? null,
    })
    .returning();

  // Rename `imageUrl` → `imageURL` on the wire to match the source's
  // db.json shape. No synthesis: if the visitor didn't pass an imageURL,
  // the field comes back null — same as the source returned for any row
  // that didn't have one set in db.json.
  const { imageUrl, ...rest } = book!;
  return NextResponse.json({
    ...rest,
    imageURL: imageUrl,
  });
}
