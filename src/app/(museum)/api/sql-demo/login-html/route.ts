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
 *
 * Museum carve-out: museum-session required. Unauth visitors get an
 * HTML-shaped 401 page (not the standard JSON 401) so the iframe
 * receiving the response renders something readable — the iframe's
 * content-type contract is HTML. Every authed attempt is audited
 * via the shared writeSqlDemoAudit helper, with `surface: "form"` to
 * distinguish from the JSON api-client surface.
 */

// Scoped client (sql_demo_runner) — see src/lib/db-sql-demo.ts. Using the
// main `db` here would let an attacker submit `' UNION SELECT ... FROM
// auth."user" -- ` in the username field and exfiltrate the entire museum.
import { sqlDemoDb } from "@/lib/db-sql-demo";
import { sql } from "drizzle-orm";
import { guardMutation } from "@/lib/api-guard";
import { writeSqlDemoAudit } from "../route";

/**
 * Derive the hash-redirect base from the request URL so a failed
 * form-submit lands back on the form the visitor was using. Without
 * this, a POST to /api/v2/sql-demo/login-html (the Enhanced surface)
 * would redirect the iframe to /api/sql-demo/ (the Original form),
 * swapping the visitor out of the tier they chose.
 */
function hashRedirectBase(request: Request): string {
  return new URL(request.url).pathname.startsWith("/api/v2/")
    ? "/api/v2/sql-demo/"
    : "/api/sql-demo/";
}

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

/**
 * HTML-shaped 401 — the iframe is going to render whatever we return,
 * so JSON would look like garbage to a visitor. This page links back
 * to the demo and explains the museum-session requirement. The
 * back-link is per-request so the Enhanced form's unauth page
 * sends them back to the Enhanced form, not the Original one.
 */
function htmlUnauthResponse(request: Request): Response {
  const backLink = hashRedirectBase(request);
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>SQL Demo — sign in required</title>
  <base href="/originals/sql-demo/">
  <link rel="stylesheet" href="style.css">
</head>
<body style="font-family: system-ui, sans-serif; padding: 2rem; max-width: 40rem;">
  <h2>Sign in to use the SQL Demo</h2>
  <p>
    The museum requires a GitHub sign-in to play with the injection
    surface. Every attempt is audited — see the audit log endpoint
    at <code>/api/v2/sql-demo/audit-log</code> for the trail.
  </p>
  <p>
    Why the gate: the demo's pedagogy is intact (you can still
    demonstrate <code>' OR '1'='1' --</code> bypasses against the
    vulnerable query), but visitors playing with injection are
    doing so under their real GitHub identity, on the record. The
    locked-down database role still prevents privilege escalation
    out of <code>sql_demo</code>; the museum-session gate adds
    accountability on top.
  </p>
  <p>
    Sign in via the avatar menu in the museum's top-right chrome,
    then come back to <a href="${backLink}">the login form</a>.
  </p>
</body>
</html>`;
  return new Response(html, {
    status: 401,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  const guard = await guardMutation(request);
  // Override the default JSON 401 with an HTML one — the iframe's
  // content-type expectation is HTML.
  if (guard.response) return htmlUnauthResponse(request);

  const form = await readForm(request);
  const username = (form.get("username") ?? "").slice(0, 500);
  const password = (form.get("password") ?? "").slice(0, 500);
  // Default to the original's behavior (vulnerable). The api-client can
  // pass mode=safe to demonstrate the patched flow inside the same UX.
  const mode: "vulnerable" | "safe" =
    form.get("mode") === "safe" ? "safe" : "vulnerable";

  let rowCount: number | null = null;
  let outcome: "success" | "no_match" | "query_error" = "no_match";
  let error: string | null = null;
  let row: { role?: string; username?: string } | undefined;

  try {
    if (mode === "vulnerable") {
      const query = `SELECT id, username, role FROM sql_demo.users WHERE username = '${username}' AND password = '${password}'`;
      const result = await sqlDemoDb.execute(sql.raw(query));
      row = result.rows[0] as typeof row;
      rowCount = result.rowCount ?? null;
    } else {
      const result = await sqlDemoDb.execute(
        sql`SELECT id, username, role FROM sql_demo.users WHERE username = ${username} AND password = ${password}`,
      );
      row = result.rows[0] as typeof row;
      rowCount = result.rowCount ?? null;
    }
    outcome = row ? "success" : "no_match";
  } catch (e) {
    outcome = "query_error";
    error = e instanceof Error ? e.message : String(e);
  }

  // Audit happens unconditionally — even a query that throws inside
  // the vulnerable branch lands a row. The main db client doing the
  // audit insert is separate from the locked-down sqlDemoDb that ran
  // (or failed to run) the injection target.
  await writeSqlDemoAudit(guard, {
    username,
    password,
    mode,
    surface: "form",
    outcome,
    rowCount,
    error,
  });

  const redirectBase = hashRedirectBase(request);

  if (outcome === "query_error") {
    console.error("[sql-demo/login-html] query error", error);
    return Response.redirect(
      new URL(`${redirectBase}#error`, request.url),
      302,
    );
  }

  if (!row) {
    return Response.redirect(
      new URL(`${redirectBase}#unauthorized`, request.url),
      302,
    );
  }

  // Mirror the original res.send shape: a greeting using the matched
  // user's role (the original called it `title`) and a few "secrets"
  // for flavor — same content the original Express server returned.
  // The "back to login" link uses the per-request prefix so the
  // Enhanced success page links back to the Enhanced form (not the
  // Original one).
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
  <a href="${redirectBase}">Go back to login</a>
</body>
</html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
