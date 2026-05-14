import { db } from "@/lib/db";
import { bands, events } from "@/lib/schema/music-tour";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bandId = parseInt(id, 10);
  if (isNaN(bandId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const [band] = await db.select().from(bands).where(eq(bands.id, bandId));
  if (!band) {
    return NextResponse.json({ error: "Band not found" }, { status: 404 });
  }

  const bandEvents = await db
    .select()
    .from(events)
    .where(eq(events.bandId, bandId))
    .orderBy(desc(events.date));

  return NextResponse.json({ ...band, events: bandEvents });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bandId = parseInt(id, 10);
  if (isNaN(bandId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const [deleted] = await db
    .delete(bands)
    .where(eq(bands.id, bandId))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Band not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Deleted", band: deleted });
}
