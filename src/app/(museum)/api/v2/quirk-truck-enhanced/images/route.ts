/**
 * Image upload endpoint for the EnterPrize Historical Enhanced port.
 *
 * The view layer's client-side helper (compressToWebp in
 * .../quirk-truck-enhanced/lib/image-upload.ts) does the webp
 * compression before posting here, so this route only needs to
 * persist already-compressed bytes. Sized for the museum demo
 * (typical 30–80 KB per 1024px image, all stored inline as `bytea`
 * in the per-project `images` table).
 *
 * Writes are gated through `guardMutation` per the Enhanced API
 * convention: museum session required, two-tier rate limit, helpful
 * unauth 401 with a worked example. Every successful upload writes
 * an audit-log row attributing the image to the uploader's museum
 * identity.
 *
 * Companion GET-by-id at ./[id]/route.ts.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  images,
  auditLog,
  users as projectUsers,
} from "@/lib/schema/quirk-truck-enhanced";
import { eq } from "drizzle-orm";
import { guardMutation } from "@/lib/api-guard";
import { writeAuditEntry } from "@/lib/audit";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB hard ceiling after webp compress

export async function POST(request: Request) {
  const guard = await guardMutation(request);
  if (guard.response) return guard.response;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json(
      { error: "missing_file", message: "Field 'file' is required" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: "file_too_large",
        message: `File exceeds ${MAX_BYTES} bytes after compression`,
      },
      { status: 413 },
    );
  }

  const width = Number(form.get("width")) || null;
  const height = Number(form.get("height")) || null;
  const mime = file.type || "image/webp";

  const bytes = Buffer.from(await file.arrayBuffer());

  // Resolve the project-user id for owner attribution. The actor's
  // museum_user_id is guard.actor.id; we look up the corresponding
  // project-level user row. If they don't have one yet (haven't
  // logged into this port's identity bridge), the upload still
  // succeeds and `owner_user_id` stays null — the audit row carries
  // the museum identity regardless.
  let ownerUserId: string | null = null;
  const owner = await db
    .select({ id: projectUsers.id })
    .from(projectUsers)
    .where(eq(projectUsers.museumUserId, guard.actor.id))
    .limit(1);
  if (owner[0]) ownerUserId = owner[0].id;

  const inserted = await db
    .insert(images)
    .values({
      ownerUserId,
      mime,
      bytes,
      width,
      height,
    })
    .returning({ id: images.id });
  const created = inserted[0];
  if (!created) {
    return NextResponse.json(
      { error: "insert_failed", message: "Image row was not created" },
      { status: 500 },
    );
  }

  await writeAuditEntry(
    { auditLogTable: auditLog, tier: guard.tier, actor: guard.actor },
    {
      collection: "images",
      op: "insertOne",
      before: null,
      after: {
        id: created.id,
        mime,
        width,
        height,
        bytes: file.size,
      },
    },
  );

  return NextResponse.json({ id: created.id }, { status: 201 });
}
