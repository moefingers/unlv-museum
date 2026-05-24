/**
 * Three-factor login for the EnterPrize Historical Enhanced port.
 *
 * Per CONTEXT/internal_docs/identity-and-signup.md and the
 * project_enhanced_api_conventions memory, this is the canonical
 * login flow for any per-project user table that lives behind the
 * museum's GitHub session bridge:
 *
 *   1. Submitted email matches a row in quirk_truck_enhanced.users.
 *   2. Submitted password verifies against that row's bcrypt digest.
 *   3. The current museum session's auth.user.id equals that row's
 *      museum_user_id.
 *
 * Factor 3 lives in the WHERE clause, not as an after-match check,
 * so we never leak account existence to a visitor who isn't the
 * rightful museum-session owner. Failure modes return the same 404
 * body whether the email is missing, the password is wrong, or the
 * museum identity doesn't own the account.
 *
 * Mirrors src/app/(museum)/api/rest-rant/authentication/route.ts.
 */

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  users,
  auditLog,
} from "@/lib/schema/quirk-truck-enhanced";
import { guardMutation } from "@/lib/api-guard";
import { writeAuditEntry } from "@/lib/audit";

export async function POST(request: Request) {
  const guard = await guardMutation(request);
  if (guard.response) return guard.response;

  const body = (await request.json()) as Partial<{
    email: string;
    password: string;
  }>;

  const submittedEmail = body.email?.toLowerCase().trim() ?? "";
  const submittedPassword = body.password ?? "";

  const failureResponse = () =>
    NextResponse.json(
      {
        message: "Could not find a user with the provided username and password",
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

  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.email, submittedEmail),
        eq(users.museumUserId, guard.actor.id),
      ),
    );

  if (!user || !bcrypt.compareSync(submittedPassword, user.password)) {
    await writeAuditEntry(
      { auditLogTable: auditLog, tier: guard.tier, actor: guard.actor },
      {
        collection: "users",
        op: "loginAttempt",
        before: null,
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
        name: user.name,
      },
    },
  );

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      admin: user.admin,
      role: user.role,
    },
  });
}
