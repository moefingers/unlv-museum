"use server";

import { db } from "@/lib/db";
import { places, comments, auditLog } from "@/lib/schema/rest-rant";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { guardServerAction } from "@/lib/api-guard";
import { writeAuditEntry } from "@/lib/audit";

/**
 * Server Actions for the SSR rest-rant surface. Each mutation runs
 * through `guardServerAction()` for two reasons:
 *
 *   1. Anti-abuse — Server Action POSTs don't go through `/api/*` so
 *      neither the api-guard nor the museum-toast SW catch them. An
 *      unauthenticated visitor could otherwise hammer this surface
 *      freely. The guard pulls the museum session and rate-limits
 *      the same way `/api/rest-rant/*` does.
 *
 *   2. Audit attribution — these mutations land in `rest_rant.places`
 *      / `rest_rant.comments`, the same tables `/api/rest-rant/*`
 *      writes to. The Enhanced-tier audit-log read endpoint surfaces
 *      every write across both tiers; without writing an audit row
 *      here, SSR-tier writes would appear as ghost data — rows that
 *      exist but have no recorded author. Adding `writeAuditEntry`
 *      after each successful mutation closes that gap.
 *
 * Blocked visitors get redirected back to the form page with
 * `?error=sign-in-required` so the UI can render a sign-in CTA (the
 * pages that consume this don't yet read the error param — that's a
 * follow-up; the redirect is honest behavior either way).
 */

const PLACES_LIST = "/originals/rest-rant-ssr/places";
const PLACES_NEW = `${PLACES_LIST}/new`;

function placeDetailPath(id: number): string {
  return `${PLACES_LIST}/${id}`;
}

function placeEditPath(id: number): string {
  return `${PLACES_LIST}/${id}/edit`;
}

export async function createPlace(formData: FormData) {
  const guard = await guardServerAction();
  if (!guard.actor) {
    redirect(`${PLACES_NEW}?error=${guard.reason}`);
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    redirect(`${PLACES_NEW}?error=name+required`);
  }
  const [row] = await db
    .insert(places)
    .values({
      name: name.slice(0, 200),
      pic:
        String(formData.get("pic") ?? "").trim() ||
        "https://placebear.com/g/500/500",
      cuisines: String(formData.get("cuisines") ?? "").trim() || "Various",
      city: String(formData.get("city") ?? "").trim() || "Anytown",
      state: String(formData.get("state") ?? "").trim() || "USA",
      founded: Number(formData.get("founded")) || null,
    })
    .returning();
  await writeAuditEntry(
    { auditLogTable: auditLog, tier: "original", actor: guard.actor },
    { collection: "places", op: "insertOne", before: null, after: row },
  );
  revalidatePath(PLACES_LIST);
  redirect(PLACES_LIST);
}

export async function updatePlace(id: number, formData: FormData) {
  const guard = await guardServerAction();
  if (!guard.actor) {
    redirect(`${placeEditPath(id)}?error=${guard.reason}`);
  }

  const [before] = await db.select().from(places).where(eq(places.id, id));
  const [after] = await db
    .update(places)
    .set({
      name: String(formData.get("name") ?? "").slice(0, 200),
      pic: String(formData.get("pic") ?? "").slice(0, 500),
      cuisines: String(formData.get("cuisines") ?? "").slice(0, 200),
      city: String(formData.get("city") ?? "").slice(0, 100),
      state: String(formData.get("state") ?? "").slice(0, 50),
    })
    .where(eq(places.id, id))
    .returning();
  await writeAuditEntry(
    { auditLogTable: auditLog, tier: "original", actor: guard.actor },
    { collection: "places", op: "updateOne", before, after },
  );
  revalidatePath(placeDetailPath(id));
  redirect(placeDetailPath(id));
}

export async function deletePlace(id: number) {
  const guard = await guardServerAction();
  if (!guard.actor) {
    redirect(`${placeDetailPath(id)}?error=${guard.reason}`);
  }

  const [before] = await db.select().from(places).where(eq(places.id, id));
  await db.delete(places).where(eq(places.id, id));
  await writeAuditEntry(
    { auditLogTable: auditLog, tier: "original", actor: guard.actor },
    { collection: "places", op: "deleteOne", before, after: null },
  );
  revalidatePath(PLACES_LIST);
  redirect(PLACES_LIST);
}

export async function addComment(placeId: number, formData: FormData) {
  const guard = await guardServerAction();
  if (!guard.actor) {
    redirect(`${placeDetailPath(placeId)}?error=${guard.reason}`);
  }

  const content = String(formData.get("content") ?? "").trim();
  const stars = Number(formData.get("stars"));
  if (!content || !Number.isFinite(stars) || stars < 1 || stars > 5) return;
  const [row] = await db
    .insert(comments)
    .values({
      placeId,
      authorName: String(formData.get("author") ?? "").trim() || "Anonymous",
      content: content.slice(0, 1000),
      stars: Math.round(stars),
      rant: formData.get("rant") === "on",
    })
    .returning();
  await writeAuditEntry(
    { auditLogTable: auditLog, tier: "original", actor: guard.actor },
    { collection: "comments", op: "insertOne", before: null, after: row },
  );
  revalidatePath(placeDetailPath(placeId));
  redirect(placeDetailPath(placeId));
}

export async function deleteComment(placeId: number, commentId: number) {
  const guard = await guardServerAction();
  if (!guard.actor) {
    redirect(`${placeDetailPath(placeId)}?error=${guard.reason}`);
  }

  const [before] = await db
    .select()
    .from(comments)
    .where(eq(comments.id, commentId));
  await db.delete(comments).where(eq(comments.id, commentId));
  await writeAuditEntry(
    { auditLogTable: auditLog, tier: "original", actor: guard.actor },
    { collection: "comments", op: "deleteOne", before, after: null },
  );
  revalidatePath(placeDetailPath(placeId));
  redirect(placeDetailPath(placeId));
}
