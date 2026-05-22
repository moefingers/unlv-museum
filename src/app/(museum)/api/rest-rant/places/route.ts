import { db } from "@/lib/db";
import { places, auditLog } from "@/lib/schema/rest-rant";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { serializePlace } from "@/lib/rest-rant";
import { guardMutation } from "@/lib/api-guard";
import { writeAuditEntry } from "@/lib/audit";

export async function GET() {
  const rows = await db.select().from(places).orderBy(desc(places.createdAt));
  return NextResponse.json(rows.map(serializePlace));
}

export async function POST(request: Request) {
  const guard = await guardMutation(request);
  if (guard.response) return guard.response;

  const body = (await request.json()) as Partial<{
    name: string;
    city: string;
    state: string;
    cuisines: string;
    pic: string;
    founded: number;
  }>;
  if (!body.name || !body.cuisines) {
    return NextResponse.json(
      { message: "name and cuisines are required" },
      { status: 400 },
    );
  }
  const [row] = await db
    .insert(places)
    .values({
      name: body.name.slice(0, 200),
      city: body.city?.slice(0, 100) || "Anytown",
      state: body.state?.slice(0, 50) || "USA",
      cuisines: body.cuisines.slice(0, 200),
      pic: body.pic?.slice(0, 500) || "https://placebear.com/g/400/400",
      founded:
        typeof body.founded === "number" && body.founded > 0
          ? body.founded
          : null,
    })
    .returning();
  if (!row) {
    return NextResponse.json(
      { message: "Failed to create place" },
      { status: 500 },
    );
  }

  await writeAuditEntry(
    { auditLogTable: auditLog, tier: guard.tier, actor: guard.actor },
    { collection: "places", op: "insertOne", before: null, after: row },
  );

  return NextResponse.json(serializePlace(row));
}
