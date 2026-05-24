/**
 * Read-side data layer for the EnterPrize Historical Enhanced port.
 *
 * Replaces the original mix of Prisma + @vercel/postgres + @vercel/kv
 * with Drizzle queries against the museum's Neon database. The exported
 * function signatures match the source 1:1 so the view layer ports
 * verbatim; what changed lives entirely inside each function body.
 *
 * Notable shape adapters:
 *   • `User.img` — original schema kept user avatars as inline `bytea`.
 *     Museum schema stores them in a separate `images` table referenced
 *     by `imageId`. Here we synthesize a URL string (the museum's
 *     /api/v2/quirk-truck-enhanced/images/[id] route) on the way out,
 *     so callers that did `<img src={`data:image/png;base64,${user.img}`}>`
 *     get a workable string. `imgFromOAuth` is always null because
 *     museum identity is GitHub-only and we don't passthrough the
 *     avatar URL into this port.
 *   • `AuditLog` — museum audit shape has `ts/op/actorLogin/before/after`
 *     where the original had `createdAt/action/summary/data`. We
 *     synthesize the old fields from the new ones on read so the
 *     audit-log card view renders without changes.
 *   • `getPage(id)` returns a **single-element array** to preserve the
 *     original JSONPath semantics (`kv.json.get('pages', '$.<id>')`).
 *   • `getPages()` returns a `{ [key]: page }` dictionary with `content`
 *     blanked — the "shortened" variant the original used for list
 *     views.
 *
 * The session-gating checks are byte-for-byte copies of the original.
 * The stub `auth()` in ./auth-stub returns a synthetic admin, so all
 * gates currently pass; real gating engages when the museum-OAuth
 * bridge replaces the stub.
 */

import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users as usersTable,
  documents as documentsTable,
  auditLog as auditLogTable,
  workOrders as workOrdersTable,
} from "@/lib/schema/quirk-truck-enhanced";
import type {
  User,
  WorkOrder,
  AuditLog,
} from "./definitions";

const PAGES_DOC_KEY = "pages";

/**
 * Map a Drizzle `users` row to the original Prisma `User` shape the
 * view layer expects. The single non-trivial bit is rendering
 * `imageId` as a URL string in `img`.
 */
function shapeUser(row: typeof usersTable.$inferSelect): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    admin: row.admin,
    sso: false, // museum identity is uniform; no per-user SSO bit
    role: row.role,
    img: row.imageId
      ? `/api/v2/quirk-truck-enhanced/images/${row.imageId}`
      : null,
    imgFromOAuth: null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  } as User;
}

/**
 * Map a museum `audit_log` row to the original Prisma `AuditLog`
 * shape. The original column names (`createdAt`, `action`, `summary`,
 * `data`) are synthesized from the new schema's
 * (`ts`, `op`, `actorLogin`, `before`/`after`).
 */
function shapeAuditLog(row: typeof auditLogTable.$inferSelect): AuditLog {
  const actor = row.actorLogin ?? "system";
  const collection = row.collection;
  const summary = `${actor} ${row.op} on ${collection}`;
  return {
    id: String(row.id),
    action: row.op,
    summary,
    data: { before: row.before, after: row.after, collection, actor },
    createdAt: row.ts,
    updatedAt: row.ts,
  } as AuditLog;
}

/////////////////////////////////////////////////
////////// USERS ////////////////////////////////
/////////////////////////////////////////////////

export async function getUsers(session: any): Promise<User[]> {
  if (
    !session?.user?.admin &&
    !session?.user?.role.includes("credential-manager")
  ) {
    throw new Error("Only admins can access this page");
  }
  try {
    const rows = await db.select().from(usersTable);
    return rows.map(shapeUser);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    throw new Error("Failed to fetch users.");
  }
}

export async function getUser(email: string): Promise<User | null> {
  try {
    const rows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    return rows[0] ? shapeUser(rows[0]) : null;
  } catch (error) {
    console.error("Failed to fetch user:", error);
    throw new Error("Failed to fetch user.");
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getUserById(
  id: string,
  session: any,
): Promise<User | null> {
  if (!UUID_RE.test(id)) {
    throw new Error("Invalid UUID");
  }
  try {
    const rows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    const user = rows[0] ? shapeUser(rows[0]) : null;
    if (
      !session?.user?.admin &&
      !session?.user?.role.includes("credential-manager") &&
      user?.email !== session?.user?.email
    ) {
      throw new Error(
        "Only admins, credential managers, or account owners can access this content.",
      );
    }
    return user;
  } catch (error) {
    console.error("Failed to fetch user by ID :", error);
    throw new Error("Failed to fetch user by ID.");
  }
}

/**
 * Paginated user search. The original used Prisma's `_relevance` +
 * `search` operators (Postgres full-text); we port that to a simple
 * ILIKE-against-name+email and an array-overlap check on `role`.
 * That covers the four UI affordances on this page: free-text type-
 * ahead and the role-checkbox filter. We deliberately do not try to
 * recreate ts_vector ranking because the visible UI only cares about
 * matching, not ranking.
 */
export async function getUsersPaginated(
  session: any,
  page = 1,
  query = "",
  roles = "",
  perPage = 15,
): Promise<{ users: User[]; total: number }> {
  if (
    !session?.user?.admin &&
    !session?.user?.role.includes("credential-manager")
  ) {
    throw new Error("Only admins can access this page");
  }

  const rolesArray = roles ? roles.split(",").filter(Boolean) : [];
  const pattern = query ? `%${query}%` : null;

  const filters = [];
  if (pattern) {
    filters.push(
      or(ilike(usersTable.email, pattern), ilike(usersTable.name, pattern)),
    );
  }
  if (rolesArray.length > 0) {
    // Postgres array && operator: "role && ARRAY[...]" — overlap.
    filters.push(sql`${usersTable.role} && ${rolesArray}::text[]`);
  }
  const whereExpr = filters.length === 0 ? undefined : or(...filters);

  const rows = await db
    .select()
    .from(usersTable)
    .where(whereExpr)
    .orderBy(asc(usersTable.name))
    .limit(perPage)
    .offset(perPage * (page - 1));

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(whereExpr);

  return { users: rows.map(shapeUser), total: countRow?.count ?? 0 };
}

////////////////////////////////////////////////
///////////// PAGES ////////////////////////////
////////////////////////////////////////////////

type PagesDoc = Record<string, any>;

async function readPagesDoc(): Promise<PagesDoc> {
  const rows = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.key, PAGES_DOC_KEY))
    .limit(1);
  return (rows[0]?.data as PagesDoc) ?? {};
}

/**
 * Shortened pages dictionary — content blanked to keep list-view
 * payloads small. Matches the original `kv.json.get('pages')` +
 * post-process behavior.
 */
export async function getPages(): Promise<PagesDoc> {
  try {
    const data = await readPagesDoc();
    const shortened: PagesDoc = {};
    for (const [key, page] of Object.entries(data)) {
      shortened[key] = { ...(page as any), content: "shortened" };
    }
    return shortened;
  } catch (error) {
    throw error;
  }
}

export async function getPageTitles(): Promise<string[]> {
  try {
    const data = await readPagesDoc();
    return Object.values(data).map((p: any) => p?.title).filter(Boolean);
  } catch (error) {
    throw error;
  }
}

export async function getPageTitleDescriptionAndImageAndId(): Promise<
  Array<{ id: string; title: string; description: string; image: string }>
> {
  try {
    const data = await readPagesDoc();
    return Object.values(data).map((p: any) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      image: p.image,
    }));
  } catch (error) {
    throw error;
  }
}

/**
 * Single-page lookup by id. Wrapped in a one-element array to preserve
 * the JSONPath array semantics the original consumers expect:
 *   const pagesResult = await getPage(id, session);
 *   const page = pagesResult[0];
 */
export async function getPage(
  id: string,
  _session: any,
): Promise<any[]> {
  try {
    const data = await readPagesDoc();
    const page = (data as any)[id];
    return page === undefined ? [] : [page];
  } catch (error) {
    throw error;
  }
}

///////////////////////////////////////////////////////
/////////////////////// AUDIT LOGS ////////////////////
///////////////////////////////////////////////////////

export async function getAuditLogs(session: any): Promise<AuditLog[]> {
  if (!session?.user?.admin) {
    throw new Error("Only admins can access this page");
  }
  try {
    const rows = await db
      .select()
      .from(auditLogTable)
      .orderBy(desc(auditLogTable.ts));
    return rows.map(shapeAuditLog);
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    throw new Error("Failed to fetch audit logs.");
  }
}

export async function getAuditLogById(
  id: string,
  session: any,
): Promise<AuditLog | null> {
  if (!session?.user?.admin) {
    throw new Error("Only admins can access this page");
  }
  try {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) return null;
    const rows = await db
      .select()
      .from(auditLogTable)
      .where(eq(auditLogTable.id, numericId))
      .limit(1);
    return rows[0] ? shapeAuditLog(rows[0]) : null;
  } catch (error) {
    console.error("Failed to fetch audit log:", error);
    throw new Error("Failed to fetch audit log.");
  }
}

export async function getAuditLogsPaginated(
  session: any,
  page = 1,
  query = "",
  actionsFilter = "",
  perPage = 15,
): Promise<{ auditLogs: AuditLog[]; total: number }> {
  if (
    !session?.user?.admin &&
    !session?.user?.role.includes("audit-logs")
  ) {
    throw new Error("Only admins can access this page");
  }

  const actionsArray = actionsFilter
    ? actionsFilter.split(",").filter(Boolean)
    : [];
  const pattern = query ? `%${query}%` : null;

  const filters = [];
  if (pattern) {
    filters.push(
      or(
        ilike(auditLogTable.collection, pattern),
        ilike(auditLogTable.op, pattern),
        ilike(auditLogTable.actorLogin, pattern),
      ),
    );
  }
  if (actionsArray.length > 0) {
    filters.push(inArray(auditLogTable.op, actionsArray));
  }
  const whereExpr = filters.length === 0 ? undefined : or(...filters);

  const rows = await db
    .select()
    .from(auditLogTable)
    .where(whereExpr)
    .orderBy(desc(auditLogTable.ts))
    .limit(perPage)
    .offset(perPage * (page - 1));

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogTable)
    .where(whereExpr);

  return { auditLogs: rows.map(shapeAuditLog), total: countRow?.count ?? 0 };
}

///////////////////////////////////////////////
/////////////// WORK ORDERS //////////////////
///////////////////////////////////////////////

/**
 * Returns the work orders relevant to this session: admin sees all,
 * the work-orders role sees all, otherwise the user sees orders they
 * requested OR orders whose `requiredRoles` they fully satisfy under
 * the nested OR-of-AND semantics (outer OR, inner AND).
 */
export async function getWorkOrdersForRoleOrSelf(
  session: any,
): Promise<WorkOrder[]> {
  try {
    const rows = await db
      .select()
      .from(workOrdersTable)
      .orderBy(desc(workOrdersTable.createdAt));
    return rows.filter((workOrder) => {
      if (session?.user?.admin) return true;
      if (workOrder.requesterId === session?.user?.id) return true;
      if (session?.user?.role?.includes("work-orders")) return true;
      const required = (workOrder.requiredRoles ?? []) as string[][];
      return required.some((roleSet) =>
        roleSet.every((role) => session?.user?.role?.includes(role)),
      );
    }) as unknown as WorkOrder[];
  } catch (error) {
    console.error("Failed to fetch work orders:", error);
    throw new Error("Failed to fetch work orders.");
  }
}
