/**
 * Music Tour API — bands collection (faithful port of
 * `moefingers/SQL-Music-Tour-API/controllers/bands_controller.js`).
 *
 *   GET  /api/music-tour/bands           → list bands (optional ?name=<like>)
 *   POST /api/music-tour/bands           → create
 *
 * Single-band ops (lookup by name for GET, by id for PUT/DELETE — the
 * source's routing quirk) live in `./[idOrName]/route.ts`.
 */

import { db } from "@/lib/db";
import { bands } from "@/lib/schema/music-tour";
import { asc, ilike, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nameFilter = url.searchParams.get("name") ?? "";
  // Source used Sequelize's Op.like with `%${name}%` and an empty string
  // gave a match-everything default. ilike (case-insensitive LIKE) keeps
  // the same UX without forcing visitors to match capitalization.
  const rows = await db
    .select()
    .from(bands)
    .where(nameFilter ? ilike(bands.name, `%${nameFilter}%`) : sql`true`)
    .orderBy(asc(bands.availableStartTime));
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    genre?: string;
    availableStartTime?: string;
    endTime?: string;
  };

  if (!body.name || !body.genre || !body.availableStartTime || !body.endTime) {
    return NextResponse.json(
      "failed to POST /bands name, genre, availableStartTime, endTime are required",
      { status: 500 },
    );
  }

  try {
    const [newBand] = await db
      .insert(bands)
      .values({
        name: body.name.slice(0, 200),
        genre: body.genre.slice(0, 200),
        availableStartTime: new Date(body.availableStartTime),
        endTime: new Date(body.endTime),
      })
      .returning();
    // Source's success shape: { message, data }
    return NextResponse.json({
      message: "Successfully inserted a new band",
      data: newBand,
    });
  } catch (error) {
    return NextResponse.json("failed to POST /bands " + String(error), {
      status: 500,
    });
  }
}
