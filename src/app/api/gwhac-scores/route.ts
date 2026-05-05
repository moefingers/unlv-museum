import { db } from "@/lib/db";
import { scores } from "@/lib/schema/gwhac-a-mole";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const topScores = await db
    .select()
    .from(scores)
    .orderBy(desc(scores.score))
    .limit(10);
  return NextResponse.json(topScores);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    playerName: string;
    score: number;
    level: number;
  };

  if (
    !body.playerName ||
    typeof body.score !== "number" ||
    typeof body.level !== "number"
  ) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [inserted] = await db
    .insert(scores)
    .values({
      playerName: body.playerName.slice(0, 50),
      score: body.score,
      level: body.level,
    })
    .returning();

  return NextResponse.json(inserted, { status: 201 });
}
