/**
 * /api/v2/music-tour/bands — Enhanced tier.
 *
 * Re-exports v1's handlers for the source-faithful surface. The guard's
 * URL-prefix sniffing (api-guard.ts → tierFromUrl) means audit rows
 * written by these handlers record `tier="enhanced"` automatically when
 * the request lands at /api/v2/*.
 *
 * v2-only addition: `?names=A,B,C` batch read returns an array of full
 * band-with-joins responses in a single request. The single-name
 * lookup `GET /api/v2/music-tour/bands/Coldplay` still works via
 * `./[idOrName]/route.ts` (also re-exported from v1).
 */

import { db } from "@/lib/db";
import {
  auditLog,
  bands,
  events,
  meetGreets,
  setTimes,
} from "@/lib/schema/music-tour";
import { and, asc, eq, ilike, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/api-guard";
import { writeAuditEntry } from "@/lib/audit";

// Re-export POST from v1 — guard auto-records tier="enhanced" because
// the request URL starts with /api/v2/.
export { POST } from "../../../music-tour/bands/route";

/**
 * v2 GET — adds `?names=A,B,C` batch read (returns array of bands
 * with their full meet_greets + set_times join chains). The classic
 * `?name=<like>` filter still works when no `names` is passed.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const namesParam = url.searchParams.get("names");

  if (namesParam) {
    const names = namesParam
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length === 0) return NextResponse.json([]);

    // For each name, run the same eager-join query the by-name single
    // lookup does. Done in parallel for throughput.
    const results = await Promise.all(
      names.map(async (name) => {
        const [band] = await db
          .select()
          .from(bands)
          .where(eq(bands.name, name));
        if (!band) return null;
        const meetGreetRows = await db
          .select({
            meetGreetId: meetGreets.meetGreetId,
            meetStartTime: meetGreets.meetStartTime,
            meetEndTime: meetGreets.meetEndTime,
            event: events,
          })
          .from(meetGreets)
          .innerJoin(events, eq(meetGreets.eventId, events.eventId))
          .where(eq(meetGreets.bandId, band.bandId))
          .orderBy(events.date);
        const setTimeRows = await db
          .select({
            setTimeId: setTimes.setTimeId,
            startTime: setTimes.startTime,
            endTime: setTimes.endTime,
            event: events,
          })
          .from(setTimes)
          .innerJoin(events, eq(setTimes.eventId, events.eventId))
          .where(eq(setTimes.bandId, band.bandId))
          .orderBy(events.date);
        return {
          ...band,
          meet_greets: meetGreetRows.map((r) => ({
            meet_greet_id: r.meetGreetId,
            meet_start_time: r.meetStartTime,
            meet_end_time: r.meetEndTime,
            events: r.event,
          })),
          set_times: setTimeRows.map((r) => ({
            set_time_id: r.setTimeId,
            start_time: r.startTime,
            end_time: r.endTime,
            events: r.event,
          })),
        };
      }),
    );
    // Filter out nulls (names that didn't match a band) — visitors get
    // the bands that exist, in the order they requested them.
    return NextResponse.json(results.filter((r) => r !== null));
  }

  // No names= → behave exactly like v1's list endpoint.
  const nameFilter = url.searchParams.get("name") ?? "";
  const rows = await db
    .select()
    .from(bands)
    .where(nameFilter ? ilike(bands.name, `%${nameFilter}%`) : sql`true`)
    .orderBy(asc(bands.availableStartTime));
  return NextResponse.json(rows);
}

// Silence unused-import warnings (these are pulled in for type alignment
// with the v1 routes' joins above; tree-shaken in production).
void auditLog;
void guardMutation;
void writeAuditEntry;
void and;
