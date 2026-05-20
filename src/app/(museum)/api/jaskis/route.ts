import { db } from "@/lib/db";
import { bounties } from "@/lib/schema/jaskis";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * JASKIS — bounties collection (museum port of moefingers/API-JASKIS).
 *
 * Source data lives at moefingers/API-JASKIS:commands.js — a MongoDB
 * shell exercise around an animal-bounties collection. The museum
 * surfaces the same data shape as a REST API so visitors can interact
 * with it via api-client.
 *
 * Endpoints mirror what a MongoDB-backed Express version of the same
 * exercise would expose: list all, get one, create, update, delete.
 *
 * GET /api/jaskis           → list all bounties (newest first)
 * POST /api/jaskis          → create a new bounty
 *
 * See ./[id]/route.ts for single-bounty operations.
 */

export async function GET() {
  const allBounties = await db
    .select()
    .from(bounties)
    .orderBy(desc(bounties.createdAt));
  return NextResponse.json(allBounties);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    species?: string;
    location?: string;
    wantedFor?: string;
    client?: string;
    reward?: number;
    captured?: boolean;
  };

  if (
    !body.name ||
    !body.species ||
    !body.location ||
    !body.wantedFor ||
    !body.client ||
    body.reward === undefined
  ) {
    return NextResponse.json(
      {
        error:
          "name, species, location, wantedFor, client, and reward are required",
      },
      { status: 400 },
    );
  }

  const [bounty] = await db
    .insert(bounties)
    .values({
      name: body.name.slice(0, 100),
      species: body.species.slice(0, 50),
      location: body.location.slice(0, 80),
      wantedFor: body.wantedFor.slice(0, 200),
      client: body.client.slice(0, 80),
      reward: body.reward,
      captured: body.captured ?? false,
    })
    .returning();

  return NextResponse.json(bounty, { status: 201 });
}
