import {
  pgSchema,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  bigserial,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const restRantSchema = pgSchema("rest_rant");

export const users = restRantSchema.table("users", {
  id: serial("id").primaryKey(),
  /**
   * FK to auth.user(id), non-nullable. Locks every project-level
   * user to a museum-authenticated GitHub identity. See
   * CONTEXT/internal_docs/identity-and-signup.md for the full
   * contract — login is three-factor (email + password + matching
   * museum_user_id), not two.
   */
  museumUserId: text("museum_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  passwordDigest: text("password_digest").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const places = restRantSchema.table("places", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull().default("Anytown"),
  state: text("state").notNull().default("USA"),
  cuisines: text("cuisines").notNull(),
  pic: text("pic"),
  founded: integer("founded"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const comments = restRantSchema.table("comments", {
  id: serial("id").primaryKey(),
  placeId: integer("place_id")
    .notNull()
    .references(() => places.id, { onDelete: "cascade" }),
  authorId: integer("author_id").references(() => users.id, {
    onDelete: "set null",
  }),
  authorName: text("author_name"),
  content: text("content").notNull(),
  stars: integer("stars").notNull(),
  rant: boolean("rant").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Audit log — every mutation on this schema's tables, written by both
 * the Original-tier (/api/rest-rant/*) and Enhanced-tier
 * (/api/v2/rest-rant/*) handlers via the shared audit helper. Read
 * through the Enhanced-tier endpoint `GET /api/v2/rest-rant/audit-log`.
 *
 * Shape mirrors music_tour.audit_log and admin_portal.audit_log — see
 * memory: project_enhanced_api_conventions.md.
 *
 * actor_login here records the GitHub login of the museum visitor
 * making the mutation, NOT the rest-rant in-app user identity. The
 * museum carve-out is "you must be GitHub-signed-in to mutate"; the
 * rest-rant signup/login still happens INSIDE that authenticated
 * context (and writes to users + comments.authorId stay scoped to
 * the rest-rant identity). Both layers coexist.
 */
export const auditLog = restRantSchema.table("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
  /** Denormalized GitHub login (museum-session actor). */
  actorLogin: text("actor_login"),
  /** Table name within rest_rant schema: "users" | "places" | "comments". */
  collection: text("collection").notNull(),
  /**
   * Event kind. Standard mutations + login-specific:
   * "insertOne" | "updateOne" | "deleteOne" | "insertMany" |
   * "loginAttempt" | "loginSuccess".
   */
  op: text("op").notNull(),
  /** "original" | "enhanced". */
  tier: text("tier").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
});
