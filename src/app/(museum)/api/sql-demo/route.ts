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
 */

import { promises as fs } from "node:fs";
import path from "node:path";
// Scoped client: sql_demo_runner can only read sql_demo.users. The route
// deliberately runs string-interpolated SQL — using the main `db` client
// (neondb_owner) would let UNION-SELECT exfiltrate auth.user / auth.account
// across the entire museum. See src/lib/db-sql-demo.ts for the lockdown.
import { sqlDemoDb as db } from "@/lib/db-sql-demo";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

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
  const withBase = html.replace(/<head>/i, `<head>\n    ${BASE_HREF}`);
  return new Response(withBase, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    username: string;
    password: string;
    mode: "vulnerable" | "safe";
  };

  if (!body.username || !body.password || !body.mode) {
    return NextResponse.json(
      { error: "username, password, and mode are required" },
      { status: 400 },
    );
  }

  if (body.mode === "vulnerable") {
    // Intentionally vulnerable to demonstrate SQL injection
    // DO NOT use string interpolation for real queries
    const query = `SELECT id, username, role FROM sql_demo.users WHERE username = '${body.username}' AND password = '${body.password}'`;

    try {
      const result = await db.execute(sql.raw(query));
      return NextResponse.json({
        query,
        rows: result.rows,
        rowCount: result.rowCount,
        injected: body.username.includes("'") || body.password.includes("'"),
      });
    } catch (e) {
      return NextResponse.json({
        query,
        error: e instanceof Error ? e.message : String(e),
        injected: true,
      });
    }
  }

  // Safe parameterized query
  const query =
    "SELECT id, username, role FROM sql_demo.users WHERE username = $1 AND password = $2";
  const result = await db.execute(
    sql`SELECT id, username, role FROM sql_demo.users WHERE username = ${body.username} AND password = ${body.password}`,
  );

  return NextResponse.json({
    query: `${query} -- params: [$1='${body.username}', $2='${body.password}']`,
    rows: result.rows,
    rowCount: result.rowCount,
    injected: false,
  });
}
