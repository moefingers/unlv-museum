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

const jaskisSchema = pgSchema("rest_rant");

const spots = jaskisSchema.table("places", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  cuisine: text("cuisine").notNull(),
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
  const spotId = parseInt(id, 10);
  if (isNaN(spotId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const [spot] = await db.select().from(spots).where(eq(spots.id, spotId));
  if (!spot) {
    return NextResponse.json({ error: "Spot not found" }, { status: 404 });
  }

  return NextResponse.json(spot);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const spotId = parseInt(id, 10);
  if (isNaN(spotId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = (await request.json()) as {
    name?: string;
    city?: string;
    state?: string;
    cuisine?: string;
  };

  const [updated] = await db
    .update(spots)
    .set({
      ...(body.name && { name: body.name.slice(0, 100) }),
      ...(body.city && { city: body.city.slice(0, 50) }),
      ...(body.state && { state: body.state.slice(0, 2) }),
      ...(body.cuisine && { cuisine: body.cuisine.slice(0, 50) }),
    })
    .where(eq(spots.id, spotId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Spot not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const spotId = parseInt(id, 10);
  if (isNaN(spotId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const [deleted] = await db
    .delete(spots)
    .where(eq(spots.id, spotId))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Spot not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Deleted", spot: deleted });
}
