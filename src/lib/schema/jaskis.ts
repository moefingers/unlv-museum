import {
  pgSchema,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * JASKIS — Postgres translation of the original MongoDB bounties collection.
 *
 * Source (`moefingers/API-JASKIS`): `commands.js` defines a MongoDB shell
 * exercise around a `bounties` collection with the shape:
 *
 *   { name, species, location, wantedFor, client, reward, captured }
 *
 * The original exercise wasn't an HTTP API — it was a MongoDB-shell
 * tutorial. The museum's port surfaces it as a REST endpoint so visitors
 * can interact with the same data shape via the api-client.
 *
 * Field-name parity with the source (camelCase MongoDB attribute → snake_case
 * Postgres column via Drizzle's column mapping; the API surface stays
 * camelCase via Drizzle's TypeScript field names).
 *
 * Why Postgres and not Mongo: the museum standardizes on Neon Postgres
 * for every backend port — one DB, one driver, one schema-management
 * story. The data shape is preserved; only the storage substrate differs.
 * Documented as a "minor adjustment" per the museum-ready policy.
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
