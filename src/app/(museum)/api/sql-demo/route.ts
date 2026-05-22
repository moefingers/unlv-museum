/**
 * SQL Injection Demo — both the visitor-facing HTML form and the JSON API
 * the api-client lab uses.
 *
 * Original (moefingers/iam-2-sql-injection-demo): Express server that
 * served index.html at GET / and ran a deliberately-vulnerable
 * string-interpolated SQL query against an in-memory SQLite user table
 * at POST /login. The museum keeps the same shape:
 *
 *   GET  /api/sql-demo/            → HTML — index.html (the login form)
 *   POST /api/sql-demo/            → JSON — { query, rows, rowCount, injected }
 *                                    (vulnerable or safe per `mode` field)
 *
 * The form-submit flow goes to a sibling route at /api/sql-demo/login-html
 * which returns HTML so the iframe at /sql-demo behaves identically to the
 * original (success page or hash-redirect to #unauthorized). See
 * ./login-html/route.ts.
 *
 * Substrate switched from SQLite to Postgres (sql_demo schema) so the demo
 * runs against the museum's existing DB — the vulnerability surface is
 * identical, since `'... OR 1=1 --'` exploits the *query construction*,
 * not the engine.
 *
 * The Enhanced precedent applies in full: museum-session gating on the
 * POST routes (visitors must be GitHub-signed-in to play with injection),
 * every attempt audited under the visitor's GitHub login, helpful-401
 * for unauth attempts. The audit-write goes through the MAIN db client
 * with full privileges — `sqlDemoDb` (the locked-down runner) has NO
 * access to the audit_log table, so even a successful UNION-SELECT
 * injection cannot corrupt or read the audit trail. Per the
 * identity-and-signup contract, sql_demo.users is a PEDAGOGICAL FIXTURE
 * (not an identity surface), so the museum_user_id FK doesn't apply —
 * but the whole-route gate does.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
// Scoped client: sql_demo_runner can only read sql_demo.users. The route
// deliberately runs string-interpolated SQL — using the main `db` client
// (neondb_owner) would let UNION-SELECT exfiltrate auth.user / auth.account
// across the entire museum. See src/lib/db-sql-demo.ts for the lockdown.
import { sqlDemoDb } from "@/lib/db-sql-demo";
// Main db client (full privileges) for the audit-log write only. NEVER
// use this for the vulnerable demo query — the lockdown's whole point
// is that the demo runs as a privilege-scoped role.
import { db } from "@/lib/db";
import { auditLog } from "@/lib/schema/sql-demo";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/api-guard";

const PUBLIC_DIR = path.join(process.cwd(), "public", "originals", "sql-demo");
const BASE_HREF = '<base href="/originals/sql-demo/">';

export async function GET() {
  let html: string;
  try {
    html = await fs.readFile(path.join(PUBLIC_DIR, "index.html"), "utf8");
  } catch {
    return new Response("Could not find index.html", { status: 404 });
  }
  // Inject `<base>` just after `<head>` so the form-served-here page's
  // relative asset URLs (style.css) resolve against the museum's static
  // mount regardless of which request URL loaded the page. Matches the
  // admin-portal + rest-rant pattern.
  //
  // GET stays anonymous — anyone can SEE the form. The POST routes are
  // where the gating happens. Per "secure end-to-end, usability for
  // signed-in users only" — unauth visitors see the form but cannot
  // submit it; the form-submit returns an HTML 401 page (see
  // ./login-html/route.ts).
  const withBase = html.replace(/<head>/i, `<head>\n    ${BASE_HREF}`);
  return new Response(withBase, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * Audit every POST attempt, regardless of outcome. The audit row is
 * inserted via the MAIN db client (full privileges); the demo query
 * runs via sqlDemoDb (locked down). Even if the visitor crafts a
 * payload that throws inside the vulnerable query, the audit row
 * still lands — the writeAudit call sits OUTSIDE the try/catch that
 * wraps the demo query.
 *
 * The submitted password IS recorded in the audit `after` payload.
 * That's intentional for this project ONLY: sql_demo.users contains
 * public demo seeds, the passwords are the lesson's data, and
 * obscuring them in the audit would defeat the educational point of
 * "see what payload an attacker actually sends." For identity-bearing
 * projects (rest-rant), passwords are NEVER recorded — see those
 * routes.
 */
export async function POST(request: Request) {
  const guard = await guardMutation(request);
  if (guard.response) return guard.response;

  const body = (await request.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
    mode?: "vulnerable" | "safe";
  };

  const username = (body.username ?? "").slice(0, 500);
  const password = (body.password ?? "").slice(0, 500);
  const mode: "vulnerable" | "safe" =
    body.mode === "safe" ? "safe" : "vulnerable";

  if (!body.username || !body.password || !body.mode) {
    // Audit the malformed attempt anyway — visitors who probe with
    // missing fields are still part of "who tried to inject."
    await writeSqlDemoAudit(guard, {
      username,
      password,
      mode,
      surface: "json",
      outcome: "missing_fields",
      rowCount: null,
      error: null,
    });
    return NextResponse.json(
      { error: "username, password, and mode are required" },
      { status: 400 },
    );
  }

  let rowCount: number | null = null;
  let outcome: "success" | "no_match" | "query_error" = "no_match";
  let error: string | null = null;
  let responseBody: Record<string, unknown>;

  try {
    if (mode === "vulnerable") {
      // Intentionally vulnerable to demonstrate SQL injection.
      // DO NOT use string interpolation for real queries.
      const query = `SELECT id, username, role FROM sql_demo.users WHERE username = '${username}' AND password = '${password}'`;
      const result = await sqlDemoDb.execute(sql.raw(query));
      rowCount = result.rowCount ?? null;
      outcome = result.rows && result.rows.length > 0 ? "success" : "no_match";
      responseBody = {
        query,
        rows: result.rows,
        rowCount: result.rowCount,
        injected: username.includes("'") || password.includes("'"),
      };
    } else {
      // Safe parameterized query
      const queryDisplay =
        "SELECT id, username, role FROM sql_demo.users WHERE username = $1 AND password = $2";
      const result = await sqlDemoDb.execute(
        sql`SELECT id, username, role FROM sql_demo.users WHERE username = ${username} AND password = ${password}`,
      );
      rowCount = result.rowCount ?? null;
      outcome = result.rows && result.rows.length > 0 ? "success" : "no_match";
      responseBody = {
        query: `${queryDisplay} -- params: [$1='${username}', $2='${password}']`,
        rows: result.rows,
        rowCount: result.rowCount,
        injected: false,
      };
    }
  } catch (e) {
    outcome = "query_error";
    error = e instanceof Error ? e.message : String(e);
    responseBody = {
      query:
        mode === "vulnerable"
          ? `SELECT id, username, role FROM sql_demo.users WHERE username = '${username}' AND password = '${password}'`
          : "SELECT id, username, role FROM sql_demo.users WHERE username = $1 AND password = $2",
      error,
      injected: true,
    };
  }

  // Audit lands AFTER the query attempt regardless of outcome. The main
  // db client has INSERT privileges on sql_demo.audit_log; the locked-
  // down sqlDemoDb does not. No payload the visitor crafts in the
  // vulnerable query can prevent this row from landing — it runs as a
  // SEPARATE statement, against a SEPARATE connection, with parameterized
  // values that can't be injected into.
  await writeSqlDemoAudit(guard, {
    username,
    password,
    mode,
    surface: "json",
    outcome,
    rowCount,
    error,
  });

  return NextResponse.json(responseBody);
}

/**
 * Insert one audit row for an injection attempt. Defined inline rather
 * than via the shared writeAuditEntry helper because this route stores
 * the demo-specific shape (mode + surface + outcome) in the `after`
 * column rather than the generic insert/update/delete snapshot shape.
 *
 * Exported so the form-submit sibling at ./login-html/route.ts can
 * write rows with the same shape under `surface: "form"`.
 */
export async function writeSqlDemoAudit(
  guard: {
    actor: { id: string; login: string | null };
    tier: "original" | "enhanced";
  },
  payload: {
    username: string;
    password: string;
    mode: "vulnerable" | "safe";
    surface: "json" | "form";
    outcome: "success" | "no_match" | "query_error" | "missing_fields";
    rowCount: number | null;
    error: string | null;
  },
): Promise<void> {
  await db.insert(auditLog).values({
    actorId: guard.actor.id,
    actorLogin: guard.actor.login,
    collection: "users",
    op: "injectionAttempt",
    tier: guard.tier,
    before: null,
    after: payload as never,
  });
}
