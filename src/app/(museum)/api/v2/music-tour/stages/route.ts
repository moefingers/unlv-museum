/**
 * /api/v2/music-tour/stages — Enhanced tier.
 *
 * Re-exports POST from v1. Adds `?names=A,B,C` batch read returning
 * each stage with its joined events.
 */

import { db } from "@/lib/db";
import { events, stageEvents, stages } from "@/lib/schema/music-tour";
import { asc, eq, ilike, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export { POST } from "../../../music-tour/stages/route";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const namesParam = url.searchParams.get("names");

  if (namesParam) {
    const names = namesParam
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length === 0) return NextResponse.json([]);

    const results = await Promise.all(
      names.map(async (name) => {
        const [stage] = await db
          .select()
          .from(stages)
          .where(eq(stages.stageName, name));
        if (!stage) return null;
        const eventRows = await db
          .select({ event: events })
          .from(stageEvents)
          .innerJoin(events, eq(stageEvents.eventId, events.eventId))
          .where(eq(stageEvents.stageId, stage.stageId))
          .orderBy(asc(events.date));
        return { ...stage, events: eventRows.map((r) => r.event) };
      }),
    );
    return NextResponse.json(results.filter((r) => r !== null));
  }

  // Source's stage_name= filter still works.
  const nameFilter = url.searchParams.get("stage_name") ?? "";
  const rows = await db
    .select()
    .from(stages)
    .where(nameFilter ? ilike(stages.stageName, `%${nameFilter}%`) : sql`true`);
  return NextResponse.json(rows);
}
