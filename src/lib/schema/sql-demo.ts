import {
  pgSchema,
  serial,
  text,
  timestamp,
  jsonb,
  bigserial,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * SQL Injection Demo schema.
 *
 * The `users` table is a PEDAGOGICAL FIXTURE — its rows are demo seeds
 * the visitor queries via the deliberately-vulnerable login form, NOT
 * a museum-identity surface. Per CONTEXT/internal_docs/identity-and-
 * signup.md, the museum-session gate still applies to the whole
 * project's mutation routes (you must be GitHub-signed-in to even
 * reach the demo) but the `museum_user_id` FK isn't required because
 * these rows aren't identities — they're queryable artifacts.
 *
 * The `audit_log` table records every login attempt with the visitor's
 * GitHub login, the submitted payload, and the outcome. The pedagogy
 * survives: SQL injection still works against the vulnerable query,
 * but the museum has a permanent record of who tried it and what they
 * sent.
 *
 * Important: only the audit_log table is written by the main db
 * client (full privileges). The vulnerable demo query runs through
 * `sqlDemoDb` which has SELECT-only on `users` and NO access to
 * `audit_log` — even a successful UNION-SELECT injection can't read
 * or tamper with the audit history.
 */
export const sqlDemoSchema = pgSchema("sql_demo");

/**
 * Demo fixtures. The route doesn't use this Drizzle binding (it issues
 * raw SQL strings) but declaring the table here gives the audit-log
 * read endpoint and any future migrations a type to point at.
 */
export const users = sqlDemoSchema.table("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  role: text("role").notNull(),
});

/**
 * Audit log — every POST attempt against /api/sql-demo/* lands a row
 * here, BEFORE the query runs. The row records the museum-session
 * actor + the submitted username/password (yes, even attempted
 * passwords — this is a pedagogical demo where the fixture passwords
 * are PUBLIC by design, not real credentials). The `outcome` field
 * is updated post-query, or stays as "pending" if the query throws.
 *
 * Shape mirrors music_tour.audit_log + admin_portal.audit_log +
 * rest_rant.audit_log with the standard before/after JSONB columns
 * holding the demo-specific payload.
 */
export const auditLog = sqlDemoSchema.table("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
  actorLogin: text("actor_login"),
  /** Always "users" for this project; column kept for cross-schema consistency. */
  collection: text("collection").notNull(),
  /** "injectionAttempt" — the only op kind sql-demo emits. */
  op: text("op").notNull(),
  /** "original" | "enhanced" — which URL prefix the visitor hit. */
  tier: text("tier").notNull(),
  /** Always null for sql-demo (login isn't a state mutation). */
  before: jsonb("before"),
  /**
   * The submitted payload + the resolved outcome. Shape:
   *   { username, password, mode, surface, outcome, rowCount, error? }
   * - mode: "vulnerable" | "safe"
   * - surface: "json" (api-client) | "form" (visitor-facing iframe)
   * - outcome: "success" | "no_match" | "query_error"
   *
   * The submitted password IS stored here because the fixture
   * passwords are public demo seeds — this is the only project in
   * the museum where storing password-shaped strings in the audit
   * log is correct rather than a leak. Real-identity projects
   * (rest-rant) NEVER store passwords in audit; see those routes.
   */
  after: jsonb("after"),
});
