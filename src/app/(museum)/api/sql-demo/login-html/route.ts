/**
 * HTML-shaped form-submit handler for the visitor-facing SQL Demo login page.
 *
 * The original Express app handled `POST /login` with this exact flow:
 *   - On success → `res.send('Hello <b>' + row.title + '!</b> ... SECRETS ...')`
 *   - On no-match → `res.redirect("/index.html#unauthorized")`
 *   - On error → `res.redirect("/index.html#error")`
 *
 * Museum-side the form action was rewritten on museum-ready/original to
 * point at /api/sql-demo/login-html (this file). We mirror the original's
 * three response shapes verbatim, redirecting the failure cases at
 * `/api/sql-demo/#unauthorized` (or `#error`) — same hostname/path the
 * iframe lives at, so the inline hash-reading script in index.html fires
 * and renders the banner exactly as the source intended.
 *
 * The JSON-only sibling at /api/sql-demo/ remains for the api-client lab,
 * which is the structured-inspection surface (returns parsed rows, the
 * raw query string, an `injected` flag). This route is the *form* surface.
 *
 * Defaults to vulnerable mode because that's what the original Express
 * server did — its single SQL query was the string-interpolated one.
 * The api-client lab can hit this route with `mode=safe` to demonstrate
 * the patched version inside the same form UX.
 */

// Scoped client (sql_demo_runner) — see src/lib/db-sql-demo.ts. Using the
// main `db` here would let an attacker submit `' UNION SELECT ... FROM
// auth."user" -- ` in the username field and exfiltrate the entire museum.
import { sqlDemoDb as db } from "@/lib/db-sql-demo";
import { sql } from "drizzle-orm";

const HASH_REDIRECT_BASE = "/api/sql-demo/";

async function readForm(request: Request): Promise<URLSearchParams> {
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    return new URLSearchParams(text);
  }
  if (ct.includes("multipart/form-data")) {
    const data = await request.formData();
    const params = new URLSearchParams();
    for (const [k, v] of data.entries()) {
      if (typeof v === "string") params.set(k, v);
    }
    return params;
  }
  // Fallback: try JSON for callers that hit this from the api-client.
  if (ct.includes("application/json")) {
    const j = (await request.json()) as Record<string, string>;
    return new URLSearchParams(j);
  }
  return new URLSearchParams();
}

export async function POST(request: Request) {
  const form = await readForm(request);
  const username = form.get("username") ?? "";
  const password = form.get("password") ?? "";
  // Default to the original's behavior (vulnerable). The api-client can
  // pass mode=safe to demonstrate the patched flow inside the same UX.
  const mode = form.get("mode") === "safe" ? "safe" : "vulnerable";

  try {
    let row: { role?: string; username?: string } | undefined;

    if (mode === "vulnerable") {
      const query = `SELECT id, username, role FROM sql_demo.users WHERE username = '${username}' AND password = '${password}'`;
      const result = await db.execute(sql.raw(query));
      row = result.rows[0] as typeof row;
    } else {
      const result = await db.execute(
        sql`SELECT id, username, role FROM sql_demo.users WHERE username = ${username} AND password = ${password}`,
      );
      row = result.rows[0] as typeof row;
    }

    if (!row) {
      return Response.redirect(
        new URL(`${HASH_REDIRECT_BASE}#unauthorized`, request.url),
        302,
      );
    }

    // Mirror the original res.send shape: a greeting using the matched
    // user's role (the original called it `title`) and a few "secrets"
    // for flavor — same content the original Express server returned.
    const role = row.role ?? "User";
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>SQL Demo — success</title>
  <base href="/originals/sql-demo/">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  Hello <b>${escapeHtml(role)}!</b><br>
  This file contains all your secret data:<br><br>
  SECRETS<br><br>
  MORE SECRETS<br><br>
  <a href="/api/sql-demo/">Go back to login</a>
</body>
</html>`;
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    console.error("[sql-demo/login-html] query error", e);
    return Response.redirect(
      new URL(`${HASH_REDIRECT_BASE}#error`, request.url),
      302,
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
