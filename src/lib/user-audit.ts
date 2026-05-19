/**
 * Identity-surface audit-event emitter. Project-domain events live in each
 * project's own pgSchema audit table — NOT here. See
 * CONTEXT/internal_docs/auth.md §Audit-Log.
 *
 * Every call is try/catch-wrapped at the call site (and again inside).
 * Audit-log failures must never break a request — auth is the priority.
 */

import { db } from "./db";
import { userAuditLog } from "./schema/auth";

export type AuditEventType =
  // Identity / session
  | "user.created"
  | "session.created"
  | "session.revoked"
  | "signin.failed"
  | "signin.locked"
  // Verification / admin
  | "user.verified"
  | "user.unverified"
  | "user.banned"
  | "user.unbanned"
  // Rate limiting
  | "rate_limit.hit"
  // OAuth-specific
  | "oauth.callback.failed";

export interface UserAuditEvent {
  eventType: AuditEventType;
  userId?: string | null;
  email?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  provider?: string | null;
  metadata?: Record<string, unknown>;
}

export async function emitUserAudit(event: UserAuditEvent): Promise<void> {
  try {
    await db.insert(userAuditLog).values({
      userId: event.userId ?? null,
      email: event.email ?? null,
      eventType: event.eventType,
      ipAddress: event.ipAddress ?? null,
      userAgent: event.userAgent ?? null,
      provider: event.provider ?? null,
      metadata: event.metadata ?? {},
    });
  } catch (err) {
    console.error("[user-audit]", event.eventType, err);
  }
}
