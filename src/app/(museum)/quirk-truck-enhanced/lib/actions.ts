"use server";

/**
 * Server actions for the EnterPrize Historical Enhanced port.
 *
 * The original mixed Prisma (`users`, `audit_logs`, `work_orders`) +
 * @vercel/postgres (`sql\`...\``) + @vercel/kv (the `'pages'` JSON doc)
 * + @vercel/blob (image uploads). This museum-ready port collapses
 * everything onto Drizzle queries against the
 * `quirk_truck_enhanced` schema in the museum's Neon database:
 *
 *   • Users / audit log: Drizzle → Postgres tables in the schema.
 *   • Pages tree: the entire JSON document lives in one row of
 *     `documents` (key='pages'). The original code used a stew of
 *     `kv.json.{get,set,del}` calls with JSONPath expressions to
 *     mutate nested sections; we replace each one with a
 *     **read-modify-write** of the whole document. The demo data is
 *     small (single-digit MB at worst), so the simplicity wins over
 *     the more sophisticated `jsonb_set` / `#-` approach. The
 *     original recursive lineage walker `getSectionIndices` ports
 *     verbatim because it works on the in-memory tree.
 *   • Image uploads: the `uploadImage` server action is gone — the
 *     view layer now POSTs directly to
 *     /api/v2/quirk-truck-enhanced/images via the client-side
 *     compressToWebp helper in ./image-upload.
 *
 * Audit-log writes use `writeAuditEntry()` from @/lib/audit, which is
 * the shared museum helper for mutation-bearing backends. Every
 * mutation in this file records an entry — `users` / `documents` /
 * `audit_log` are all uniformly observed.
 *
 * The session-gating logic is byte-for-byte the original. The stub
 * auth() returns a synthetic admin so all gates currently pass; real
 * auth lands when the museum-OAuth bridge replaces ./auth-stub.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

import { signIn, auth, signOut } from "./auth-stub";
import { getUser } from "./data";
import { db } from "@/lib/db";
import {
  users as usersTable,
  documents as documentsTable,
  auditLog as auditLogTable,
} from "@/lib/schema/quirk-truck-enhanced";
import { writeAuditEntry } from "@/lib/audit";

const PAGES_DOC_KEY = "pages";

/**
 * Read the `pages` document (the single jsonb row that holds the
 * entire pages tree). Returns an empty object if the row doesn't
 * exist yet — the very first createPage() will materialize it.
 */
async function readPagesDoc(): Promise<Record<string, any>> {
  const rows = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.key, PAGES_DOC_KEY))
    .limit(1);
  return (rows[0]?.data as Record<string, any>) ?? {};
}

/**
 * Write the entire `pages` document back. Upserts on the key so the
 * first call materializes the row. This is the museum's swap-in for
 * the `kv.json.set` calls scattered through the original actions.
 */
async function writePagesDoc(doc: Record<string, any>): Promise<void> {
  const existing = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.key, PAGES_DOC_KEY))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(documentsTable).values({
      key: PAGES_DOC_KEY,
      data: doc as never,
    });
  } else {
    await db
      .update(documentsTable)
      .set({ data: doc as never, updatedAt: new Date() })
      .where(eq(documentsTable.key, PAGES_DOC_KEY));
  }
}

function actorFromRequester(requester: any) {
  return requester
    ? { id: requester.id as string, login: requester.email as string }
    : null;
}

async function audit(
  requester: any,
  collection: string,
  op: any,
  before: unknown,
  after: unknown,
) {
  await writeAuditEntry(
    {
      auditLogTable,
      tier: "enhanced",
      actor: actorFromRequester(requester),
    },
    { collection, op, before, after },
  );
}

////////////////////////////
// Fetch user from session//
////////////////////////////
export async function fetchUserFromSession() {
  const session = await auth();
  return session ? await getUser(session?.user?.email as string) : null;
}

/**
 * Credentials-based authentication. Original called NextAuth's
 * `signIn('credentials', formData)`; the museum's bridge will POST
 * to /api/v2/quirk-truck-enhanced/authentication (three-factor:
 * email + password + matching museum_user_id). Stub returns generic
 * failure until the bridge is wired.
 *
 * Preserved signature so login-form.tsx ports verbatim.
 */
export async function authenticate(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  try {
    await signIn("credentials", formData as any);
  } catch (error) {
    console.log("[authenticate] error", error);
    return "Invalid credentials.";
  }
}

/**
 * Drop-target for the original `signIn('google')` path. The museum
 * port replaces it with a museum-OAuth button — the legacy form's
 * Google action is removed in login-form.tsx, so this function is
 * unreferenced but kept to preserve the action symbol.
 */
export async function googleAuthenticate(): Promise<void> {
  // intentionally empty; superseded by museum-OAuth login button
}

export async function getSession() {
  return await auth();
}

export async function serverSignOut() {
  await signOut();
}

/**
 * Update a user. The form supports a grab-bag of fields plus role
 * checkboxes (keys prefixed `role-`) and an image upload (key `img`).
 * The session-gating block at the bottom is preserved verbatim from
 * the original — checks vary per field, with name/email/password
 * each requiring different combinations of (admin, credential-
 * manager, owner-of-account, change-name).
 */
export async function updateUser(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const formEntries = Array.from(formData.entries());

  let keyValuePairObject: any = {};
  let auditPairs: any = {};
  for (const [key, value] of formEntries) {
    if (
      !key.startsWith("$") &&
      key !== "targetEmail" &&
      key !== "currentPassword" &&
      key !== "password" &&
      !key.startsWith("role")
    ) {
      keyValuePairObject[key] = value;
    } else if (key === "password") {
      const hashedPass = await bcrypt.hash(value as string, 10);
      keyValuePairObject[key] = hashedPass;
    } else if (key.startsWith("role")) {
      if (!keyValuePairObject.role) keyValuePairObject.role = [];
      keyValuePairObject.role.push(key.replace("role-", ""));
    }
  }
  auditPairs = { ...keyValuePairObject };

  // The original schema kept `img` as inline bytes on the users row.
  // The museum schema moved them to a separate `images` table; the
  // client uploads via /api/v2/quirk-truck-enhanced/images before the
  // form is submitted and only the resulting image id arrives here.
  // For the museum port, treat `img` form values as already-uploaded
  // image ids (UUIDs) — set `image_id` directly. An empty string
  // means "remove the avatar".
  if (keyValuePairObject.img !== undefined) {
    const raw = keyValuePairObject.img as string;
    const newImageId = raw === "" ? null : raw;
    auditPairs.img = newImageId;
    await db
      .update(usersTable)
      .set({ imageId: newImageId, updatedAt: new Date() })
      .where(eq(usersTable.email, formData.get("targetEmail") as string));
    delete keyValuePairObject.img;
  }

  const session = await auth();
  const requester = await getUser(session?.user?.email as string);

  const targetEmail = formData.get("targetEmail") as string;
  const targetUser = await getUser(targetEmail);

  const userPasswordInput = formData.get("currentPassword") as string;

  const ssoInput =
    formData.get("sso") === "on"
      ? true
      : formData.get("sso") === "off"
        ? false
        : null;
  if (targetUser?.sso !== ssoInput && ssoInput !== null) {
    keyValuePairObject.sso = ssoInput;
  }

  // NAME CHANGE gate
  if (
    (formData.get("name") &&
      !requester?.admin &&
      !requester?.role.includes("credential-manager") &&
      !requester?.role.includes("change-name")) ||
    (requester?.email !== targetEmail &&
      !requester?.admin &&
      !requester?.role.includes("credential-manager"))
  ) {
    return "You did a BIG bad.";
  }
  // PASSWORD CHANGE / SSO TOGGLE gate
  if (
    ((formData.get("password") || ssoInput !== null) &&
      userPasswordInput != null &&
      !(await bcrypt.compare(
        userPasswordInput,
        requester?.password as string,
      )) &&
      requester?.sso === false) ||
    (requester?.email !== targetEmail &&
      !requester?.admin &&
      !requester?.role.includes("credential-manager"))
  ) {
    return "You did a BIG bad.";
  }
  // EMAIL CHANGE gate
  if (
    formData.get("email") &&
    requester?.email !== targetEmail &&
    !requester?.admin &&
    !requester?.role.includes("credential-manager")
  ) {
    return "You did a BIG bad.";
  }

  // The Drizzle `users` schema doesn't have an `sso` column or an
  // `imgFromOAuth` column (museum identity is GitHub-only) — strip
  // those before update so we don't error on unknown columns. Keep
  // them in auditPairs since the audit summary still records the
  // intent.
  const allowedKeys = new Set([
    "name",
    "email",
    "password",
    "admin",
    "role",
  ]);
  const updateData: any = {};
  for (const [k, v] of Object.entries(keyValuePairObject)) {
    if (allowedKeys.has(k)) updateData[k] = v;
  }

  if (Object.keys(updateData).length > 0) {
    try {
      updateData.updatedAt = new Date();
      await db
        .update(usersTable)
        .set(updateData)
        .where(eq(usersTable.email, targetEmail));
    } catch (error) {
      console.log(error);
      return "Failed to Update User.";
    }
  }

  if (JSON.stringify(auditPairs) !== "{}") {
    try {
      await audit(
        requester,
        "users",
        "updateOne",
        // Strip password/img bytes from snapshots before they hit the
        // audit log. img is just an id now so it's safe, but we still
        // drop the hashed password — auditPairs may carry the new
        // bcrypt digest from above.
        targetUser,
        { ...auditPairs, password: undefined },
      );
    } catch (error) {
      console.log(error);
      return "Failed to Create Audit Log.";
    } finally {
      if (requester?.email !== targetEmail) {
        const path = "/quirk-truck-enhanced/dashboard/credentials/" + (targetUser?.id ?? "");
        revalidatePath(path);
        redirect(path);
      } else if (keyValuePairObject.imgFromOAuth) {
        revalidatePath("/quirk-truck-enhanced/dashboard");
      } else {
        revalidatePath("/quirk-truck-enhanced/dashboard/account");
        redirect("/quirk-truck-enhanced/dashboard/account");
      }
    }
  } else {
    return "No changes were defined.";
  }
}

/**
 * Create a user. The original set `sso: true` and no password — the
 * museum schema currently requires a non-null password (see schema
 * header TODO), so we set a random placeholder digest. The user's
 * real password is set via the credentials flow + a password change.
 */
export async function createUser(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  let createdId: string | undefined;
  try {
    const requester = await fetchUserFromSession();

    const email = formData.get("email") as string;
    const name = formData.get("name") as string;

    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    if (existing.length > 0) {
      return "user already exists with that email";
    }

    // NOTE(museum-port): the original used NextAuth+Google SSO so a
    // newly-created user could log in without a password. The museum
    // port requires a placeholder password digest at the schema
    // level. The user will set their own via the museum-OAuth bridge
    // when they first sign in.
    const placeholderDigest = await bcrypt.hash(
      `museum-placeholder-${Date.now()}`,
      10,
    );

    const inserted = await db
      .insert(usersTable)
      .values({
        // museumUserId is required by the FK contract; until the
        // museum-OAuth bridge lands we point it at the seeded admin
        // museum_user_id. This is a temporary stub-era invariant
        // documented in lib/auth-stub.ts.
        museumUserId: "stub-museum-admin",
        email,
        name,
        password: placeholderDigest,
        role: [],
      })
      .returning({ id: usersTable.id });
    if (!inserted[0]) return "Failed to Create User.";
    createdId = inserted[0].id;

    await audit(requester, "users", "insertOne", null, {
      id: createdId,
      email,
      name,
    });
  } catch (error) {
    console.log(error);
    return "Failed to Create User.";
  } finally {
    if (createdId) {
      revalidatePath(`/quirk-truck-enhanced/dashboard/credentials/${createdId}`);
      redirect(`/quirk-truck-enhanced/dashboard/credentials/${createdId}`);
    }
  }
}

///////////////////////////////////////////////
/////////////////// pages /////////////////////
///////////////////////////////////////////////

/**
 * Create a top-level page (e.g. a "Fleet" page with sections under
 * it). The id is derived from the title by lowercasing +
 * non-alphanumeric → underscore.
 */
export async function createPage(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const requester = await fetchUserFromSession();
  let ok = false;
  const id = (formData.get("id") as string)
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]/g, "_");
  const pagePayload: any = { id, sections: [] };
  try {
    if (
      !requester?.admin &&
      !requester?.role.includes("page-manager")
    ) {
      throw new Error("Only admins can access this page");
    }

    const doc = await readPagesDoc();
    if (doc[id]) {
      return "page with a similar title already exists";
    }

    pagePayload.title = formData.get("title") as string;
    pagePayload.description = formData.get("description") as string;
    const blobUrl = formData.get("image-url") as string;
    if (blobUrl) pagePayload.image = blobUrl;

    doc[id] = pagePayload;
    await writePagesDoc(doc);
    ok = true;
  } catch (error) {
    console.log(error);
  } finally {
    await audit(
      requester,
      "documents",
      ok ? "insertOne" : "updateOne",
      null,
      { pageId: id, ok, page: pagePayload },
    );
    if (ok) redirect("/quirk-truck-enhanced/dashboard/pages/modify/" + id);
  }
  return "Failed to Create Page.";
}

export async function deletePage(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const id = (formData.get("id") as string)
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]/g, "_");
  const requester = await fetchUserFromSession();
  let ok = false;
  let removed: any = null;
  try {
    if (
      !requester?.admin &&
      !requester?.role.includes("page-manager")
    ) {
      throw new Error("Only admins can access this page");
    }
    const doc = await readPagesDoc();
    if (doc[id]) {
      removed = doc[id];
      delete doc[id];
      await writePagesDoc(doc);
      ok = true;
    }
  } catch (error) {
    console.log(error);
    return "Failed to Delete Page.";
  } finally {
    await audit(
      requester,
      "documents",
      "deleteOne",
      { pageId: id, page: removed },
      null,
    );
    if (ok) {
      revalidatePath("/quirk-truck-enhanced/dashboard/pages/modify");
      redirect("/quirk-truck-enhanced/dashboard/pages/modify");
    }
  }
  return "Failed to Delete Page.";
}

/**
 * Update a top-level page. May rename it (title change rederives the
 * id, keys are renamed in the doc).
 */
export async function updatePage(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const requester = await fetchUserFromSession();
  let ok = false;
  const oldId = (formData.get("id") as string)
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]/g, "_");
  const newId = (formData.get("title") as string)
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]/g, "_");
  const changes: any = {};
  try {
    if (
      !requester?.admin &&
      !requester?.role.includes("page-manager")
    ) {
      throw new Error("Only admins can access this page");
    }
    const doc = await readPagesDoc();
    const existing = doc[oldId];
    if (!existing) return "That page doesn't exist to update";

    if (existing.id !== newId) changes.id = newId;
    if (existing.title !== formData.get("title"))
      changes.title = formData.get("title") as string;
    if (existing.description !== formData.get("description"))
      changes.description = formData.get("description") as string;
    const blobUrl = formData.get("image-url") as string;
    if (blobUrl) changes.image = blobUrl;

    const merged = { ...existing, ...changes };

    if (changes.id && newId !== oldId) {
      delete doc[oldId];
      doc[newId] = merged;
    } else {
      doc[oldId] = merged;
    }
    await writePagesDoc(doc);
    ok = true;
  } catch (error) {
    console.log(error);
  } finally {
    await audit(requester, "documents", "updateOne", { pageId: oldId }, {
      pageId: newId,
      changes,
    });
    if (ok) {
      revalidatePath("/quirk-truck-enhanced/dashboard/pages/modify/" + oldId);
      redirect("/quirk-truck-enhanced/dashboard/pages/modify/" + newId);
    }
  }
  return "Failed to Update Page.";
}

/**
 * Walk into a section by name lineage. Returns the indices array of
 * arrays — outer level is "all paths that matched", inner is the
 * sequence of indices to follow. Verbatim port of the original
 * helper; works on the in-memory tree so no DB changes needed.
 */
function getSectionIndices(data: any, sectionNames: string[]): number[][] {
  const indices: number[][] = [];
  function findIndicesHelper(
    sections: any[],
    names: string[],
    currentPath: number[],
  ): number[][] {
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const newPath = [...currentPath, i];
      if (names[0] === section.name) {
        if (names.length === 1) {
          indices.push(newPath);
          return indices;
        }
        if (section.sections) {
          const subIndices = findIndicesHelper(
            section.sections,
            names.slice(1),
            newPath,
          );
          if (subIndices.length > 0) return subIndices;
        }
      }
    }
    return [];
  }
  return findIndicesHelper(data.sections ?? [], sectionNames, []);
}

/**
 * Resolve the section at `pathIndices` inside a page tree. Returns
 * { parent, index, section } so callers can mutate in place.
 */
function resolveSection(
  page: any,
  pathIndices: number[],
): { parent: any; index: number; section: any } | null {
  if (pathIndices.length === 0) return null;
  let parent: any = page;
  for (let depth = 0; depth < pathIndices.length - 1; depth++) {
    const idx = pathIndices[depth]!;
    if (!parent.sections || !parent.sections[idx]) return null;
    parent = parent.sections[idx];
  }
  const lastIdx = pathIndices[pathIndices.length - 1]!;
  if (!parent.sections || !parent.sections[lastIdx]) return null;
  return {
    parent,
    index: lastIdx,
    section: parent.sections[lastIdx],
  };
}

export async function updatePageSection(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const requester = await fetchUserFromSession();
  let ok = false;
  const lineage = (formData.get("lineage") as string).split(".");
  const kvPairs: any = {};
  for (const [key, value] of formData.entries()) {
    if (key !== "lineage" && key !== "image" && key !== "images") {
      kvPairs[key] = value;
    }
  }
  if (formData.get("images")) {
    const imagesString = formData.get("images") as string;
    kvPairs.images = imagesString.split(",,,");
  }
  try {
    if (
      !requester?.admin &&
      !requester?.role.includes("page-manager")
    ) {
      throw new Error("Only admins can access this page");
    }
    const doc = await readPagesDoc();
    const page = doc[lineage[0]!];
    if (!page) return "That page doesn't exist to update";

    const indicesPath = getSectionIndices(page, lineage.slice(1));
    if (indicesPath.length === 0) return "Section not found at lineage";
    const resolved = resolveSection(page, indicesPath[0]!);
    if (!resolved) return "Section not found at lineage";

    Object.assign(resolved.section, kvPairs);
    await writePagesDoc(doc);
    ok = true;
  } catch (error) {
    console.log(error);
  } finally {
    await audit(
      requester,
      "documents",
      "updateOne",
      { lineage },
      { lineage, changes: kvPairs },
    );
    if (ok) {
      revalidatePath("/quirk-truck-enhanced/dashboard/pages/modify/" + lineage[0]);
      redirect("/quirk-truck-enhanced/dashboard/pages/modify/" + lineage[0]);
    }
  }
  return "Failed to Update Page Section.";
}

export async function deleteSectionImage(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const requester = await fetchUserFromSession();
  const lineage = (formData.get("lineage") as string).split(".");
  const imageIndexRaw = formData.get("image-index") as string;
  const imageIndex = imageIndexRaw ? parseInt(imageIndexRaw, 10) : null;
  let ok = false;
  let removed: any = null;
  try {
    if (
      !requester?.admin &&
      !requester?.role.includes("page-manager")
    ) {
      throw new Error("Only admins can access this page");
    }
    const doc = await readPagesDoc();
    const page = doc[lineage[0]!];
    if (!page) return "That image doesn't exist to delete";
    const indicesPath = getSectionIndices(page, lineage.slice(1));
    if (indicesPath.length === 0) return "Section not found";
    const resolved = resolveSection(page, indicesPath[0]!);
    if (!resolved) return "Section not found";

    if (imageIndex !== null) {
      removed = resolved.section.images?.[imageIndex];
      resolved.section.images?.splice(imageIndex, 1);
    } else {
      removed = resolved.section.image;
      delete resolved.section.image;
    }
    await writePagesDoc(doc);
    ok = true;
  } catch (error) {
    console.log(error);
    return "Failed to Delete Image.";
  } finally {
    await audit(
      requester,
      "documents",
      "deleteOne",
      { lineage, removed },
      null,
    );
    if (ok) {
      revalidatePath("/quirk-truck-enhanced/dashboard/pages/modify/" + lineage[0]);
      redirect("/quirk-truck-enhanced/dashboard/pages/modify/" + lineage[0]);
    }
  }
  return "Failed to Delete Image.";
}

export async function createSection(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const requester = await fetchUserFromSession();
  const lineage = (formData.get("lineage") as string).split(".");
  const kvPairs: any = {};
  for (const [key, value] of formData.entries()) {
    if (key !== "lineage") kvPairs[key] = value;
  }
  let ok = false;
  try {
    if (
      !requester?.admin &&
      !requester?.role.includes("page-manager")
    ) {
      throw new Error("Only admins can access this page");
    }
    const doc = await readPagesDoc();
    const page = doc[lineage[0]!];
    if (!page) return "That page doesn't exist to update";

    // lineage may be just [pageKey] (create at page root) or
    // [pageKey, sectionName, ...] (create inside a nested section).
    let target: any;
    if (lineage.length === 1) {
      target = page;
    } else {
      const indicesPath = getSectionIndices(page, lineage.slice(1));
      if (indicesPath.length === 0) return "Parent section not found";
      const resolved = resolveSection(page, indicesPath[0]!);
      if (!resolved) return "Parent section not found";
      target = resolved.section;
    }
    if (!Array.isArray(target.sections)) target.sections = [];
    target.sections.push(kvPairs);
    await writePagesDoc(doc);
    ok = true;
  } catch (error) {
    console.log(error);
    return "Failed to Create Section.";
  } finally {
    await audit(requester, "documents", "insertOne", null, {
      lineage,
      newSection: kvPairs,
    });
    if (ok) {
      revalidatePath("/quirk-truck-enhanced/dashboard/pages/modify/" + lineage[0]);
      redirect("/quirk-truck-enhanced/dashboard/pages/modify/" + lineage[0]);
    }
  }
  return "Failed to Create Section.";
}
