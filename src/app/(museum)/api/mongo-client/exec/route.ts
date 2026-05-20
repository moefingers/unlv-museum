/**
 * /api/mongo-client/exec — single endpoint backing the mongo-client shell.
 *
 * The client posts { tier, command, currentDb } as JSON. We parse the
 * command (no eval), check auth for mutations, dispatch to the executor,
 * write an audit-log row if the executor produced one, and return a
 * Mongo-shell-shaped JSON result.
 *
 * Errors are surfaced as `{ error: <string>, kind: "parse" | "exec" | "auth" }`
 * with appropriate HTTP status so the terminal UI can render them with the
 * red "error" styling Mongo's shell uses.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/schema/jaskis";
import {
  ExecutionError,
  execute,
  type AuditEvent,
  type Tier,
} from "@/lib/mongo-shell/execute";
import { ParseError, parseCommand } from "@/lib/mongo-shell/parser";

export async function POST(request: Request) {
  let body: { tier?: unknown; command?: unknown; currentDb?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json(
      { error: "request body must be JSON", kind: "parse" },
      { status: 400 },
    );
  }

  const tier = body.tier === "enhanced" ? "enhanced" : "original";
  const command = typeof body.command === "string" ? body.command : "";
  const currentDb =
    typeof body.currentDb === "string" ? body.currentDb : "jaskis";

  if (!command.trim()) {
    return Response.json(
      { error: "command is required", kind: "parse" },
      { status: 400 },
    );
  }

  // Parse — guaranteed no side effects.
  let parsed;
  try {
    parsed = parseCommand(command);
  } catch (err) {
    if (err instanceof ParseError) {
      return Response.json(
        { error: err.message, kind: "parse" },
        { status: 400 },
      );
    }
    return Response.json(
      { error: "internal parse error", kind: "parse" },
      { status: 500 },
    );
  }

  // Auth — only checked for mutations; reads stay anonymous.
  const session = await auth.api.getSession({ headers: request.headers });
  const isAuthenticated = session !== null;

  // Audit hook captures the actor (GitHub login) so it's denormalized into
  // the audit row at write time. If session lacks the github login field,
  // fall back to user.name; never null on a successful auth path.
  const actorId = session?.user.id ?? null;
  const actorLogin =
    (session?.user as { githubLogin?: string } | undefined)?.githubLogin ??
    session?.user.name ??
    null;

  const onAudit = async (event: AuditEvent) => {
    await db.insert(auditLog).values({
      actorId,
      actorLogin,
      collection: event.collection,
      op: event.op,
      tier,
      before: event.before as never,
      after: event.after as never,
    });
  };

  try {
    const result = await execute(parsed, {
      tier: tier as Tier,
      isAuthenticated,
      onAudit,
      currentDb,
    });
    return Response.json({ result });
  } catch (err) {
    if (err instanceof ExecutionError) {
      return Response.json(
        {
          error: err.message,
          kind: err.status === 401 ? "auth" : "exec",
        },
        { status: err.status },
      );
    }
    console.error("[mongo-client/exec] unexpected error", err);
    return Response.json(
      { error: "internal server error", kind: "exec" },
      { status: 500 },
    );
  }
}
