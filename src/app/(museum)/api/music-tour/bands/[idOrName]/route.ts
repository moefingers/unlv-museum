/**
 * Music Tour API — single-band ops.
 *
 *   GET    /api/music-tour/bands/:name        (param treated as NAME — exact match)
 *   PUT    /api/music-tour/bands/:id          (param treated as INTEGER ID)
 *   DELETE /api/music-tour/bands/:id          (param treated as INTEGER ID)
 *
 * Faithful to the original UNLV exercise's routing quirk: the same URL
 * segment means different things for different methods. `GET /bands/Coldplay`
 * resolves a band by `name`; `PUT /bands/3` resolves by integer `band_id`.
 *
 * The GET response shape includes nested `meet_greets` (with their events)
 * and `set_times` (with their events), exactly matching what the
 * Sequelize `include` chain produced in the source.
 */

import { db } from "@/lib/db";
import {
  auditLog,
  bands,
  events,
  meetGreets,
  setTimes,
} from "@/lib/schema/music-tour";
import { and, eq, ilike } from "drizzle-orm";
import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/api-guard";
import { writeAuditEntry } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ idOrName: string }>;
}

export async function GET(request: Request, ctx: RouteContext) {
  const { idOrName } = await ctx.params;
  const url = new URL(request.url);
  const eventFilter = url.searchParams.get("event") ?? "";

  try {
    // Source uses Sequelize's `findOne({ where: { name } })` — exact match
    // on the name column, case-sensitive.
    const [band] = await db
      .select()
      .from(bands)
      .where(eq(bands.name, idOrName));
    if (!band) {
      return NextResponse.json(null);
    }

    // Eagerly load the nested associations the source's include chain
    // produced: meet_greets and set_times for this band, each with their
    // events (optionally filtered by ?event=<like>).
    const eventLikePattern = `%${eventFilter}%`;

    const meetGreetRows = await db
      .select({
        meetGreetId: meetGreets.meetGreetId,
        meetStartTime: meetGreets.meetStartTime,
        meetEndTime: meetGreets.meetEndTime,
        event: events,
      })
      .from(meetGreets)
      .innerJoin(events, eq(meetGreets.eventId, events.eventId))
      .where(
        and(
          eq(meetGreets.bandId, band.bandId),
          eventFilter ? ilike(events.name, eventLikePattern) : undefined,
        ),
      )
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
      .where(
        and(
          eq(setTimes.bandId, band.bandId),
          eventFilter ? ilike(events.name, eventLikePattern) : undefined,
        ),
      )
      .orderBy(events.date);

    return NextResponse.json({
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
    });
  } catch (error) {
    return NextResponse.json("failed to GET bands/:name " + String(error), {
      status: 500,
    });
  }
}

export async function PUT(request: Request, ctx: RouteContext) {
  const guard = await guardMutation(request);
  if (guard.response) return guard.response;

  const { idOrName } = await ctx.params;
  const bandId = parseInt(idOrName, 10);
  if (isNaN(bandId)) {
    return NextResponse.json(
      "failed to PUT /bands/:id — id must be an integer (got '" +
        idOrName +
        "')",
      { status: 500 },
    );
  }

  try {
    const body = (await request.json()) as Partial<{
      name: string;
      genre: string;
      availableStartTime: string;
      endTime: string;
    }>;

    const set: Record<string, unknown> = {};
    if (body.name !== undefined) set.name = body.name.slice(0, 200);
    if (body.genre !== undefined) set.genre = body.genre.slice(0, 200);
    if (body.availableStartTime !== undefined) {
      set.availableStartTime = new Date(body.availableStartTime);
    }
    if (body.endTime !== undefined) set.endTime = new Date(body.endTime);

    if (Object.keys(set).length === 0) {
      return NextResponse.json({
        message: `Successfully updated band with id ${bandId}`,
      });
    }

    // Snapshot before mutating so the audit row can carry both states.
    const [before] = await db
      .select()
      .from(bands)
      .where(eq(bands.bandId, bandId));
    const [after] = await db
      .update(bands)
      .set(set)
      .where(eq(bands.bandId, bandId))
      .returning();
    if (before && after) {
      await writeAuditEntry(
        { auditLogTable: auditLog, tier: guard.tier, actor: guard.actor },
        { collection: "bands", op: "updateOne", before, after },
      );
    }
    return NextResponse.json({
      message: `Successfully updated band with id ${bandId}`,
    });
  } catch (error) {
    return NextResponse.json("failed to PUT /bands/:id " + String(error), {
      status: 500,
    });
  }
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const guard = await guardMutation(request);
  if (guard.response) return guard.response;

  const { idOrName } = await ctx.params;
  const bandId = parseInt(idOrName, 10);
  if (isNaN(bandId)) {
    return NextResponse.json(
      "failed to DELETE /bands/:id — id must be an integer (got '" +
        idOrName +
        "')",
      { status: 500 },
    );
  }

  try {
    // Capture the row state before delete so the audit log carries it.
    const [before] = await db
      .select()
      .from(bands)
      .where(eq(bands.bandId, bandId));
    await db.delete(bands).where(eq(bands.bandId, bandId));
    if (before) {
      await writeAuditEntry(
        { auditLogTable: auditLog, tier: guard.tier, actor: guard.actor },
        { collection: "bands", op: "deleteOne", before, after: null },
      );
    }
    return NextResponse.json({
      message: `Successfully deleted band with id ${bandId}`,
    });
  } catch (error) {
    return NextResponse.json("failed to DELETE /bands/:id " + String(error), {
      status: 500,
    });
  }
}
