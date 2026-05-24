/**
 * Drizzle schema for the quirk-truck Enhanced tier (EnterPrize era,
 * museum-ready/enhanced on moefingers/h-data — pinned `enterprize`
 * branch at commit ad752374, 2024-07-06).
 *
 * The original EnterPrize ran a hybrid storage model:
 *   • Postgres (Prisma) — `users`, `work_orders`, `audit_logs`
 *   • Vercel KV — single `'pages'` JSON document with JSONPath
 *     mutations for the entire pages/sections nested tree
 *   • Vercel Blob — section/page image uploads
 *
 * The museum-ready/enhanced port collapses all three onto Neon:
 *   • Postgres tables for users/work-orders/audit
 *   • `documents` table with a single `key='pages'` row holding the
 *     nested tree as `jsonb` — preserves the original actions.ts
 *     mutation logic almost line-for-line by swapping `kv.json.*`
 *     for `jsonb_set` / `#-` operators on this row.
 *   • `images` table with bytea bodies; clients pre-compress to webp
 *     via `<canvas>.toBlob('image/webp', 0.75)` before upload, so
 *     typical 1024px thumbnails land at 30–80 KB and even an entire
 *     page of images is single-digit MB. Sized for the museum demo,
 *     not for production-scale media; if it ever needs to scale, the
 *     `images` table is the single swap point to external storage.
 *
 * See CONTEXT/temp/enterprize-revival-punchlist.md for the surgery
 * sequence and CONTEXT/internal_docs/identity-and-signup.md for the
 * museum_user_id FK contract.
 */

import {
  pgSchema,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  bigserial,
  uuid,
  customType,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const quirkTruckEnhancedSchema = pgSchema("quirk_truck_enhanced");

/**
 * Postgres `bytea`. Drizzle's `bytea()` shipped in newer versions; the
 * customType keeps this self-contained against the schema's pinned
 * Drizzle version and documents intent at the call site.
 */
const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return "bytea";
  },
});

/**
 * Project-level user. The EnterPrize era had Google SSO and a local
 * password — the Enhanced port drops Google entirely (museum identity
 * is GitHub-only per the canonical convention) and locks every account
 * to a museum-authenticated GitHub session via `museum_user_id`. Login
 * is three-factor (email + password + matching museum_user_id); see
 * identity-and-signup.md.
 *
 * TODO(surgery): once the GitHub-museum-OAuth bridge is wired in
 * auth.ts, the standalone `password` column becomes optional — most
 * users would auth purely via the museum session passthrough, with
 * a password only required for the work-order signature flow (which
 * needs an explicit re-confirmation factor anyway). Decide whether
 * to keep `password` notNull or relax to nullable as part of the
 * passthrough refactor.
 */
export const users = quirkTruckEnhancedSchema.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  museumUserId: text("museum_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  admin: boolean("admin").notNull().default(false),
  /**
   * Multi-role array — EnterPrize defined 5 non-admin roles:
   * page-manager, credential-manager, change-name, audit-logs,
   * work-orders. Stored as a text[] so the original role-membership
   * checks (`role.includes('page-manager')`) port cleanly.
   */
  roles: text("roles").array().notNull().default([]),
  imageId: uuid("image_id").references((): any => images.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Joined image table — replaces `@vercel/blob`. Bytes stored inline
 * as `bytea`; clients compress to webp before upload so the typical
 * row size stays small (30–80 KB at 1024px wide, q=0.75). Served by
 * `/api/v2/quirk-truck-enhanced/images/[id]` with a long Cache-Control
 * because the id is immutable.
 *
 * `owner_user_id` is the uploader. Refcount-based GC happens by
 * inspecting which rows in `documents` / `users` reference the id —
 * an unreferenced image with no recent owner activity is a candidate
 * for cleanup, but the museum-Enhanced demo doesn't need a sweeper
 * to ship.
 */
export const images = quirkTruckEnhancedSchema.table("images", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: uuid("owner_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  mime: text("mime").notNull().default("image/webp"),
  bytes: bytea("bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Single-row key/value store for the pages tree — the museum-ready
 * port of the original KV `'pages'` JSON document. Every page+section
 * mutation in the original `actions.ts` was a `kv.json.set/get/del`
 * with a JSONPath expression; the same logic ports here as
 * `jsonb_set` / `jsonb_path_query` against the `data` column of the
 * `key='pages'` row.
 *
 * The table is general-purpose (any `key`), but the EnterPrize port
 * uses exactly one row. Future ports of similar projects can share
 * this shape.
 */
export const documents = quirkTruckEnhancedSchema.table("documents", {
  key: text("key").primaryKey(),
  data: jsonb("data").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Work-order statuses — EnterPrize used these for multi-signature
 * admin actions. Kept as a text column rather than a pg enum so the
 * column type can grow without a migration; the literal-union type
 * lives in the API layer.
 *
 * Valid: "needs_signatures" | "amended_pending_user_confirmation" |
 *        "rejected_by_admin" | "cancelled_by_user" | "completed".
 */
export const workOrders = quirkTruckEnhancedSchema.table("work_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: text("status").notNull().default("needs_signatures"),
  summary: text("summary"),
  action: text("action"),
  data: jsonb("data"),
  /**
   * Role gates required to assign/sign. Nested array semantics from
   * the original schema: outer array is OR, inner array is AND.
   * Example: `[["credential-manager","page-manager"], ["admin"]]`
   * means "(credential-manager AND page-manager) OR admin".
   */
  requiredRoles: jsonb("required_roles"),
  requiredSignatureCount: integer("required_signature_count")
    .notNull()
    .default(1),
  signatureList: text("signature_list").array().notNull().default([]),
  requesterId: uuid("requester_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  requesterName: text("requester_name").notNull(),
  assigneeId: uuid("assignee_id").references(() => users.id, {
    onDelete: "set null",
  }),
  assigneeName: text("assignee_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Audit log — standard Enhanced-tier shape mirroring rest_rant,
 * music_tour, admin_portal, jaskis. Every mutation across `users`,
 * `documents`, `images`, `work_orders` records here with the actor's
 * museum identity (GitHub login).
 *
 * `actor_id` is the museum-session user (auth.user.id); `actor_login`
 * is the denormalized GitHub login for quick reading without a join.
 * `tier` is always "enhanced" for this schema — there's no `original`
 * tier writing here (the original EnterPrize wrote its own
 * `audit_logs` table, preserved on the `enterprize` branch but not
 * mirrored to museum-side).
 */
export const auditLog = quirkTruckEnhancedSchema.table("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
  actorLogin: text("actor_login"),
  /** Table name within quirk_truck_enhanced schema. */
  collection: text("collection").notNull(),
  /**
   * Event kind. Standard mutations + work-order workflow:
   * "insertOne" | "updateOne" | "deleteOne" |
   * "workOrderRequested" | "workOrderSigned" | "workOrderCompleted" |
   * "loginAttempt" | "loginSuccess".
   */
  op: text("op").notNull(),
  tier: text("tier").notNull().default("enhanced"),
  before: jsonb("before"),
  after: jsonb("after"),
});
