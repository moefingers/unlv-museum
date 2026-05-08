# Database

## Provider

Neon PostgreSQL (project: `quiet-cell-88302228`).

## Driver

`@neondatabase/serverless` with HTTP driver via `neon()`. Same as zcanon — no transaction support, lighter cold start. If multi-table atomicity is needed later, switch to WebSocket driver.

## Schema Organization

One database, multiple PostgreSQL schemas:

| Schema           | Purpose                                                |
| ---------------- | ------------------------------------------------------ |
| `public`         | Better Auth tables (user, session, account, rateLimit) |
| `gwhac_a_mole`   | Leaderboard scores                                     |
| `rest_rant`      | Places and reviews                                     |
| `commerce`       | Products, orders, order items                          |
| `enterprize`     | Entities and audit log                                 |
| `divvy`          | Receipts, items, people, assignments                   |
| `music_tour`     | Bands and events                                       |
| `petfax`         | Pets and facts                                         |
| `stock_charts`   | Watchlist                                              |
| `github_commits` | Commit snapshots                                       |

Each schema is defined via Drizzle's `pgSchema()` in `src/lib/schema/`.

## ORM

Drizzle ORM with `drizzle-kit` for migrations. Config in `drizzle.config.ts` points to `src/lib/schema/*.ts`.

## Connection

Single `db` instance in `src/lib/db.ts`. Uses `DATABASE_URL` env var.
