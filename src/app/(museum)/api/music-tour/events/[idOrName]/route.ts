/**
 * Music Tour API — single-event ops.
 *
 *   GET    /api/music-tour/events/:name     (param = event NAME)
 *   PUT    /api/music-tour/events/:id       (param = integer event_id)
 *   DELETE /api/music-tour/events/:id       (param = integer event_id)
 *
 * GET returns the event with its nested associations: meet_greets (with
 * the related band), set_times (with the related band + stage), and the
 * stages it's at (M:M via stage_events). Mirrors the source's
 * include chain in `events_controller.js`.
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
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ idOrName: string }>;
}

export async function GET(_request: Request, ctx: RouteContext) {
  const { idOrName } = await ctx.params;
  try {
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.name, idOrName));
    if (!event) {
      return NextResponse.json(null);
    }

    // meet_greets with band attached
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

    // set_times with band + stage attached
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

    // M:M stages through stage_events
    const stageRows = await db
      .select({ stage: stages })
      .from(stageEvents)
      .innerJoin(stages, eq(stageEvents.stageId, stages.stageId))
      .where(eq(stageEvents.eventId, event.eventId));

    return NextResponse.json({
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
    });
  } catch (error) {
    return NextResponse.json("failed to GET /events/:name " + String(error), {
      status: 500,
    });
  }
}

export async function PUT(request: Request, ctx: RouteContext) {
  const { idOrName } = await ctx.params;
  const eventId = parseInt(idOrName, 10);
  if (isNaN(eventId)) {
    return NextResponse.json(
      "failed to PUT /events/:id — id must be an integer (got '" +
        idOrName +
        "')",
      { status: 500 },
    );
  }
  try {
    const body = (await request.json()) as Partial<{
      name: string;
      date: string;
      startTime: string;
      endTime: string;
    }>;
    const set: Record<string, unknown> = {};
    if (body.name !== undefined) set.name = body.name.slice(0, 200);
    if (body.date !== undefined) set.date = new Date(body.date);
    if (body.startTime !== undefined) set.startTime = new Date(body.startTime);
    if (body.endTime !== undefined) set.endTime = new Date(body.endTime);

    const updated = Object.keys(set).length
      ? await db
          .update(events)
          .set(set)
          .where(eq(events.eventId, eventId))
          .returning()
      : [];

    return NextResponse.json({
      message: `Successfully updated ${updated.length} event(s)`,
    });
  } catch (error) {
    return NextResponse.json("failed to PUT /events/:id " + String(error), {
      status: 500,
    });
  }
}

export async function DELETE(_request: Request, ctx: RouteContext) {
  const { idOrName } = await ctx.params;
  const eventId = parseInt(idOrName, 10);
  if (isNaN(eventId)) {
    return NextResponse.json(
      "failed to DELETE /events/:id — id must be an integer (got '" +
        idOrName +
        "')",
      { status: 500 },
    );
  }
  try {
    const deleted = await db
      .delete(events)
      .where(eq(events.eventId, eventId))
      .returning();
    return NextResponse.json({
      message: `Successfully deleted ${deleted.length} event(s)`,
    });
  } catch (error) {
    return NextResponse.json("failed to DELETE /events/:id " + String(error), {
      status: 500,
    });
  }
}
