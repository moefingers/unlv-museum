/**
 * /api/v2/music-tour/batch — Enhanced-tier compound writes.
 *
 *   POST /batch
 *   Body: {
 *     ops: [
 *       { method: "POST",   path: "/bands",     body: {...} },
 *       { method: "POST",   path: "/events",    body: {...} },
 *       { method: "PUT",    path: "/bands/42",  body: {...} },
 *       { method: "DELETE", path: "/stages/3" },
 *       ...
 *     ]
 *   }
 *
 * Runs every op in a single Postgres transaction. Either all succeed
 * (one audit row per op, tier="enhanced", actor=session.user) or all
 * roll back. Returns `{ results: [...] }` with one entry per op in
 * the order they were submitted.
 *
 * Source-faithful response shapes: each `results[i]` carries the
 * exact JSON the standalone v1 route would have returned for that
 * single op, so a batch is just "N parallel single calls with atomic
 * semantics."
 *
 * Scope (intentionally limited):
 *   - Tables: bands, events, stages
 *   - Methods: POST (create), PUT /<id> (update), DELETE /<id> (delete)
 *   - No nested resources, no by-name lookups, no batch-within-batch
 *
 * Sign-in required (same as any mutation route). Audit rows record
 * each individual op + the writer.
 */

// The batch endpoint needs real transactionality — `db` from /lib/db
// uses neon-http which can't do db.transaction(). dbTx wraps the
// WebSocket-pool driver which supports BEGIN/COMMIT. See lib/db-tx.ts.
import { dbTx as db } from "@/lib/db-tx";
import { auditLog, bands, events, stages } from "@/lib/schema/music-tour";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/api-guard";
import { writeAuditEntry } from "@/lib/audit";

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
 * Parse a single op's `path` field. Returns { resource, id? } or null
 * if the path doesn't match any supported pattern.
 *   /bands              → { resource: "bands" }
 *   /bands/42           → { resource: "bands", id: 42 }
 *   /events             → { resource: "events" }
 *   /events/3           → { resource: "events", id: 3 }
 *   /stages             → { resource: "stages" }
 *   /stages/1           → { resource: "stages", id: 1 }
 */
function parsePath(
  path: string,
): { resource: "bands" | "events" | "stages"; id: number | null } | null {
  const m = path.match(/^\/(bands|events|stages)(?:\/(\d+))?\/?$/);
  if (!m) return null;
  return {
    resource: m[1] as "bands" | "events" | "stages",
    id: m[2] ? parseInt(m[2], 10) : null,
  };
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

  // Single transaction — either all succeed or all roll back.
  try {
    const results = await db.transaction(async (tx) => {
      const out: unknown[] = [];
      // Buffer audit entries; flush after the transaction commits so
      // a transaction rollback doesn't leave orphan audit rows.
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
            `op ${i}: path '${op.path}' doesn't match a known shape — expected /bands, /events, /stages, /bands/:id, etc.`,
          );
        }

        // Dispatch by (resource, method, id).
        if (op.method === "POST" && parsed.id === null) {
          // Create.
          if (parsed.resource === "bands") {
            const b = op.body as Partial<{
              name: string;
              genre: string;
              availableStartTime: string;
              endTime: string;
            }>;
            if (
              !b?.name ||
              !b?.genre ||
              !b?.availableStartTime ||
              !b?.endTime
            ) {
              throw new Error(
                `op ${i}: bands create needs name + genre + availableStartTime + endTime`,
              );
            }
            const [row] = await tx
              .insert(bands)
              .values({
                name: b.name.slice(0, 200),
                genre: b.genre.slice(0, 200),
                availableStartTime: new Date(b.availableStartTime),
                endTime: new Date(b.endTime),
              })
              .returning();
            out.push({
              message: "Successfully inserted a new band",
              data: row,
            });
            pendingAudits.push({
              collection: "bands",
              op: "insertOne",
              before: null,
              after: row,
            });
          } else if (parsed.resource === "events") {
            const e = op.body as Partial<{
              name: string;
              date: string;
              startTime: string;
              endTime: string;
            }>;
            if (!e?.name || !e?.date || !e?.startTime || !e?.endTime) {
              throw new Error(
                `op ${i}: events create needs name + date + startTime + endTime`,
              );
            }
            const [row] = await tx
              .insert(events)
              .values({
                name: e.name.slice(0, 200),
                date: new Date(e.date),
                startTime: new Date(e.startTime),
                endTime: new Date(e.endTime),
              })
              .returning();
            out.push({
              message: "Successfully inserted a new event",
              data: row,
            });
            pendingAudits.push({
              collection: "events",
              op: "insertOne",
              before: null,
              after: row,
            });
          } else if (parsed.resource === "stages") {
            const s = op.body as Partial<{ stageName: string }>;
            if (!s?.stageName) {
              throw new Error(`op ${i}: stages create needs stageName`);
            }
            const [row] = await tx
              .insert(stages)
              .values({ stageName: s.stageName.slice(0, 200) })
              .returning();
            out.push({
              message: "Successfully inserted a new stage",
              data: row,
            });
            pendingAudits.push({
              collection: "stages",
              op: "insertOne",
              before: null,
              after: row,
            });
          }
        } else if (op.method === "PUT" && parsed.id !== null) {
          // Update by id.
          if (parsed.resource === "bands") {
            const b = (op.body ?? {}) as Partial<{
              name: string;
              genre: string;
              availableStartTime: string;
              endTime: string;
            }>;
            const set: Record<string, unknown> = {};
            if (b.name !== undefined) set.name = b.name.slice(0, 200);
            if (b.genre !== undefined) set.genre = b.genre.slice(0, 200);
            if (b.availableStartTime !== undefined) {
              set.availableStartTime = new Date(b.availableStartTime);
            }
            if (b.endTime !== undefined) set.endTime = new Date(b.endTime);
            const [before] = await tx
              .select()
              .from(bands)
              .where(eq(bands.bandId, parsed.id));
            if (Object.keys(set).length) {
              const [after] = await tx
                .update(bands)
                .set(set)
                .where(eq(bands.bandId, parsed.id))
                .returning();
              if (before && after) {
                pendingAudits.push({
                  collection: "bands",
                  op: "updateOne",
                  before,
                  after,
                });
              }
            }
            out.push({
              message: `Successfully updated band with id ${parsed.id}`,
            });
          } else if (parsed.resource === "events") {
            const e = (op.body ?? {}) as Partial<{
              name: string;
              date: string;
              startTime: string;
              endTime: string;
            }>;
            const set: Record<string, unknown> = {};
            if (e.name !== undefined) set.name = e.name.slice(0, 200);
            if (e.date !== undefined) set.date = new Date(e.date);
            if (e.startTime !== undefined)
              set.startTime = new Date(e.startTime);
            if (e.endTime !== undefined) set.endTime = new Date(e.endTime);
            const [before] = await tx
              .select()
              .from(events)
              .where(eq(events.eventId, parsed.id));
            let updatedCount = 0;
            if (Object.keys(set).length) {
              const updated = await tx
                .update(events)
                .set(set)
                .where(eq(events.eventId, parsed.id))
                .returning();
              updatedCount = updated.length;
              if (before && updated[0]) {
                pendingAudits.push({
                  collection: "events",
                  op: "updateOne",
                  before,
                  after: updated[0],
                });
              }
            }
            out.push({
              message: `Successfully updated ${updatedCount} event(s)`,
            });
          } else if (parsed.resource === "stages") {
            const s = (op.body ?? {}) as Partial<{ stageName: string }>;
            if (s.stageName === undefined) {
              out.push({ message: `Successfully updated 0 stage(s)` });
            } else {
              const [before] = await tx
                .select()
                .from(stages)
                .where(eq(stages.stageId, parsed.id));
              const updated = await tx
                .update(stages)
                .set({ stageName: s.stageName.slice(0, 200) })
                .where(eq(stages.stageId, parsed.id))
                .returning();
              if (before && updated[0]) {
                pendingAudits.push({
                  collection: "stages",
                  op: "updateOne",
                  before,
                  after: updated[0],
                });
              }
              out.push({
                message: `Successfully updated ${updated.length} stage(s)`,
              });
            }
          }
        } else if (op.method === "DELETE" && parsed.id !== null) {
          if (parsed.resource === "bands") {
            const [before] = await tx
              .select()
              .from(bands)
              .where(eq(bands.bandId, parsed.id));
            await tx.delete(bands).where(eq(bands.bandId, parsed.id));
            if (before) {
              pendingAudits.push({
                collection: "bands",
                op: "deleteOne",
                before,
                after: null,
              });
            }
            out.push({
              message: `Successfully deleted band with id ${parsed.id}`,
            });
          } else if (parsed.resource === "events") {
            const [before] = await tx
              .select()
              .from(events)
              .where(eq(events.eventId, parsed.id));
            const deleted = await tx
              .delete(events)
              .where(eq(events.eventId, parsed.id))
              .returning();
            if (before) {
              pendingAudits.push({
                collection: "events",
                op: "deleteOne",
                before,
                after: null,
              });
            }
            out.push({
              message: `Successfully deleted ${deleted.length} event(s)`,
            });
          } else if (parsed.resource === "stages") {
            const [before] = await tx
              .select()
              .from(stages)
              .where(eq(stages.stageId, parsed.id));
            const deleted = await tx
              .delete(stages)
              .where(eq(stages.stageId, parsed.id))
              .returning();
            if (before) {
              pendingAudits.push({
                collection: "stages",
                op: "deleteOne",
                before,
                after: null,
              });
            }
            out.push({
              message: `Successfully deleted ${deleted.length} stage(s)`,
            });
          }
        } else {
          throw new Error(
            `op ${i}: unsupported method+path combo — method=${op.method}, path=${op.path}`,
          );
        }
      }

      // Write audit rows inside the same transaction so they roll back
      // together with the data mutations on any failure above.
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

// Silence the unused-import warning for writeAuditEntry — the batch
// handler writes audit rows directly via the transaction's tx.insert
// (rather than the helper) so they participate in the same transaction.
void writeAuditEntry;
