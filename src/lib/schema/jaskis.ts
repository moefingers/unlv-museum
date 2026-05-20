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

/**
 * JASKIS — Postgres translation of the original MongoDB bounties exercise.
 *
 * Source (`moefingers/API-JASKIS`): `commands.js` defines a MongoDB shell
 * tutorial around a `bounties` collection with the shape:
 *
 *   { name, species, location, wantedFor, client, reward, captured }
 *
 * The original exercise wasn't an HTTP API — it was a MongoDB-shell tutorial.
 * The museum surfaces it at /mongo-client, where visitors type real Mongo
 * shell commands and a small parser/translator runs the equivalent operations
 * against this Postgres table.
 *
 * Field-name parity with the source: camelCase Mongo attributes map to
 * snake_case Postgres columns via Drizzle, then the museum's translator
 * presents results back to the shell using the camelCase keys.
 *
 * Why Postgres and not Mongo: the museum standardizes on Neon Postgres for
 * every backend port — one DB, one driver, one schema-management story. The
 * data shape is preserved; only the storage substrate differs.
 */
export const jaskisSchema = pgSchema("jaskis");

export const bounties = jaskisSchema.table("bounties", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  species: text("species").notNull(),
  location: text("location").notNull(),
  wantedFor: text("wanted_for").notNull(),
  client: text("client").notNull(),
  reward: integer("reward").notNull(),
  captured: boolean("captured").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Audit log — every mutation on `bounties`, regardless of which tier the
 * mutation came through. The Reimagined-tier surface exposes this as the
 * `auditLog` collection (read-only). The pattern is generic enough that
 * later backend ports can either FK to this table or follow the same shape
 * per schema.
 *
 * `op` is one of: "insertOne", "insertMany", "updateOne", "updateMany",
 * "deleteOne", "deleteMany". The actor is the GitHub-authenticated user
 * who performed the write (sign-in required for writes on both tiers, so
 * actor_id is never null in practice — kept nullable only for migration
 * compatibility / system-seeded rows).
 *
 * `tier` records which museum surface the write came from — "original" or
 * "reimagined". Useful for Reimagined-tier audit queries that want to see
 * which writes originated where.
 *
 * `before` / `after` are JSONB snapshots of the affected document(s). For
 * insertX they record only `after`; for deleteX only `before`; for updateX
 * both. For *Many variants the snapshots are arrays.
 */
export const auditLog = jaskisSchema.table("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
  /** Denormalized for audit-log queries to avoid joining auth.user on every read. */
  actorLogin: text("actor_login"),
  collection: text("collection").notNull(),
  op: text("op").notNull(),
  tier: text("tier").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
});
