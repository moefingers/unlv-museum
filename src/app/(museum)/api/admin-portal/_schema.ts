/**
 * Shared schema for the admin-portal book routes. Endpoint paths mirror
 * the original Express server (server.js):
 *
 *   GET    /api/admin-portal/listBooks
 *   POST   /api/admin-portal/addBook
 *   PATCH  /api/admin-portal/updateBook       (id in request body)
 *   DELETE /api/admin-portal/removeBook/:id
 *
 * URL prefix is the museum's only deviation from the original — every
 * other route shape matches the source so admin.js/index.js work byte-
 * faithful after the host-substitution.
 */
import {
  pgSchema,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  bigserial,
} from "drizzle-orm/pg-core";
import { user } from "@/lib/schema/auth";

const schema = pgSchema("admin_portal");

export const books = schema.table("books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  year: text("year"),
  quantity: integer("quantity").default(0),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Audit log — every mutation on this schema's tables, written by both
 * the Original-tier (/api/admin-portal/*) and Enhanced-tier
 * (/api/v2/admin-portal/*) handlers via the shared audit helper. Read
 * through the Enhanced-tier endpoint `GET /api/v2/admin-portal/audit-log`.
 *
 * Shape mirrors music_tour.audit_log and jaskis.audit_log — see
 * memory: project_enhanced_api_conventions.md.
 */
export const auditLog = schema.table("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
  /** Denormalized for audit-log queries to avoid joining auth.user on every read. */
  actorLogin: text("actor_login"),
  /** Table name within admin_portal schema (currently always "books"). */
  collection: text("collection").notNull(),
  /** "insertOne" | "updateOne" | "deleteOne" | "insertMany" (batch) | "updateMany" (batch). */
  op: text("op").notNull(),
  /** "original" | "enhanced" — which URL prefix the visitor hit. */
  tier: text("tier").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
});
