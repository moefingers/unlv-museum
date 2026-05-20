import { db } from "@/lib/db";
import { bounties } from "@/lib/schema/jaskis";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * Single-bounty operations for the JASKIS port.
 * See ../route.ts for the source-data background.
 *
 * GET /api/jaskis/:id      → fetch one bounty
 * PUT /api/jaskis/:id      → update one bounty (any subset of fields)
 * DELETE /api/jaskis/:id   → remove one bounty
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bountyId = parseInt(id, 10);
  if (isNaN(bountyId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const [bounty] = await db
    .select()
    .from(bounties)
    .where(eq(bounties.id, bountyId));
  if (!bounty) {
    return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
  }

  return NextResponse.json(bounty);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bountyId = parseInt(id, 10);
  if (isNaN(bountyId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = (await request.json()) as {
    name?: string;
    species?: string;
    location?: string;
    wantedFor?: string;
    client?: string;
    reward?: number;
    captured?: boolean;
  };

  const [updated] = await db
    .update(bounties)
    .set({
      ...(body.name !== undefined && { name: body.name.slice(0, 100) }),
      ...(body.species !== undefined && {
        species: body.species.slice(0, 50),
      }),
      ...(body.location !== undefined && {
        location: body.location.slice(0, 80),
      }),
      ...(body.wantedFor !== undefined && {
        wantedFor: body.wantedFor.slice(0, 200),
      }),
      ...(body.client !== undefined && { client: body.client.slice(0, 80) }),
      ...(body.reward !== undefined && { reward: body.reward }),
      ...(body.captured !== undefined && { captured: body.captured }),
    })
    .where(eq(bounties.id, bountyId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bountyId = parseInt(id, 10);
  if (isNaN(bountyId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const [deleted] = await db
    .delete(bounties)
    .where(eq(bounties.id, bountyId))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Deleted", bounty: deleted });
}
