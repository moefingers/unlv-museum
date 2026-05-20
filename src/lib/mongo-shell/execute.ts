/**
 * Executes a parsed Mongo shell command against the museum's Postgres-backed
 * bounties table. Returns a Mongo-shaped result (matching what the real
 * shell prints) so MongoClient.tsx can render it verbatim.
 *
 * Strict separation from parser.ts: the parser produces a typed AST with
 * no side effects, this module is the only place that touches the DB.
 *
 * Tier model: callers pass `tier: "original" | "enhanced"`. Mutations call
 * the `onAudit` hook with a structured event so the route handler can write
 * to `jaskis.audit_log` with the right actor + tier. Reads don't audit.
 *
 * The `auditLog` virtual collection is read-only and only visible on the
 * Enhanced tier — find/findOne/countDocuments route to `jaskis.audit_log`,
 * any write attempt errors with a friendly message.
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  lte,
  ne,
} from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLog as auditLogTable, bounties } from "@/lib/schema/jaskis";
import type { Json, ParsedCommand } from "./parser";

// ─── Public types ────────────────────────────────────────────────────────

export type Tier = "original" | "enhanced";

export interface ExecuteContext {
  tier: Tier;
  /** Whether the caller is signed in. Required for any mutation. */
  isAuthenticated: boolean;
  /** Hook the route uses to write an audit-log row after a successful mutation. */
  onAudit?: (event: AuditEvent) => Promise<void>;
  /**
   * Implicit current database for `show collections`. Mongo shell tracks this
   * via `use <db>` — the museum's shell tracks it client-side and forwards it
   * so server-side `show collections` knows what to enumerate.
   */
  currentDb?: string;
}

export interface AuditEvent {
  collection: "bounties";
  op:
    | "insertOne"
    | "insertMany"
    | "updateOne"
    | "updateMany"
    | "deleteOne"
    | "deleteMany";
  before: unknown;
  after: unknown;
}

/**
 * Mongo-shell-shaped result. Each variant matches what the real shell
 * prints back at the user — `{ acknowledged, insertedId }` for insertOne,
 * an array of docs for find, etc.
 */
export type ExecuteResult =
  | { kind: "ok"; value: unknown }
  | { kind: "cursor"; docs: unknown[]; pretty: boolean }
  | { kind: "shellInfo"; lines: string[] };

export class ExecutionError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 401 | 404,
  ) {
    super(message);
    this.name = "ExecutionError";
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────

export async function execute(
  cmd: ParsedCommand,
  ctx: ExecuteContext,
): Promise<ExecuteResult> {
  switch (cmd.type) {
    case "use":
      // Mongo shell prints `switched to db <name>` even if it doesn't exist;
      // we follow the same UX. Client tracks currentDb and reflects it in
      // the prompt.
      return { kind: "shellInfo", lines: [`switched to db ${cmd.db}`] };

    case "showDbs":
      return { kind: "shellInfo", lines: ["jaskis  0.000GB"] };

    case "showCollections": {
      // We only model the jaskis schema; ignore the actual currentDb name
      // since visitors might `use anything` and that's fine.
      const cols =
        ctx.tier === "enhanced" ? ["auditLog", "bounties"] : ["bounties"];
      return { kind: "shellInfo", lines: cols };
    }

    case "createCollection":
      // Mongo shell would error if it already existed; the museum's table
      // is real and fixed, so always pretend success.
      return { kind: "ok", value: { ok: 1 } };

    case "find":
    case "findOne":
      return findOp(cmd, ctx);

    case "countDocuments":
      return countOp(cmd, ctx);

    case "insertOne":
    case "insertMany":
    case "updateOne":
    case "updateMany":
    case "deleteOne":
    case "deleteMany":
      return mutate(cmd, ctx);
  }
}

// ─── Reads ───────────────────────────────────────────────────────────────

async function findOp(
  cmd: Extract<ParsedCommand, { type: "find" | "findOne" }>,
  ctx: ExecuteContext,
): Promise<ExecuteResult> {
  const { collection, filter, projection, cursor } = cmd;
  const pretty = cursor.ops.some((o) => o.type === "pretty");

  let docs: Record<string, Json>[];
  if (collection === "bounties") {
    docs = await readBounties(filter, cursor);
  } else if (collection === "auditLog") {
    requireEnhanced(ctx, "auditLog");
    docs = await readAuditLog(filter, cursor);
  } else {
    return unknownCollection(collection);
  }

  const projected = projection
    ? docs.map((d) => applyProjection(d, projection))
    : docs;
  if (cmd.type === "findOne") {
    return { kind: "ok", value: projected[0] ?? null };
  }
  return { kind: "cursor", docs: projected, pretty };
}

async function countOp(
  cmd: Extract<ParsedCommand, { type: "countDocuments" }>,
  ctx: ExecuteContext,
): Promise<ExecuteResult> {
  if (cmd.collection === "bounties") {
    const conds = buildBountiesConditions(cmd.filter);
    const [{ value: n }] = conds.length
      ? await db
          .select({ value: count() })
          .from(bounties)
          .where(and(...conds))
      : await db.select({ value: count() }).from(bounties);
    return { kind: "ok", value: n };
  }
  if (cmd.collection === "auditLog") {
    requireEnhanced(ctx, "auditLog");
    const conds = buildAuditConditions(cmd.filter);
    const [{ value: n }] = conds.length
      ? await db
          .select({ value: count() })
          .from(auditLogTable)
          .where(and(...conds))
      : await db.select({ value: count() }).from(auditLogTable);
    return { kind: "ok", value: n };
  }
  return unknownCollection(cmd.collection);
}

async function readBounties(
  filter: Json,
  cursor: {
    ops: { type: string; n?: number; spec?: Record<string, 1 | -1> }[];
  },
): Promise<Record<string, Json>[]> {
  const conds = buildBountiesConditions(filter);

  // Sort spec — last .sort() wins, Mongo-shell-style. Default: id asc to
  // match the insertion order visitors expect from the original tutorial.
  const sortOp = [...cursor.ops].reverse().find((o) => o.type === "sort") as
    | { type: "sort"; spec: Record<string, 1 | -1> }
    | undefined;
  const orderBy = sortOp
    ? Object.entries(sortOp.spec).map(([field, dir]) => {
        const col = bountiesColumnByDoc(field);
        if (!col) throw new ExecutionError(`unknown field: ${field}`, 400);
        return dir === 1 ? asc(col) : desc(col);
      })
    : [asc(bounties.id)];

  const limitOp = cursor.ops.find((o) => o.type === "limit") as
    | { type: "limit"; n: number }
    | undefined;

  const baseQuery = db.select().from(bounties);
  const filtered = conds.length ? baseQuery.where(and(...conds)) : baseQuery;
  const ordered = filtered.orderBy(...orderBy);
  const rows = limitOp ? await ordered.limit(limitOp.n) : await ordered;

  return rows.map(toBountyDoc);
}

async function readAuditLog(
  filter: Json,
  cursor: {
    ops: { type: string; n?: number; spec?: Record<string, 1 | -1> }[];
  },
): Promise<Record<string, Json>[]> {
  const conds = buildAuditConditions(filter);
  const sortOp = [...cursor.ops].reverse().find((o) => o.type === "sort") as
    | { type: "sort"; spec: Record<string, 1 | -1> }
    | undefined;
  const orderBy = sortOp
    ? Object.entries(sortOp.spec).map(([field, dir]) => {
        const col = auditLogColumn(field);
        if (!col) throw new ExecutionError(`unknown field: ${field}`, 400);
        return dir === 1 ? asc(col) : desc(col);
      })
    : [desc(auditLogTable.ts)];

  const limitOp = cursor.ops.find((o) => o.type === "limit") as
    | { type: "limit"; n: number }
    | undefined;
  // Audit-log queries are unbounded by default — without an explicit .limit(),
  // newest-50 keeps the shell output reasonable.
  const effectiveLimit = limitOp ? limitOp.n : 50;

  const base = db.select().from(auditLogTable);
  const filtered = conds.length ? base.where(and(...conds)) : base;
  const rows = await filtered.orderBy(...orderBy).limit(effectiveLimit);

  return rows.map(toAuditDoc);
}

// ─── Mutations ───────────────────────────────────────────────────────────

async function mutate(
  cmd: Extract<
    ParsedCommand,
    | { type: "insertOne" }
    | { type: "insertMany" }
    | { type: "updateOne" | "updateMany" }
    | { type: "deleteOne" | "deleteMany" }
  >,
  ctx: ExecuteContext,
): Promise<ExecuteResult> {
  if (!ctx.isAuthenticated) {
    throw new ExecutionError(
      "sign-in required for writes — the museum attributes mutations to your GitHub account",
      401,
    );
  }
  if (cmd.collection === "auditLog") {
    throw new ExecutionError(
      "auditLog is read-only — it records mutations made elsewhere",
      400,
    );
  }
  if (cmd.collection !== "bounties") {
    return unknownCollection(cmd.collection);
  }

  switch (cmd.type) {
    case "insertOne": {
      const row = coerceBountyForInsert(cmd.doc);
      const [inserted] = await db.insert(bounties).values(row).returning();
      const after = inserted ? toBountyDoc(inserted) : null;
      if (after && ctx.onAudit) {
        await ctx.onAudit({
          collection: "bounties",
          op: "insertOne",
          before: null,
          after,
        });
      }
      return {
        kind: "ok",
        value: {
          acknowledged: true,
          insertedId: inserted?.id ?? null,
        },
      };
    }

    case "insertMany": {
      const rows = cmd.docs.map(coerceBountyForInsert);
      const inserted = await db.insert(bounties).values(rows).returning();
      const after = inserted.map(toBountyDoc);
      if (after.length && ctx.onAudit) {
        await ctx.onAudit({
          collection: "bounties",
          op: "insertMany",
          before: null,
          after,
        });
      }
      return {
        kind: "ok",
        value: {
          acknowledged: true,
          insertedCount: inserted.length,
          insertedIds: Object.fromEntries(
            inserted.map((row, i) => [String(i), row.id]),
          ),
        },
      };
    }

    case "updateOne":
    case "updateMany": {
      const conds = buildBountiesConditions(cmd.filter);
      const set = coerceBountyForUpdate(cmd.update);
      // For updateOne we narrow by id of the first match (Mongo's "first
      // matched, not first sorted" semantics are loose for our purposes —
      // ordering by id keeps it deterministic).
      let targets: { id: number }[];
      if (cmd.type === "updateOne") {
        const first = conds.length
          ? await db
              .select({ id: bounties.id })
              .from(bounties)
              .where(and(...conds))
              .orderBy(asc(bounties.id))
              .limit(1)
          : await db
              .select({ id: bounties.id })
              .from(bounties)
              .orderBy(asc(bounties.id))
              .limit(1);
        targets = first;
      } else {
        targets = conds.length
          ? await db
              .select({ id: bounties.id })
              .from(bounties)
              .where(and(...conds))
          : await db.select({ id: bounties.id }).from(bounties);
      }
      if (targets.length === 0) {
        return {
          kind: "ok",
          value: { acknowledged: true, matchedCount: 0, modifiedCount: 0 },
        };
      }
      const ids = targets.map((t) => t.id);
      const before = (
        await db.select().from(bounties).where(inArray(bounties.id, ids))
      ).map(toBountyDoc);
      const updated = await db
        .update(bounties)
        .set(set)
        .where(inArray(bounties.id, ids))
        .returning();
      const after = updated.map(toBountyDoc);
      if (ctx.onAudit) {
        await ctx.onAudit({
          collection: "bounties",
          op: cmd.type,
          before: cmd.type === "updateOne" ? before[0] : before,
          after: cmd.type === "updateOne" ? after[0] : after,
        });
      }
      return {
        kind: "ok",
        value: {
          acknowledged: true,
          matchedCount: updated.length,
          modifiedCount: updated.length,
        },
      };
    }

    case "deleteOne":
    case "deleteMany": {
      const conds = buildBountiesConditions(cmd.filter);
      let targets: { id: number }[];
      if (cmd.type === "deleteOne") {
        targets = conds.length
          ? await db
              .select({ id: bounties.id })
              .from(bounties)
              .where(and(...conds))
              .orderBy(asc(bounties.id))
              .limit(1)
          : await db
              .select({ id: bounties.id })
              .from(bounties)
              .orderBy(asc(bounties.id))
              .limit(1);
      } else {
        targets = conds.length
          ? await db
              .select({ id: bounties.id })
              .from(bounties)
              .where(and(...conds))
          : await db.select({ id: bounties.id }).from(bounties);
      }
      if (targets.length === 0) {
        return {
          kind: "ok",
          value: { acknowledged: true, deletedCount: 0 },
        };
      }
      const ids = targets.map((t) => t.id);
      const before = (
        await db.select().from(bounties).where(inArray(bounties.id, ids))
      ).map(toBountyDoc);
      const deleted = await db
        .delete(bounties)
        .where(inArray(bounties.id, ids))
        .returning();
      if (ctx.onAudit) {
        await ctx.onAudit({
          collection: "bounties",
          op: cmd.type,
          before: cmd.type === "deleteOne" ? before[0] : before,
          after: null,
        });
      }
      return {
        kind: "ok",
        value: { acknowledged: true, deletedCount: deleted.length },
      };
    }
  }
}

// ─── Filter / projection builders ────────────────────────────────────────

function buildBountiesConditions(filter: Json) {
  if (!isObject(filter)) return [];
  return filterToConditions(filter, bountiesColumnByDoc, "bounties");
}

function buildAuditConditions(filter: Json) {
  if (!isObject(filter)) return [];
  return filterToConditions(filter, auditLogColumn, "auditLog");
}

type ColumnLookup = (
  docField: string,
) => ReturnType<typeof bountiesColumnByDoc>;

function filterToConditions(
  filter: { [k: string]: Json },
  lookup: ColumnLookup,
  collectionLabel: string,
) {
  const conds = [];
  for (const [key, value] of Object.entries(filter)) {
    if (key === "$and") {
      if (!Array.isArray(value)) {
        throw new ExecutionError("$and: expected array", 400);
      }
      for (const sub of value) {
        if (!isObject(sub)) {
          throw new ExecutionError("$and: entries must be objects", 400);
        }
        conds.push(...filterToConditions(sub, lookup, collectionLabel));
      }
      continue;
    }
    if (key.startsWith("$")) {
      throw new ExecutionError(`unsupported top-level operator: ${key}`, 400);
    }
    const col = lookup(key);
    if (!col) {
      throw new ExecutionError(
        `unknown field on ${collectionLabel}: ${key}`,
        400,
      );
    }
    if (isObject(value)) {
      for (const [op, operand] of Object.entries(value)) {
        switch (op) {
          case "$eq":
            conds.push(eq(col, operand as never));
            break;
          case "$ne":
            conds.push(ne(col, operand as never));
            break;
          case "$gt":
            conds.push(gt(col, operand as never));
            break;
          case "$gte":
            conds.push(gte(col, operand as never));
            break;
          case "$lt":
            conds.push(lt(col, operand as never));
            break;
          case "$lte":
            conds.push(lte(col, operand as never));
            break;
          case "$in":
            if (!Array.isArray(operand)) {
              throw new ExecutionError(`$in: expected array for ${key}`, 400);
            }
            conds.push(inArray(col, operand as never[]));
            break;
          default:
            throw new ExecutionError(`unsupported operator: ${op}`, 400);
        }
      }
    } else {
      // Scalar shorthand: { field: value } → field equals value.
      conds.push(eq(col, value as never));
    }
  }
  return conds;
}

function applyProjection(
  doc: Record<string, Json>,
  projection: Json,
): Record<string, Json> {
  if (!isObject(projection)) return doc;
  const entries = Object.entries(projection);
  if (entries.length === 0) return doc;
  // Mongo's rules: either include-mode (any 1) or exclude-mode (any 0).
  // _id is always included unless explicitly excluded — we don't have _id,
  // we have id; same idea, applied to `id`.
  const includes = entries
    .filter(([, v]) => v === 1 || v === true)
    .map(([k]) => k);
  const excludes = entries
    .filter(([, v]) => v === 0 || v === false)
    .map(([k]) => k);
  if (includes.length && excludes.length) {
    // Mongo forbids mixing except for _id; we forbid it outright to keep
    // the surface predictable.
    throw new ExecutionError(
      "projection cannot mix include (1) and exclude (0) specifiers",
      400,
    );
  }
  if (excludes.length) {
    const out: Record<string, Json> = {};
    for (const [k, v] of Object.entries(doc)) {
      if (!excludes.includes(k)) out[k] = v;
    }
    return out;
  }
  if (includes.length) {
    const out: Record<string, Json> = {};
    // Always carry id unless explicitly excluded above.
    if ("id" in doc) out.id = doc.id!;
    for (const k of includes) {
      if (k in doc) out[k] = doc[k]!;
    }
    return out;
  }
  return doc;
}

// ─── Coercion: shell doc ⇄ Drizzle row ───────────────────────────────────

function coerceBountyForInsert(doc: Json) {
  if (!isObject(doc)) {
    throw new ExecutionError("insert: expected an object", 400);
  }
  const required = [
    "name",
    "species",
    "location",
    "wantedFor",
    "client",
    "reward",
  ] as const;
  for (const f of required) {
    if (!(f in doc)) {
      throw new ExecutionError(`insert: missing required field '${f}'`, 400);
    }
  }
  return {
    name: clipString(doc.name, 100, "name"),
    species: clipString(doc.species, 50, "species"),
    location: clipString(doc.location, 80, "location"),
    wantedFor: clipString(doc.wantedFor, 200, "wantedFor"),
    client: clipString(doc.client, 80, "client"),
    reward: expectInteger(doc.reward, "reward"),
    captured: doc.captured === undefined ? false : Boolean(doc.captured),
  };
}

function coerceBountyForUpdate(update: Json) {
  if (!isObject(update)) {
    throw new ExecutionError("update: expected an object", 400);
  }
  const setOp = update.$set;
  if (setOp === undefined) {
    throw new ExecutionError(
      "update: only the $set operator is supported (e.g. { $set: { reward: 10000 } })",
      400,
    );
  }
  if (!isObject(setOp)) {
    throw new ExecutionError("update: $set value must be an object", 400);
  }
  const set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(setOp)) {
    switch (k) {
      case "name":
        set.name = clipString(v, 100, "name");
        break;
      case "species":
        set.species = clipString(v, 50, "species");
        break;
      case "location":
        set.location = clipString(v, 80, "location");
        break;
      case "wantedFor":
        set.wantedFor = clipString(v, 200, "wantedFor");
        break;
      case "client":
        set.client = clipString(v, 80, "client");
        break;
      case "reward":
        set.reward = expectInteger(v, "reward");
        break;
      case "captured":
        set.captured = Boolean(v);
        break;
      default:
        throw new ExecutionError(`update: unknown field '${k}'`, 400);
    }
  }
  if (Object.keys(set).length === 0) {
    throw new ExecutionError("update: $set requires at least one field", 400);
  }
  return set;
}

function toBountyDoc(row: typeof bounties.$inferSelect): Record<string, Json> {
  return {
    id: row.id,
    name: row.name,
    species: row.species,
    location: row.location,
    wantedFor: row.wantedFor,
    client: row.client,
    reward: row.reward,
    captured: row.captured,
    createdAt: row.createdAt.toISOString(),
  };
}

function toAuditDoc(
  row: typeof auditLogTable.$inferSelect,
): Record<string, Json> {
  return {
    id: row.id,
    ts: row.ts.toISOString(),
    actorId: row.actorId,
    actorLogin: row.actorLogin,
    collection: row.collection,
    op: row.op,
    tier: row.tier,
    before: (row.before ?? null) as Json,
    after: (row.after ?? null) as Json,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function bountiesColumnByDoc(docField: string) {
  switch (docField) {
    case "id":
      return bounties.id;
    case "name":
      return bounties.name;
    case "species":
      return bounties.species;
    case "location":
      return bounties.location;
    case "wantedFor":
      return bounties.wantedFor;
    case "client":
      return bounties.client;
    case "reward":
      return bounties.reward;
    case "captured":
      return bounties.captured;
    case "createdAt":
      return bounties.createdAt;
    default:
      return null;
  }
}

function auditLogColumn(docField: string) {
  switch (docField) {
    case "id":
      return auditLogTable.id;
    case "ts":
      return auditLogTable.ts;
    case "actorId":
      return auditLogTable.actorId;
    case "actorLogin":
      return auditLogTable.actorLogin;
    case "collection":
      return auditLogTable.collection;
    case "op":
      return auditLogTable.op;
    case "tier":
      return auditLogTable.tier;
    default:
      return null;
  }
}

function clipString(v: unknown, max: number, field: string): string {
  if (typeof v !== "string") {
    throw new ExecutionError(`${field} must be a string`, 400);
  }
  return v.slice(0, max);
}

function expectInteger(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new ExecutionError(`${field} must be a number`, 400);
  }
  return Math.trunc(v);
}

function requireEnhanced(ctx: ExecuteContext, collection: string) {
  if (ctx.tier !== "enhanced") {
    throw new ExecutionError(
      `${collection} is only available on the Enhanced tier — switch tiers using the chrome header`,
      404,
    );
  }
}

function unknownCollection(name: string): never {
  throw new ExecutionError(
    `unknown collection: ${name}. try 'show collections'`,
    400,
  );
}

function isObject(v: Json): v is { [key: string]: Json } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
