import { db } from "@/lib/db";
import { places, comments, users } from "@/lib/schema/rest-rant";
import { eq, asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { serializePlace, serializeComment } from "@/lib/rest-rant";

function parseId(raw: string) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ placeId: string }> },
) {
  const { placeId } = await params;
  const id = parseId(placeId);
  if (id === null) {
    return NextResponse.json(
      { message: `Invalid id "${placeId}"` },
      { status: 404 },
    );
  }
  const [place] = await db.select().from(places).where(eq(places.id, id));
  if (!place) {
    return NextResponse.json(
      { message: `Could not find place with id "${id}"` },
      { status: 404 },
    );
  }
  const commentRows = await db
    .select({ comment: comments, author: users })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.placeId, id))
    .orderBy(asc(comments.createdAt));
  return NextResponse.json({
    ...serializePlace(place),
    comments: commentRows.map((r) => serializeComment(r.comment, r.author)),
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ placeId: string }> },
) {
  const { placeId } = await params;
  const id = parseId(placeId);
  if (id === null) {
    return NextResponse.json(
      { message: `Invalid id "${placeId}"` },
      { status: 404 },
    );
  }
  const body = (await request.json()) as Partial<{
    name: string;
    city: string;
    state: string;
    cuisines: string;
    pic: string;
    founded: number | null;
  }>;
  const patch: Record<string, string | number | null> = {};
  if (body.name !== undefined) patch.name = body.name.slice(0, 200);
  if (body.city !== undefined) patch.city = body.city.slice(0, 100);
  if (body.state !== undefined) patch.state = body.state.slice(0, 50);
  if (body.cuisines !== undefined) patch.cuisines = body.cuisines.slice(0, 200);
  if (body.pic !== undefined) patch.pic = body.pic.slice(0, 500);
  if (body.founded !== undefined)
    patch.founded =
      typeof body.founded === "number" && body.founded > 0
        ? body.founded
        : null;
  if (Object.keys(patch).length === 0) {
    const [place] = await db.select().from(places).where(eq(places.id, id));
    if (!place) {
      return NextResponse.json(
        { message: `Could not find place with id "${id}"` },
        { status: 404 },
      );
    }
    return NextResponse.json(serializePlace(place));
  }
  const [updated] = await db
    .update(places)
    .set(patch)
    .where(eq(places.id, id))
    .returning();
  if (!updated) {
    return NextResponse.json(
      { message: `Could not find place with id "${id}"` },
      { status: 404 },
    );
  }
  return NextResponse.json(serializePlace(updated));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ placeId: string }> },
) {
  const { placeId } = await params;
  const id = parseId(placeId);
  if (id === null) {
    return NextResponse.json(
      { message: `Invalid id "${placeId}"` },
      { status: 404 },
    );
  }
  const [deleted] = await db
    .delete(places)
    .where(eq(places.id, id))
    .returning();
  if (!deleted) {
    return NextResponse.json(
      { message: `Could not find place with id "${id}"` },
      { status: 404 },
    );
  }
  return NextResponse.json(serializePlace(deleted));
}
