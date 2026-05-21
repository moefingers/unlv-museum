import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { books } from "../_schema";

/**
 * Mirrors the original Express `GET /listBooks` from server.js: returns
 * whatever's in storage with the source's wire shape — `imageURL`
 * (capitalized, like the source's db.json). The Drizzle column is
 * `imageUrl`; we rename only at the response boundary.
 *
 * The source returned exactly what was in `db.json` for each book;
 * fields that weren't set were absent (or null). The museum matches:
 * no synthesis, no fallbacks. A book inserted via POST /addBook with
 * no imageURL stays imageless on the wire. The original admin.js
 * handles imageless rows by skipping the <img> render, and that's the
 * source's actual behavior preserved verbatim.
 *
 * If you want auto-generated cover art, that goes on the Enhanced or
 * Reimagined tier — Original stays a faithful reflection of the
 * source's data flow.
 */
export async function GET() {
  const all = await db.select().from(books).orderBy(desc(books.createdAt));
  return NextResponse.json(
    all.map(({ imageUrl, ...rest }) => ({
      ...rest,
      imageURL: imageUrl,
    })),
  );
}
