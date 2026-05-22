import {
  pgSchema,
  smallserial,
  text,
  smallint,
  timestamp,
  jsonb,
  bigserial,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Music Tour API — faithful Postgres translation of the original UNLV
 * Sequelize exercise (`moefingers/SQL-Music-Tour-API`).
 *
 * Six tables, mirroring the source's `models/` directory:
 *
 *   bands ← (1:M) → meet_greets ← (M:1) → events
 *   bands ← (1:M) → set_times   ← (M:1) → events
 *                                 ↑
 *                               (M:1)
 *                                 ↓
 *                               stages ← (M:M via stage_events) → events
 *
 * Original used Sequelize with SMALLINT primary keys, `timestamps: false`,
 * and resource-specific column names (`band_id`, `event_id`, `stage_id`)
 * matching the model's own primary-key column. Drizzle's TypeScript field
 * names use camelCase but the database columns preserve the source's
 * snake_case identifiers exactly.
 *
 * Source lookups go BY NAME (not id) — `GET /bands/Coldplay` returns the
 * band's row with nested meet_greets + set_times → events. The museum's
 * routes preserve that pattern; mutating endpoints (PUT/DELETE) still
 * take an integer id in the same URL slot, mirroring the original's
 * routing quirk.
 */
export const musicTourSchema = pgSchema("music_tour");

export const bands = musicTourSchema.table("bands", {
  bandId: smallserial("band_id").primaryKey(),
  name: text("name").notNull(),
  genre: text("genre").notNull(),
  availableStartTime: timestamp("available_start_time", {
    withTimezone: true,
  }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
});

export const events = musicTourSchema.table("events", {
  eventId: smallserial("event_id").primaryKey(),
  name: text("name").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
});

export const stages = musicTourSchema.table("stages", {
  stageId: smallserial("stage_id").primaryKey(),
  stageName: text("stage_name").notNull(),
});

/** M:M between bands and events (the meet-and-greet sessions per event). */
export const meetGreets = musicTourSchema.table("meet_greets", {
  meetGreetId: smallserial("meet_greet_id").primaryKey(),
  eventId: smallint("event_id")
    .notNull()
    .references(() => events.eventId, { onDelete: "cascade" }),
  bandId: smallint("band_id")
    .notNull()
    .references(() => bands.bandId, { onDelete: "cascade" }),
  meetStartTime: timestamp("meet_start_time", {
    withTimezone: true,
  }).notNull(),
  meetEndTime: timestamp("meet_end_time", { withTimezone: true }).notNull(),
});

/** Three-way junction: which band plays which stage at which event, when. */
export const setTimes = musicTourSchema.table("set_times", {
  setTimeId: smallserial("set_time_id").primaryKey(),
  eventId: smallint("event_id")
    .notNull()
    .references(() => events.eventId, { onDelete: "cascade" }),
  stageId: smallint("stage_id")
    .notNull()
    .references(() => stages.stageId, { onDelete: "cascade" }),
  bandId: smallint("band_id")
    .notNull()
    .references(() => bands.bandId, { onDelete: "cascade" }),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
});

/** Pure M:M junction between stages and events. */
export const stageEvents = musicTourSchema.table("stage_events", {
  stageEventsId: smallserial("stage_events_id").primaryKey(),
  stageId: smallint("stage_id")
    .notNull()
    .references(() => stages.stageId, { onDelete: "cascade" }),
  eventId: smallint("event_id")
    .notNull()
    .references(() => events.eventId, { onDelete: "cascade" }),
});

/**
 * Audit log — every mutation on this schema's tables, written by both
 * the Original-tier (/api/music-tour/*) and Enhanced-tier
 * (/api/v2/music-tour/*) handlers via the shared audit helper. Read
 * through the Enhanced-tier endpoint `GET /api/v2/music-tour/audit-log`.
 *
 * Shape mirrors jaskis.audit_log — see
 * memory: project_enhanced_api_conventions.md.
 */
export const auditLog = musicTourSchema.table("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
  /** Denormalized for audit-log queries to avoid joining auth.user on every read. */
  actorLogin: text("actor_login"),
  /** Table name within music_tour schema (e.g. "bands", "events", "stages"). */
  collection: text("collection").notNull(),
  /** "insertOne" | "updateOne" | "deleteOne" | "insertMany" (batch) | "updateMany" (batch). */
  op: text("op").notNull(),
  /** "original" | "enhanced" — which URL prefix the visitor hit. */
  tier: text("tier").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
});
