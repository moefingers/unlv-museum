import {
  pgSchema,
  serial,
  text,
  integer,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const enterprizeSchema = pgSchema("enterprize");

export const entities = enterprizeSchema.table("entities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  parentId: integer("parent_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const auditLog = enterprizeSchema.table("audit_log", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entities.id),
  action: text("action").notNull(),
  actor: text("actor").notNull(),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
