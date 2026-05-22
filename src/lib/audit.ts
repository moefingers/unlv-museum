/**
 * Shared audit-write helper for mutation-bearing museum backends.
 *
 * Both Original-tier (`/api/<slug>/*`) and Enhanced-tier
 * (`/api/v2/<slug>/*`) mutation routes call `writeAuditEntry()` after a
 * successful insert/update/delete. The Enhanced-tier audit-log read
 * endpoint surfaces these rows back to visitors — so every mutation
 * across both tiers becomes publicly attributable.
 *
 * Per-project schemas (jaskis.audit_log, music_tour.audit_log,
 * admin_portal.audit_log, ...) all share this shape. The caller passes
 * the Drizzle table reference so the helper stays project-agnostic.
 *
 * See memory: project_enhanced_api_conventions.md for the full
 * convention (URL prefix, gating, rate limit, etc.).
 */

import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";

export type AuditTier = "original" | "enhanced";

export interface AuditWriteContext {
  /** Drizzle table reference, e.g. `music_tour.auditLog`. */
  auditLogTable: PgTable;
  /** Which URL prefix the visitor hit. */
  tier: AuditTier;
  /** Session info captured by the route's auth guard. Null = anonymous. */
  actor: { id: string; login: string | null } | null;
}

export interface AuditEvent {
  /** Table name within the project schema (e.g. "bands", "events"). */
  collection: string;
  /** Mutation kind. Use plural for batch ops ("insertMany", "deleteMany"). */
  op:
    | "insertOne"
    | "insertMany"
    | "updateOne"
    | "updateMany"
    | "deleteOne"
    | "deleteMany";
  /** Pre-mutation snapshot (null for inserts). */
  before: unknown;
  /** Post-mutation snapshot (null for deletes). */
  after: unknown;
}

/**
 * Insert one audit-log row. Fire-and-forget from the caller's POV
 * (returns void) but awaitable; route handlers should `await` it so
 * the response doesn't ship before the audit lands.
 *
 * Doesn't catch — if the DB write fails, the caller's mutation has
 * already happened so a failing audit indicates real infrastructure
 * trouble that should surface as a 500.
 */
export async function writeAuditEntry(
  ctx: AuditWriteContext,
  event: AuditEvent,
): Promise<void> {
  await db.insert(ctx.auditLogTable).values({
    actorId: ctx.actor?.id ?? null,
    actorLogin: ctx.actor?.login ?? null,
    collection: event.collection,
    op: event.op,
    tier: ctx.tier,
    before: event.before as never,
    after: event.after as never,
  } as never);
}
