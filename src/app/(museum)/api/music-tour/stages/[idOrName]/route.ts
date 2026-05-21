/**
 * Music Tour API — single-stage ops.
 *
 *   GET    /api/music-tour/stages/:name     (param = stage_name)
 *   PUT    /api/music-tour/stages/:id       (param = integer stage_id)
 *   DELETE /api/music-tour/stages/:id       (param = integer stage_id)
 *
 * GET returns the stage with its M:M events list (through stage_events),
 * ordered by event date ASC — matches the source's include chain.
 */

import { db } from "@/lib/db";
import { events, stageEvents, stages } from "@/lib/schema/music-tour";
import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ idOrName: string }>;
}

export async function GET(_request: Request, ctx: RouteContext) {
  const { idOrName } = await ctx.params;
  try {
    const [stage] = await db
      .select()
      .from(stages)
      .where(eq(stages.stageName, idOrName));
    if (!stage) {
      return NextResponse.json(null);
    }
    const eventRows = await db
      .select({ event: events })
      .from(stageEvents)
      .innerJoin(events, eq(stageEvents.eventId, events.eventId))
      .where(eq(stageEvents.stageId, stage.stageId))
      .orderBy(asc(events.date));

    return NextResponse.json({
      ...stage,
      events: eventRows.map((r) => r.event),
    });
  } catch (error) {
    return NextResponse.json("failed to GET /stages/:name " + String(error), {
      status: 500,
    });
  }
}

export async function PUT(request: Request, ctx: RouteContext) {
  const { idOrName } = await ctx.params;
  const stageId = parseInt(idOrName, 10);
  if (isNaN(stageId)) {
    return NextResponse.json(
      "failed to PUT /stages/:id — id must be an integer (got '" +
        idOrName +
        "')",
      { status: 500 },
    );
  }
  try {
    const body = (await request.json()) as { stageName?: string };
    if (body.stageName === undefined) {
      return NextResponse.json({
        message: `Successfully updated 0 stage(s)`,
      });
    }
    const updated = await db
      .update(stages)
      .set({ stageName: body.stageName.slice(0, 200) })
      .where(eq(stages.stageId, stageId))
      .returning();
    return NextResponse.json({
      message: `Successfully updated ${updated.length} stage(s)`,
    });
  } catch (error) {
    return NextResponse.json("failed to PUT /stages/:id " + String(error), {
      status: 500,
    });
  }
}

export async function DELETE(_request: Request, ctx: RouteContext) {
  const { idOrName } = await ctx.params;
  const stageId = parseInt(idOrName, 10);
  if (isNaN(stageId)) {
    return NextResponse.json(
      "failed to DELETE /stages/:id — id must be an integer (got '" +
        idOrName +
        "')",
      { status: 500 },
    );
  }
  try {
    const deleted = await db
      .delete(stages)
      .where(eq(stages.stageId, stageId))
      .returning();
    return NextResponse.json({
      message: `Successfully deleted ${deleted.length} stage(s)`,
    });
  } catch (error) {
    return NextResponse.json("failed to DELETE /stages/:id " + String(error), {
      status: 500,
    });
  }
}
