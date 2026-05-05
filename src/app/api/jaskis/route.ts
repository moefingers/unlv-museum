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

export async function GET() {
  const allSpots = await db.select().from(spots).orderBy(desc(spots.createdAt));
  return NextResponse.json(allSpots);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    city?: string;
    state?: string;
    cuisine?: string;
  };

  if (!body.name || !body.city || !body.state || !body.cuisine) {
    return NextResponse.json(
      { error: "name, city, state, and cuisine are required" },
      { status: 400 },
    );
  }

  const [spot] = await db
    .insert(spots)
    .values({
      name: body.name.slice(0, 100),
      city: body.city.slice(0, 50),
      state: body.state.slice(0, 2),
      cuisine: body.cuisine.slice(0, 50),
    })
    .returning();

  return NextResponse.json(spot, { status: 201 });
}
