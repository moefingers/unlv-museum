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
} from "drizzle-orm/pg-core";

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
