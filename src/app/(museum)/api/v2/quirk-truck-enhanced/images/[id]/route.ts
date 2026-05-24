/**
 * Serve an image's bytes by id. Public (no auth gate) because images
 * are referenced from `<img src>` tags in the EnterPrize view layer —
 * a cookie-less img request must succeed.
 *
 * Long Cache-Control because the id is immutable: the row's bytes
 * are never mutated, only the row itself can be deleted. If the row
 * is deleted, served images go 404 on the next miss.
 */

import { db } from "@/lib/db";
import { images } from "@/lib/schema/quirk-truck-enhanced";
import { eq } from "drizzle-orm";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return new Response("invalid id", { status: 400 });
  }

  const [row] = await db
    .select()
    .from(images)
    .where(eq(images.id, id))
    .limit(1);
  if (!row) return new Response("not found", { status: 404 });

  return new Response(row.bytes as any, {
    headers: {
      "Content-Type": row.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
