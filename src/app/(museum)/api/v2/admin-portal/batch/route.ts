/**
 * /api/v2/admin-portal/batch — Enhanced-tier compound writes.
 *
 *   POST /batch
 *   Body: {
 *     ops: [
 *       { method: "POST",   path: "/books",     body: {...} },
 *       { method: "PATCH",  path: "/books/42",  body: {...} },
 *       { method: "DELETE", path: "/books/3" },
 *       ...
 *     ]
 *   }
 *
 * Runs every op in a single Postgres transaction. Either all succeed
 * (one audit row per op, tier="enhanced", actor=session.user) or all
 * roll back. Returns `{ results: [...] }` with one entry per op in
 * the order they were submitted.
 *
 * REST-shaped paths only — `/books` and `/books/:id`. The v1 verb-
 * prefixed paths (`/addBook`, `/updateBook`, `/removeBook/:id`) are
 * intentionally NOT supported here: batch is an Enhanced-only surface,
 * so it speaks the Enhanced REST shape.
 *
 * Scope (intentionally limited):
 *   - Methods: POST (create), PATCH /<id> (update), DELETE /<id> (delete)
 *   - Max 50 ops per request
 *   - No nested batches
 *
 * Sign-in required (same as any mutation route). Audit rows record
 * each individual op + the writer.
 */

// The batch endpoint needs real transactionality — `db` from /lib/db
// uses neon-http which can't do db.transaction(). dbTx wraps the
// WebSocket-pool driver which supports BEGIN/COMMIT. See lib/db-tx.ts.
import { dbTx as db } from "@/lib/db-tx";
import { auditLog, books } from "../../../admin-portal/_schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/api-guard";

type Method = "POST" | "PATCH" | "DELETE";

interface BatchOp {
  method: Method;
  path: string;
  body?: Record<string, unknown>;
}

interface BatchRequest {
  ops?: BatchOp[];
}

/**
 * Parse a single op's `path` field. Returns { id? } or null if the path
 * doesn't match.
 *   /books      → { id: null }
 *   /books/42   → { id: 42 }
 */
function parsePath(path: string): { id: number | null } | null {
  const m = path.match(/^\/books(?:\/(\d+))?\/?$/);
  if (!m) return null;
  return { id: m[1] ? parseInt(m[1], 10) : null };
}

export async function POST(request: Request) {
  const guard = await guardMutation(request);
  if (guard.response) return guard.response;

  let payload: BatchRequest;
  try {
    payload = (await request.json()) as BatchRequest;
  } catch {
    return NextResponse.json(
      { error: "request body must be valid JSON" },
      { status: 400 },
    );
  }
  const ops = payload.ops;
  if (!Array.isArray(ops) || ops.length === 0) {
    return NextResponse.json(
      { error: "ops[] required and must be non-empty" },
      { status: 400 },
    );
  }
  if (ops.length > 50) {
    return NextResponse.json(
      { error: "batch limit is 50 ops per request" },
      { status: 400 },
    );
  }

  try {
    const results = await db.transaction(async (tx) => {
      const out: unknown[] = [];
      const pendingAudits: {
        op: "insertOne" | "updateOne" | "deleteOne";
        before: unknown;
        after: unknown;
      }[] = [];

      for (let i = 0; i < ops.length; i++) {
        const op = ops[i]!;
        if (
          op.method !== "POST" &&
          op.method !== "PATCH" &&
          op.method !== "DELETE"
        ) {
          throw new Error(
            `op ${i}: method must be POST | PATCH | DELETE (got '${op.method}')`,
          );
        }
        const parsed = parsePath(op.path);
        if (!parsed) {
          throw new Error(
            `op ${i}: path '${op.path}' doesn't match — expected /books or /books/<id>`,
          );
        }

        if (op.method === "POST" && parsed.id === null) {
          // Create.
          const b = (op.body ?? {}) as Partial<{
            title: string;
            description: string;
            year: string;
            quantity: number | string;
            imageURL: string;
          }>;
          if (!b.title) throw new Error(`op ${i}: books create needs 'title'`);
          if (!b.description)
            throw new Error(`op ${i}: books create needs 'description'`);
          if (
            b.quantity === undefined ||
            b.quantity === null ||
            b.quantity === ""
          )
            throw new Error(`op ${i}: books create needs 'quantity'`);

          const quantityNum =
            typeof b.quantity === "string"
              ? parseInt(b.quantity, 10) || 0
              : b.quantity;

          const [row] = await tx
            .insert(books)
            .values({
              title: b.title.slice(0, 200),
              description: b.description.slice(0, 500),
              year: b.year?.slice(0, 10) ?? null,
              quantity: quantityNum,
              imageUrl: b.imageURL?.slice(0, 500) ?? null,
            })
            .returning();
          const { imageUrl, ...rest } = row!;
          out.push({ ...rest, imageURL: imageUrl });
          pendingAudits.push({ op: "insertOne", before: null, after: row });
        } else if (op.method === "PATCH" && parsed.id !== null) {
          const b = (op.body ?? {}) as Partial<{
            title: string;
            description: string;
            year: string;
            quantity: number | string;
            imageURL: string;
          }>;
          const [before] = await tx
            .select()
            .from(books)
            .where(eq(books.id, parsed.id));
          if (!before) {
            throw new Error(
              `op ${i}: could not find a book with id ${parsed.id}`,
            );
          }
          const quantityNum =
            b.quantity === undefined || b.quantity === null
              ? undefined
              : typeof b.quantity === "string"
                ? parseInt(b.quantity, 10)
                : b.quantity;

          const set: Record<string, unknown> = {};
          if (b.title !== undefined) set.title = b.title.slice(0, 200);
          if (b.description !== undefined)
            set.description = b.description.slice(0, 500);
          if (b.year !== undefined) set.year = b.year.slice(0, 10);
          if (quantityNum !== undefined && !Number.isNaN(quantityNum))
            set.quantity = quantityNum;
          if (b.imageURL !== undefined) set.imageUrl = b.imageURL.slice(0, 500);

          const [after] = Object.keys(set).length
            ? await tx
                .update(books)
                .set(set)
                .where(eq(books.id, parsed.id))
                .returning()
            : [before];

          const { imageUrl, ...rest } = after!;
          out.push({ ...rest, imageURL: imageUrl });
          if (Object.keys(set).length) {
            pendingAudits.push({ op: "updateOne", before, after });
          }
        } else if (op.method === "DELETE" && parsed.id !== null) {
          const [before] = await tx
            .select()
            .from(books)
            .where(eq(books.id, parsed.id));
          if (!before) {
            throw new Error(
              `op ${i}: could not find a book with id ${parsed.id}`,
            );
          }
          await tx.delete(books).where(eq(books.id, parsed.id));
          out.push({
            ...Object.fromEntries(
              Object.entries(before).filter(([k]) => k !== "imageUrl"),
            ),
            imageURL: before.imageUrl,
          });
          pendingAudits.push({ op: "deleteOne", before, after: null });
        } else {
          throw new Error(
            `op ${i}: unsupported method+path combo — method=${op.method}, path=${op.path}`,
          );
        }
      }

      // Audit rows go inside the same transaction so they roll back together.
      for (const a of pendingAudits) {
        await tx.insert(auditLog).values({
          actorId: guard.actor.id,
          actorLogin: guard.actor.login,
          collection: "books",
          op: a.op,
          tier: guard.tier,
          before: a.before as never,
          after: a.after as never,
        });
      }

      return out;
    });

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      {
        error: "batch failed; all ops rolled back",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 400 },
    );
  }
}
