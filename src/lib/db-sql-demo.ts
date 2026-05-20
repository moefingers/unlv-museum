/**
 * Scoped Drizzle client for /api/sql-demo only.
 *
 * The SQL Injection Demo route DELIBERATELY executes string-interpolated
 * SQL — the whole pedagogy of the original UNLV exercise is "watch what
 * happens when you don't parameterize." Hitting the museum's main DB
 * (db.ts → DATABASE_URL → neondb_owner) would let any visitor exfiltrate
 * auth.user emails, auth.account OAuth tokens, audit_log entries, etc.,
 * via a one-line UNION SELECT in the username field.
 *
 * This client connects as the `sql_demo_runner` Postgres role, which has:
 *   - GRANT CONNECT ON DATABASE neondb
 *   - GRANT USAGE ON SCHEMA sql_demo
 *   - GRANT SELECT ON sql_demo.users
 * and NO privileges on any other schema. UNION SELECTs against auth.*,
 * jaskis.*, admin_portal.*, etc. all return `permission denied for schema X`.
 *
 * If `SQL_DEMO_DATABASE_URL` is missing at runtime, we throw at first use
 * rather than silently fall back to the main DB — fail-loud is the right
 * posture for a route this dangerous.
 *
 * See CONTEXT/internal_docs/security.md for the full lockdown rationale
 * and the audit trail that motivated this split.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

const url = process.env.SQL_DEMO_DATABASE_URL;
if (!url) {
  throw new Error(
    "SQL_DEMO_DATABASE_URL is not set — /api/sql-demo refuses to fall back to the main DB",
  );
}

const sql = neon(url);
export const sqlDemoDb = drizzle({ client: sql });
