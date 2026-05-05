import {
  pgSchema,
  serial,
  text,
  integer,
  date,
  timestamp,
} from "drizzle-orm/pg-core";

export const musicTourSchema = pgSchema("music_tour");

export const bands = musicTourSchema.table("bands", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  genre: text("genre").notNull(),
  formedYear: integer("formed_year"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const events = musicTourSchema.table("events", {
  id: serial("id").primaryKey(),
  bandId: integer("band_id")
    .notNull()
    .references(() => bands.id, { onDelete: "cascade" }),
  venue: text("venue").notNull(),
  city: text("city").notNull(),
  date: date("date").notNull(),
  ticketPriceCents: integer("ticket_price_cents"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
