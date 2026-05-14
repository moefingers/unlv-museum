import { db } from "@/lib/db";
import { bands } from "@/lib/schema/music-tour";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const allBands = await db.select().from(bands).orderBy(desc(bands.createdAt));
  return NextResponse.json(allBands);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    genre?: string;
    formedYear?: number;
  };

  if (!body.name || !body.genre) {
    return NextResponse.json(
      { error: "name and genre are required" },
      { status: 400 },
    );
  }

  const [band] = await db
    .insert(bands)
    .values({
      name: body.name.slice(0, 100),
      genre: body.genre.slice(0, 50),
      formedYear: body.formedYear ?? null,
    })
    .returning();

  return NextResponse.json(band, { status: 201 });
}
