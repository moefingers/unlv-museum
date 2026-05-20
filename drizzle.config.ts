import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/schema/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Per-project schemas live alongside `public`. Without this list,
  // drizzle-kit only diffs `public` and silently skips every other
  // pgSchema() declaration in our schema files — `db:push` reports
  // "no changes" even when, e.g., a brand-new jaskis schema needs
  // to be created.
  //
  // `auth` and `public` are intentionally omitted: Better Auth
  // manages those tables (it puts its `users` / `sessions` / etc.
  // in `public`, and there's known drift between the museum-side
  // schema file and the live DB that we don't want to surface as
  // a db:push diff every time). The auth schema file exists for
  // the app's TypeScript reads; migrations there go through
  // Better Auth, not drizzle-kit.
  schemaFilter: [
    "commerce",
    "divvy",
    "enterprize",
    "github_commits",
    "gwhac_a_mole",
    "jaskis",
    "music_tour",
    "petfax",
    "rest_rant",
    "stock_charts",
  ],
});
