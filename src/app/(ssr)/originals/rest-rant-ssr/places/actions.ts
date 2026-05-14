"use server";

import { db } from "@/lib/db";
import { places, comments } from "@/lib/schema/rest-rant";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createPlace(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    redirect("/originals/rest-rant-ssr/places/new?error=name+required");
  }
  await db.insert(places).values({
    name: name.slice(0, 200),
    pic:
      String(formData.get("pic") ?? "").trim() ||
      "https://placebear.com/g/500/500",
    cuisines: String(formData.get("cuisines") ?? "").trim() || "Various",
    city: String(formData.get("city") ?? "").trim() || "Anytown",
    state: String(formData.get("state") ?? "").trim() || "USA",
    founded: Number(formData.get("founded")) || null,
  });
  revalidatePath("/originals/rest-rant-ssr/places");
  redirect("/originals/rest-rant-ssr/places");
}

export async function updatePlace(id: number, formData: FormData) {
  await db
    .update(places)
    .set({
      name: String(formData.get("name") ?? "").slice(0, 200),
      pic: String(formData.get("pic") ?? "").slice(0, 500),
      cuisines: String(formData.get("cuisines") ?? "").slice(0, 200),
      city: String(formData.get("city") ?? "").slice(0, 100),
      state: String(formData.get("state") ?? "").slice(0, 50),
    })
    .where(eq(places.id, id));
  revalidatePath(`/originals/rest-rant-ssr/places/${id}`);
  redirect(`/originals/rest-rant-ssr/places/${id}`);
}

export async function deletePlace(id: number) {
  await db.delete(places).where(eq(places.id, id));
  revalidatePath("/originals/rest-rant-ssr/places");
  redirect("/originals/rest-rant-ssr/places");
}

export async function addComment(placeId: number, formData: FormData) {
  const content = String(formData.get("content") ?? "").trim();
  const stars = Number(formData.get("stars"));
  if (!content || !Number.isFinite(stars) || stars < 1 || stars > 5) return;
  await db.insert(comments).values({
    placeId,
    authorName: String(formData.get("author") ?? "").trim() || "Anonymous",
    content: content.slice(0, 1000),
    stars: Math.round(stars),
    rant: formData.get("rant") === "on",
  });
  revalidatePath(`/originals/rest-rant-ssr/places/${placeId}`);
  redirect(`/originals/rest-rant-ssr/places/${placeId}`);
}

export async function deleteComment(placeId: number, commentId: number) {
  await db.delete(comments).where(eq(comments.id, commentId));
  revalidatePath(`/originals/rest-rant-ssr/places/${placeId}`);
  redirect(`/originals/rest-rant-ssr/places/${placeId}`);
}
