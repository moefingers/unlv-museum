import { db } from "@/lib/db";
import { places, reviews } from "@/lib/schema/rest-rant";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const placeId = parseInt(id, 10);
  if (isNaN(placeId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const [place] = await db.select().from(places).where(eq(places.id, placeId));

  if (!place) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const placeReviews = await db
    .select()
    .from(reviews)
    .where(eq(reviews.placeId, placeId))
    .orderBy(desc(reviews.createdAt));

  return NextResponse.json({ ...place, reviews: placeReviews });
}
