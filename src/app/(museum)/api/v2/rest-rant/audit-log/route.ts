/**
 * /api/v2/rest-rant/audit-log — Enhanced-tier observability surface.
 *
 *   GET /audit-log?op=&actor=&table=&since=&tier=&limit=
 *
 * Returns the rest_rant.audit_log rows, newest first. Mutations on
 * /api/rest-rant/* (Original) and /api/v2/rest-rant/* (Enhanced) write
 * here, plus the project's login events (loginAttempt, loginSuccess)
 * per the identity-and-signup contract.
 *
 * Read-only. No sign-in required (the floor of observability is that
 * EVERYONE can see what's been written, attributed to the writer's
 * GitHub login).
 *
 * Filters (all optional, all stackable):
 *   - op=insertOne | updateOne | deleteOne | loginAttempt | loginSuccess
 *   - actor=<github-login> (exact match on actor_login)
 *   - table=users | places | comments
 *   - since=<ISO timestamp>
 *   - tier=original | enhanced
 *   - limit=<integer 1..200> (default 50)
 *
 * Login events have `after.email` + `after.outcome` (and never the
 * password) — visitors can see who's been trying to log in but not the
 * credentials themselves.
 */

import { db } from "@/lib/db";
import { auditLog } from "@/lib/schema/rest-rant";
import { and, desc, eq, gte, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const op = url.searchParams.get("op");
  const actor = url.searchParams.get("actor");
  const table = url.searchParams.get("table");
  const since = url.searchParams.get("since");
  const tier = url.searchParams.get("tier");
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(
    200,
    Math.max(1, parseInt(limitParam ?? "50", 10) || 50),
  );

  const conds: SQL[] = [];
  if (op) conds.push(eq(auditLog.op, op));
  if (actor) conds.push(eq(auditLog.actorLogin, actor));
  if (table) conds.push(eq(auditLog.collection, table));
  if (tier === "original" || tier === "enhanced") {
    conds.push(eq(auditLog.tier, tier));
  }
  if (since) {
    const d = new Date(since);
    if (!isNaN(d.getTime())) conds.push(gte(auditLog.ts, d));
  }

  const base = db
    .select({
      id: auditLog.id,
      ts: auditLog.ts,
      actor_login: auditLog.actorLogin,
      collection: auditLog.collection,
      op: auditLog.op,
      tier: auditLog.tier,
      before: auditLog.before,
      after: auditLog.after,
    })
    .from(auditLog);

  const rows = await (conds.length ? base.where(and(...conds)) : base)
    .orderBy(desc(auditLog.ts))
    .limit(limit);

  return NextResponse.json({
    count: rows.length,
    rows,
  });
}
