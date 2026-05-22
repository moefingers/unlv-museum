import { db } from "@/lib/db";
import { users, auditLog } from "@/lib/schema/rest-rant";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { serializeUser } from "@/lib/rest-rant";
import { guardMutation } from "@/lib/api-guard";
import { writeAuditEntry } from "@/lib/audit";

/**
 * Three-factor login per the identity-and-signup contract
 * (CONTEXT/internal_docs/identity-and-signup.md):
 *
 *   1. Submitted email matches a row.
 *   2. Submitted password verifies against that row's password_digest.
 *   3. Current museum session's auth.user.id equals that row's
 *      museum_user_id.
 *
 * The museum_user_id predicate is part of the WHERE clause, not an
 * authorization check after a successful credential match. A wrong-
 * museum-identity attempt returns the same 404 as wrong-password — we
 * never leak the existence of an account to a visitor who isn't its
 * rightful museum-session owner.
 *
 * Both successful and failed attempts are audited. Failed attempts
 * record `op: "loginAttempt"` with the submitted email in `after.email`
 * (never the password, even hashed). Successful logins record
 * `op: "loginSuccess"` with the user id but never the password.
 */
export async function POST(request: Request) {
  const guard = await guardMutation(request);
  if (guard.response) return guard.response;

  const body = (await request.json()) as Partial<{
    email: string;
    password: string;
  }>;

  const submittedEmail = body.email?.toLowerCase().trim() ?? "";
  const submittedPassword = body.password ?? "";

  // Generic 404 used for ALL failure modes (missing fields, no such
  // email, wrong password, wrong museum identity). Identical body and
  // status to prevent attackers from distinguishing "email exists but
  // wrong password" from "wrong museum identity owns this email."
  const failureResponse = () =>
    NextResponse.json(
      {
        message: `Could not find a user with the provided username and password`,
      },
      { status: 404 },
    );

  if (!submittedEmail || !submittedPassword) {
    await writeAuditEntry(
      { auditLogTable: auditLog, tier: guard.tier, actor: guard.actor },
      {
        collection: "users",
        op: "loginAttempt",
        before: null,
        after: { email: submittedEmail, outcome: "missing_fields" },
      },
    );
    return failureResponse();
  }

  // Three-factor lookup: email + museum_user_id, then bcrypt-compare the
  // password against the returned row.
  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.email, submittedEmail),
        eq(users.museumUserId, guard.actor.id),
      ),
    );

  if (!user || !bcrypt.compareSync(submittedPassword, user.passwordDigest)) {
    await writeAuditEntry(
      { auditLogTable: auditLog, tier: guard.tier, actor: guard.actor },
      {
        collection: "users",
        op: "loginAttempt",
        before: null,
        // Record the submitted email so the audit log surfaces "someone
        // tried to log in as X but failed." Never record the password.
        after: { email: submittedEmail, outcome: "credentials_invalid" },
      },
    );
    return failureResponse();
  }

  await writeAuditEntry(
    { auditLogTable: auditLog, tier: guard.tier, actor: guard.actor },
    {
      collection: "users",
      op: "loginSuccess",
      before: null,
      after: {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    },
  );

  return NextResponse.json({ user: serializeUser(user) });
}
