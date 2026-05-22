/**
 * /api/v2/music-tour/audit-log — Enhanced-tier observability surface.
 *
 *   GET /audit-log?op=&actor=&table=&since=&tier=&limit=
 *
 * Returns the music_tour.audit_log rows, newest first. Every mutation
 * on /api/music-tour/* (Original) and /api/v2/music-tour/* (Enhanced)
 * writes a row here — so this is the public "who-did-what-when" window
 * over both tiers' write activity.
 *
 * Read-only. No sign-in required (the floor of observability is that
 * EVERYONE can see what's been written, attributed to the writer's
 * GitHub login).
 *
 * Filters (all optional, all stackable):
 *   - op=insertOne | updateOne | deleteOne | insertMany | ...
 *   - actor=<github-login> (exact match on actor_login)
 *   - table=bands | events | stages
 *   - since=<ISO timestamp> — only rows newer than this
 *   - tier=original | enhanced
 *   - limit=<integer 1..200> (default 50)
 *
 * Per the precedent (memory: project_enhanced_api_conventions.md),
 * IPs are never stored or returned.
 */

import { db } from "@/lib/db";
import { auditLog } from "@/lib/schema/music-tour";
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
