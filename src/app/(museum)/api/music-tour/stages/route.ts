/**
 * Music Tour API — stages collection. Faithful port of
 * `controllers/stages_controller.js`.
 *
 *   GET  /api/music-tour/stages           → list stages (optional ?stage_name=<like>)
 *   POST /api/music-tour/stages           → create
 *
 * Single-stage ops live in `./[idOrName]/route.ts`.
 */

import { db } from "@/lib/db";
import { stages } from "@/lib/schema/music-tour";
import { ilike, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Source's query param is `stage_name`, not `name` — different from bands/events.
  const nameFilter = url.searchParams.get("stage_name") ?? "";
  const rows = await db
    .select()
    .from(stages)
    .where(nameFilter ? ilike(stages.stageName, `%${nameFilter}%`) : sql`true`);
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = (await request.json()) as { stageName?: string };
  if (!body.stageName) {
    return NextResponse.json("failed to POST /stages stageName is required", {
      status: 500,
    });
  }
  try {
    const [newStage] = await db
      .insert(stages)
      .values({ stageName: body.stageName.slice(0, 200) })
      .returning();
    return NextResponse.json({
      message: "Successfully inserted a new stage",
      data: newStage,
    });
  } catch (error) {
    return NextResponse.json("failed to POST /stages " + String(error), {
      status: 500,
    });
  }
}
