import { db } from "@/lib/db";
import { places, comments, users, auditLog } from "@/lib/schema/rest-rant";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { serializeComment } from "@/lib/rest-rant";
import { guardMutation } from "@/lib/api-guard";
import { writeAuditEntry } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ placeId: string }> },
) {
  const guard = await guardMutation(request);
  if (guard.response) return guard.response;

  const { placeId } = await params;
  const id = Number(placeId);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json(
      { message: `Invalid id "${placeId}"` },
      { status: 404 },
    );
  }
  const [place] = await db.select().from(places).where(eq(places.id, id));
  if (!place) {
    return NextResponse.json(
      { message: `Could not find place with id "${id}"` },
      { status: 404 },
    );
  }
  const body = (await request.json()) as Partial<{
    content: string;
    stars: number;
    rant: boolean;
    authorId: number;
    authorName: string;
  }>;
  if (
    !body.content ||
    typeof body.stars !== "number" ||
    body.stars < 1 ||
    body.stars > 5
  ) {
    return NextResponse.json(
      { message: "content and stars (1-5) are required" },
      { status: 400 },
    );
  }
  let author = null;
  if (body.authorId) {
    const [u] = await db
      .select()
      .from(users)
      .where(eq(users.id, body.authorId));
    if (!u) {
      return NextResponse.json(
        { message: `Could not find author with id "${body.authorId}"` },
        { status: 404 },
      );
    }
    author = u;
  }
  const [comment] = await db
    .insert(comments)
    .values({
      placeId: id,
      authorId: body.authorId ?? null,
      authorName: author
        ? `${author.firstName} ${author.lastName}`
        : (body.authorName?.slice(0, 100) ?? "Anonymous"),
      content: body.content.slice(0, 1000),
      stars: Math.max(1, Math.min(5, Math.round(body.stars))),
      rant: body.rant === true,
    })
    .returning();
  if (!comment) {
    return NextResponse.json(
      { message: "Failed to create comment" },
      { status: 500 },
    );
  }

  await writeAuditEntry(
    { auditLogTable: auditLog, tier: guard.tier, actor: guard.actor },
    { collection: "comments", op: "insertOne", before: null, after: comment },
  );

  return NextResponse.json(serializeComment(comment, author));
}
