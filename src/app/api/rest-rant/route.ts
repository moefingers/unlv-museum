import { db } from "@/lib/db";
import { places, reviews } from "@/lib/schema/rest-rant";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const allPlaces = await db
    .select()
    .from(places)
    .orderBy(desc(places.createdAt));
  return NextResponse.json(allPlaces);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    action: string;
    placeId?: number;
    name?: string;
    city?: string;
    state?: string;
    cuisine?: string;
    author?: string;
    rating?: number;
    body?: string;
  };

  if (body.action === "addPlace") {
    if (!body.name || !body.city || !body.state || !body.cuisine) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const [place] = await db
      .insert(places)
      .values({
        name: body.name.slice(0, 100),
        city: body.city.slice(0, 50),
        state: body.state.slice(0, 2),
        cuisine: body.cuisine.slice(0, 50),
      })
      .returning();
    return NextResponse.json(place, { status: 201 });
  }

  if (body.action === "addReview") {
    if (!body.placeId || !body.author || !body.rating || !body.body) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const [review] = await db
      .insert(reviews)
      .values({
        placeId: body.placeId,
        author: body.author.slice(0, 50),
        rating: Math.max(1, Math.min(5, body.rating)),
        body: body.body.slice(0, 500),
      })
      .returning();
    return NextResponse.json(review, { status: 201 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
