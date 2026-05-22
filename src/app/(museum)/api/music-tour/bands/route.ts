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
import { auditLog, bands } from "@/lib/schema/music-tour";
import { asc, ilike, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/api-guard";
import { writeAuditEntry } from "@/lib/audit";

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
  // Anti-abuse guard runs first — Original-tier writes are gated the same
  // as Enhanced. See memory: project_enhanced_api_conventions.md for why
  // modifying Original to require auth is the explicit carve-out (it's
  // anti-abuse infrastructure, not a creative liberty on the source's
  // data shape).
  const guard = await guardMutation(request);
  if (guard.response) return guard.response;

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
    await writeAuditEntry(
      { auditLogTable: auditLog, tier: guard.tier, actor: guard.actor },
      { collection: "bands", op: "insertOne", before: null, after: newBand },
    );
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
