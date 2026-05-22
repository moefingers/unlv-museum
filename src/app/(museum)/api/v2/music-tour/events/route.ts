/**
 * /api/v2/music-tour/events — Enhanced tier.
 *
 * Re-exports POST from v1 (audit tier auto-detected as "enhanced").
 * Adds `?names=A,B,C` batch read returning each event with its full
 * meet_greets / set_times / stages joins.
 */

import { db } from "@/lib/db";
import {
  bands,
  events,
  meetGreets,
  setTimes,
  stageEvents,
  stages,
} from "@/lib/schema/music-tour";
import { asc, eq, ilike, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export { POST } from "../../../music-tour/events/route";

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
        const [event] = await db
          .select()
          .from(events)
          .where(eq(events.name, name));
        if (!event) return null;
        const meetGreetRows = await db
          .select({
            meetGreetId: meetGreets.meetGreetId,
            meetStartTime: meetGreets.meetStartTime,
            meetEndTime: meetGreets.meetEndTime,
            band: bands,
          })
          .from(meetGreets)
          .innerJoin(bands, eq(meetGreets.bandId, bands.bandId))
          .where(eq(meetGreets.eventId, event.eventId));
        const setTimeRows = await db
          .select({
            setTimeId: setTimes.setTimeId,
            startTime: setTimes.startTime,
            endTime: setTimes.endTime,
            band: bands,
            stage: stages,
          })
          .from(setTimes)
          .innerJoin(bands, eq(setTimes.bandId, bands.bandId))
          .innerJoin(stages, eq(setTimes.stageId, stages.stageId))
          .where(eq(setTimes.eventId, event.eventId));
        const stageRows = await db
          .select({ stage: stages })
          .from(stageEvents)
          .innerJoin(stages, eq(stageEvents.stageId, stages.stageId))
          .where(eq(stageEvents.eventId, event.eventId));
        return {
          ...event,
          meet_greets: meetGreetRows.map((r) => ({
            meet_greet_id: r.meetGreetId,
            meet_start_time: r.meetStartTime,
            meet_end_time: r.meetEndTime,
            bands: r.band,
          })),
          set_times: setTimeRows.map((r) => ({
            set_time_id: r.setTimeId,
            start_time: r.startTime,
            end_time: r.endTime,
            bands: r.band,
            stages: r.stage,
          })),
          stages: stageRows.map((r) => r.stage),
        };
      }),
    );
    return NextResponse.json(results.filter((r) => r !== null));
  }

  const nameFilter = url.searchParams.get("name") ?? "";
  const rows = await db
    .select()
    .from(events)
    .where(nameFilter ? ilike(events.name, `%${nameFilter}%`) : sql`true`)
    .orderBy(asc(events.date));
  return NextResponse.json(rows);
}
