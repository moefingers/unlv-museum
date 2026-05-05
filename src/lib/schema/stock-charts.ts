import { pgSchema, serial, text, timestamp } from "drizzle-orm/pg-core";

export const stockChartsSchema = pgSchema("stock_charts");

export const watchlist = stockChartsSchema.table("watchlist", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull().unique(),
  name: text("name").notNull(),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});
