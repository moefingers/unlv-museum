/**
 * Transaction-capable Drizzle client backed by the Neon WebSocket pool.
 *
 * The main `src/lib/db.ts` uses `drizzle-orm/neon-http`, which speaks
 * Neon's HTTP fetch endpoint. That driver is excellent for short reads
 * + single-statement writes (lowest cold-start cost) but it does NOT
 * support `db.transaction()` — every statement is its own HTTP
 * request. Try to call `db.transaction()` on it and you get
 * `"No transactions support in neon-http driver"`.
 *
 * For the `/api/v2/music-tour/batch` endpoint (and any future
 * compound-write surfaces) we need real transactional semantics:
 * either all ops commit or all roll back. The WebSocket-pool driver
 * from `drizzle-orm/neon-serverless` supports this.
 *
 * Don't reach for `dbTx` from anywhere else unless you genuinely need
 * a transaction. The WebSocket connection has higher cold-start
 * overhead than the HTTP driver, so single-statement routes should
 * stick with `db` from `src/lib/db.ts`.
 */

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const dbTx = drizzle({ client: pool });
