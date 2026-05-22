import { db } from "@/lib/db";
import { comments, users, auditLog } from "@/lib/schema/rest-rant";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { serializeComment } from "@/lib/rest-rant";
import { guardMutation } from "@/lib/api-guard";
import { writeAuditEntry } from "@/lib/audit";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ placeId: string; commentId: string }> },
) {
  const guard = await guardMutation(request);
  if (guard.response) return guard.response;

  const { placeId, commentId } = await params;
  const pid = Number(placeId);
  const cid = Number(commentId);
  if (!Number.isFinite(pid) || pid <= 0) {
    return NextResponse.json(
      { message: `Invalid id "${placeId}"` },
      { status: 404 },
    );
  }
  if (!Number.isFinite(cid) || cid <= 0) {
    return NextResponse.json(
      { message: `Invalid id "${commentId}"` },
      { status: 404 },
    );
  }
  const [row] = await db
    .select({ comment: comments, author: users })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .where(and(eq(comments.id, cid), eq(comments.placeId, pid)));
  if (!row) {
    return NextResponse.json(
      {
        message: `Could not find comment with id "${cid}" for place with id "${pid}"`,
      },
      { status: 404 },
    );
  }
  await db.delete(comments).where(eq(comments.id, cid));

  await writeAuditEntry(
    { auditLogTable: auditLog, tier: guard.tier, actor: guard.actor },
    {
      collection: "comments",
      op: "deleteOne",
      before: row.comment,
      after: null,
    },
  );

  return NextResponse.json(serializeComment(row.comment, row.author));
}
