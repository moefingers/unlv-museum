import {
  pgSchema,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const restRantSchema = pgSchema("rest_rant");

export const users = restRantSchema.table("users", {
  id: serial("id").primaryKey(),
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
