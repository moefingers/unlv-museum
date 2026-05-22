/**
 * /api/v2/sql-demo/audit-log — Enhanced-tier observability surface.
 *
 *   GET /audit-log?actor=&surface=&since=&tier=&limit=
 *
 * Returns the sql_demo.audit_log rows, newest first. Each row records
 * a single injection attempt (vulnerable or safe mode, JSON or form
 * surface) with the museum visitor's GitHub login, the submitted
 * payload, and the outcome. Reading this log shows the full who-tried-
 * what history of the demo.
 *
 * Read-only. No sign-in required.
 *
 * Filters (all optional, all stackable):
 *   - actor=<github-login> (exact match)
 *   - surface=json | form  (the api-client lab vs the iframe form)
 *   - since=<ISO timestamp>
 *   - tier=original | enhanced
 *   - limit=<integer 1..200> (default 50)
 *
 * The submitted password IS included in each row's `after.password`.
 * Per the schema comment, this is intentional for THIS project only:
 * sql_demo.users contains public demo seeds — the "passwords" are
 * the educational data, not real credentials. For identity-bearing
 * projects (rest-rant), passwords are NEVER recorded in audit rows.
 */

import { db } from "@/lib/db";
import { auditLog } from "@/lib/schema/sql-demo";
import { and, desc, eq, gte, sql, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const actor = url.searchParams.get("actor");
  const surface = url.searchParams.get("surface");
  const since = url.searchParams.get("since");
  const tier = url.searchParams.get("tier");
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(
    200,
    Math.max(1, parseInt(limitParam ?? "50", 10) || 50),
  );

  const conds: SQL[] = [];
  if (actor) conds.push(eq(auditLog.actorLogin, actor));
  if (tier === "original" || tier === "enhanced") {
    conds.push(eq(auditLog.tier, tier));
  }
  if (surface === "json" || surface === "form") {
    // The surface is stored inside the JSONB `after` payload; filter
    // via `after->>'surface'`. Drizzle exposes this through `sql`.
    conds.push(sql`${auditLog.after}->>'surface' = ${surface}`);
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
