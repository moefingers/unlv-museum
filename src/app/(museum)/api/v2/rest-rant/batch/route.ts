/**
 * /api/v2/rest-rant/batch — Enhanced-tier compound writes.
 *
 *   POST /batch
 *   Body: {
 *     ops: [
 *       { method: "POST",   path: "/places",                    body: {...} },
 *       { method: "POST",   path: "/places/42/comments",        body: {...} },
 *       { method: "PUT",    path: "/places/42",                 body: {...} },
 *       { method: "DELETE", path: "/places/42/comments/100" },
 *       { method: "DELETE", path: "/places/42" },
 *       ...
 *     ]
 *   }
 *
 * Runs every op in a single Postgres transaction. Either all succeed
 * (one audit row per op, tier="enhanced", actor=session.user) or all
 * roll back.
 *
 * Scope (intentionally limited):
 *   - Resources: places, comments (no users/auth — those are identity-
 *     bearing and shouldn't ride a compound write path)
 *   - Methods: POST (create), PUT /<id> (update place), DELETE /<id>
 *   - Max 50 ops per request
 *   - No nested batches
 *
 * Sign-in required (same as any mutation route). The identity-and-
 * signup contract still applies — but the only paths this endpoint
 * accepts are places + comments, neither of which touches `users`.
 */

import { dbTx as db } from "@/lib/db-tx";
import { auditLog, places, comments, users } from "@/lib/schema/rest-rant";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/api-guard";
import { serializePlace, serializeComment } from "@/lib/rest-rant";

type Method = "POST" | "PUT" | "DELETE";

interface BatchOp {
  method: Method;
  path: string;
  body?: Record<string, unknown>;
}

interface BatchRequest {
  ops?: BatchOp[];
}

/**
 * Parse a single op's `path` field. Recognized shapes:
 *   /places                          → places-collection create
 *   /places/42                       → places/:id update or delete
 *   /places/42/comments              → comments-collection create on a place
 *   /places/42/comments/100          → comments/:id delete on a place
 */
type Parsed =
  | { resource: "places"; id: null }
  | { resource: "places"; id: number }
  | { resource: "comments"; placeId: number; id: null }
  | { resource: "comments"; placeId: number; id: number };
function parsePath(path: string): Parsed | null {
  const placeCreate = path.match(/^\/places\/?$/);
  if (placeCreate) return { resource: "places", id: null };

  const placeId = path.match(/^\/places\/(\d+)\/?$/);
  if (placeId) return { resource: "places", id: parseInt(placeId[1]!, 10) };

  const commentCreate = path.match(/^\/places\/(\d+)\/comments\/?$/);
  if (commentCreate)
    return {
      resource: "comments",
      placeId: parseInt(commentCreate[1]!, 10),
      id: null,
    };

  const commentId = path.match(/^\/places\/(\d+)\/comments\/(\d+)\/?$/);
  if (commentId)
    return {
      resource: "comments",
      placeId: parseInt(commentId[1]!, 10),
      id: parseInt(commentId[2]!, 10),
    };

  return null;
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
        collection: string;
        op: "insertOne" | "updateOne" | "deleteOne";
        before: unknown;
        after: unknown;
      }[] = [];

      for (let i = 0; i < ops.length; i++) {
        const op = ops[i]!;
        if (
          op.method !== "POST" &&
          op.method !== "PUT" &&
          op.method !== "DELETE"
        ) {
          throw new Error(
            `op ${i}: method must be POST | PUT | DELETE (got '${op.method}')`,
          );
        }
        const parsed = parsePath(op.path);
        if (!parsed) {
          throw new Error(
            `op ${i}: path '${op.path}' doesn't match — expected /places, /places/<id>, /places/<id>/comments, or /places/<id>/comments/<id>`,
          );
        }

        if (
          op.method === "POST" &&
          parsed.resource === "places" &&
          parsed.id === null
        ) {
          const b = (op.body ?? {}) as Partial<{
            name: string;
            city: string;
            state: string;
            cuisines: string;
            pic: string;
            founded: number;
          }>;
          if (!b.name || !b.cuisines) {
            throw new Error(`op ${i}: places create needs name + cuisines`);
          }
          const [row] = await tx
            .insert(places)
            .values({
              name: b.name.slice(0, 200),
              city: b.city?.slice(0, 100) || "Anytown",
              state: b.state?.slice(0, 50) || "USA",
              cuisines: b.cuisines.slice(0, 200),
              pic: b.pic?.slice(0, 500) || "https://placebear.com/g/400/400",
              founded:
                typeof b.founded === "number" && b.founded > 0
                  ? b.founded
                  : null,
            })
            .returning();
          out.push(serializePlace(row!));
          pendingAudits.push({
            collection: "places",
            op: "insertOne",
            before: null,
            after: row,
          });
        } else if (
          op.method === "PUT" &&
          parsed.resource === "places" &&
          parsed.id !== null
        ) {
          const b = (op.body ?? {}) as Partial<{
            name: string;
            city: string;
            state: string;
            cuisines: string;
            pic: string;
            founded: number | null;
          }>;
          const patch: Record<string, string | number | null> = {};
          if (b.name !== undefined) patch.name = b.name.slice(0, 200);
          if (b.city !== undefined) patch.city = b.city.slice(0, 100);
          if (b.state !== undefined) patch.state = b.state.slice(0, 50);
          if (b.cuisines !== undefined)
            patch.cuisines = b.cuisines.slice(0, 200);
          if (b.pic !== undefined) patch.pic = b.pic.slice(0, 500);
          if (b.founded !== undefined)
            patch.founded =
              typeof b.founded === "number" && b.founded > 0 ? b.founded : null;
          const [before] = await tx
            .select()
            .from(places)
            .where(eq(places.id, parsed.id));
          if (!before) {
            throw new Error(
              `op ${i}: could not find place with id ${parsed.id}`,
            );
          }
          if (Object.keys(patch).length === 0) {
            out.push(serializePlace(before));
          } else {
            const [after] = await tx
              .update(places)
              .set(patch)
              .where(eq(places.id, parsed.id))
              .returning();
            out.push(serializePlace(after!));
            pendingAudits.push({
              collection: "places",
              op: "updateOne",
              before,
              after,
            });
          }
        } else if (
          op.method === "DELETE" &&
          parsed.resource === "places" &&
          parsed.id !== null
        ) {
          const [before] = await tx
            .select()
            .from(places)
            .where(eq(places.id, parsed.id));
          if (!before) {
            throw new Error(
              `op ${i}: could not find place with id ${parsed.id}`,
            );
          }
          await tx.delete(places).where(eq(places.id, parsed.id));
          out.push(serializePlace(before));
          pendingAudits.push({
            collection: "places",
            op: "deleteOne",
            before,
            after: null,
          });
        } else if (
          op.method === "POST" &&
          parsed.resource === "comments" &&
          parsed.id === null
        ) {
          // Comment create on a place.
          const b = (op.body ?? {}) as Partial<{
            content: string;
            stars: number;
            rant: boolean;
            authorId: number;
            authorName: string;
          }>;
          if (
            !b.content ||
            typeof b.stars !== "number" ||
            b.stars < 1 ||
            b.stars > 5
          ) {
            throw new Error(
              `op ${i}: comments create needs content + stars (1-5)`,
            );
          }
          const [place] = await tx
            .select()
            .from(places)
            .where(eq(places.id, parsed.placeId));
          if (!place) {
            throw new Error(
              `op ${i}: could not find place with id ${parsed.placeId}`,
            );
          }
          let authorName = b.authorName?.slice(0, 100) ?? "Anonymous";
          let author: typeof users.$inferSelect | null = null;
          if (b.authorId) {
            const [u] = await tx
              .select()
              .from(users)
              .where(eq(users.id, b.authorId));
            if (!u) {
              throw new Error(
                `op ${i}: could not find author with id ${b.authorId}`,
              );
            }
            author = u;
            authorName = `${u.firstName} ${u.lastName}`;
          }
          const [row] = await tx
            .insert(comments)
            .values({
              placeId: parsed.placeId,
              authorId: b.authorId ?? null,
              authorName,
              content: b.content.slice(0, 1000),
              stars: Math.max(1, Math.min(5, Math.round(b.stars))),
              rant: b.rant === true,
            })
            .returning();
          out.push(serializeComment(row!, author));
          pendingAudits.push({
            collection: "comments",
            op: "insertOne",
            before: null,
            after: row,
          });
        } else if (
          op.method === "DELETE" &&
          parsed.resource === "comments" &&
          parsed.id !== null
        ) {
          const [before] = await tx
            .select()
            .from(comments)
            .where(eq(comments.id, parsed.id));
          if (!before || before.placeId !== parsed.placeId) {
            throw new Error(
              `op ${i}: could not find comment ${parsed.id} on place ${parsed.placeId}`,
            );
          }
          let author: typeof users.$inferSelect | null = null;
          if (before.authorId) {
            const [u] = await tx
              .select()
              .from(users)
              .where(eq(users.id, before.authorId));
            author = u ?? null;
          }
          await tx.delete(comments).where(eq(comments.id, parsed.id));
          out.push(serializeComment(before, author));
          pendingAudits.push({
            collection: "comments",
            op: "deleteOne",
            before,
            after: null,
          });
        } else {
          throw new Error(
            `op ${i}: unsupported method+path combo — method=${op.method}, path=${op.path}`,
          );
        }
      }

      // Audit rows inside the same transaction so they roll back together.
      for (const a of pendingAudits) {
        await tx.insert(auditLog).values({
          actorId: guard.actor.id,
          actorLogin: guard.actor.login,
          collection: a.collection,
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
