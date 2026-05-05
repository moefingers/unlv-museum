import {
  pgSchema,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const githubCommitsSchema = pgSchema("github_commits");

export const snapshots = githubCommitsSchema.table("snapshots", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  totalCommits: integer("total_commits").notNull(),
  reposChecked: integer("repos_checked").notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
