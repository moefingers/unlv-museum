/**
 * Music Tour API — events collection. Faithful port of
 * `controllers/events_controller.js`.
 *
 *   GET  /api/music-tour/events           → list events (optional ?name=<like>)
 *   POST /api/music-tour/events           → create
 *
 * Single-event ops live in `./[idOrName]/route.ts`.
 */

import { db } from "@/lib/db";
import { events } from "@/lib/schema/music-tour";
import { asc, ilike, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nameFilter = url.searchParams.get("name") ?? "";
  const rows = await db
    .select()
    .from(events)
    .where(nameFilter ? ilike(events.name, `%${nameFilter}%`) : sql`true`)
    .orderBy(asc(events.date));
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
  };

  if (!body.name || !body.date || !body.startTime || !body.endTime) {
    return NextResponse.json(
      "failed to POST /events name, date, startTime, endTime are required",
      { status: 500 },
    );
  }

  try {
    const [newEvent] = await db
      .insert(events)
      .values({
        name: body.name.slice(0, 200),
        date: new Date(body.date),
        startTime: new Date(body.startTime),
        endTime: new Date(body.endTime),
      })
      .returning();
    return NextResponse.json({
      message: "Successfully inserted a new event",
      data: newEvent,
    });
  } catch (error) {
    return NextResponse.json("failed to POST /events " + String(error), {
      status: 500,
    });
  }
}
