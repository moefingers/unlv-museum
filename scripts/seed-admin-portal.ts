/**
 * Seed admin_portal.books from the canonical source-repo db.json verbatim.
 *
 * The seed script exists only because we use neondb instead of the flat
 * db.json the original Express server reads — it's a hosting bridge, not
 * a departure from the source. The source repo's db.json IS the canonical
 * book list (typos, throwaway test rows, and all).
 *
 * Idempotent: wipes admin_portal.books first, then inserts.
 *
 * Usage:  pnpm seed:admin-portal
 *
 * Loads DATABASE_URL from .env.local via tsx's --env-file flag (see
 * package.json "seed:admin-portal" script).
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { db } from "../src/lib/db";
import { books } from "../src/app/(museum)/api/admin-portal/_schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const DB_JSON_PATH = resolve(
  projectRoot,
  ".sources/JS-Building-an-Admin-Portal/db.json",
);

interface SourceBook {
  id: number;
  title: string;
  description?: string;
  year?: string | number;
  quantity?: string | number;
  imageURL?: string;
}

/**
 * Translate a source-repo imageURL to the museum-hosted equivalent. The
 * museum mounts the source repo's `public/` at /originals/admin-portal/,
 * so `/assets/foo.jpg` from db.json becomes `/originals/admin-portal/assets/foo.jpg`
 * here. External URLs (e.g. libreshot) pass through untouched.
 */
function museumImageUrl(src: string | undefined): string | null {
  if (!src) return null;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  if (src.startsWith("/")) return `/originals/admin-portal${src}`;
  return `/originals/admin-portal/${src}`;
}

function toIntOrNull(v: string | number | undefined): number | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return Math.trunc(v);
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const raw = JSON.parse(readFileSync(DB_JSON_PATH, "utf8")) as {
    books: SourceBook[];
  };

  const rows = raw.books.map((b) => ({
    id: b.id,
    title: b.title,
    description: b.description ?? null,
    year: b.year === undefined ? null : String(b.year),
    quantity: toIntOrNull(b.quantity) ?? 0,
    imageUrl: museumImageUrl(b.imageURL),
  }));

  console.log(
    `[seed:admin-portal] sourcing ${rows.length} rows from ${DB_JSON_PATH}`,
  );

  await db.delete(books);
  console.log("[seed:admin-portal] wiped admin_portal.books");

  await db.insert(books).values(rows);
  console.log(`[seed:admin-portal] inserted ${rows.length} rows`);

  const maxId = Math.max(...rows.map((r) => r.id));
  await db.execute(
    sql`SELECT setval(pg_get_serial_sequence('admin_portal.books', 'id'), ${maxId}, true)`,
  );
  console.log(`[seed:admin-portal] sequence reset to ${maxId}`);
  console.log("[seed:admin-portal] done.");
}

main().catch((err) => {
  console.error("[seed:admin-portal] failed:", err);
  process.exit(1);
});
