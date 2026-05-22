import { db } from "@/lib/db";
import { users, auditLog } from "@/lib/schema/rest-rant";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { serializeUser } from "@/lib/rest-rant";
import { guardMutation } from "@/lib/api-guard";
import { writeAuditEntry } from "@/lib/audit";

export async function GET() {
  const rows = await db.select().from(users);
  return NextResponse.json(rows.map(serializeUser));
}

export async function POST(request: Request) {
  const guard = await guardMutation(request);
  if (guard.response) return guard.response;
  const body = (await request.json()) as Partial<{
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }>;
  if (!body.firstName || !body.lastName || !body.email || !body.password) {
    return NextResponse.json(
      { message: "firstName, lastName, email, password are required" },
      { status: 400 },
    );
  }
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email.toLowerCase().trim()));
  if (existing.length > 0) {
    return NextResponse.json(
      { message: `Email "${body.email}" is already registered` },
      { status: 409 },
    );
  }
  const passwordDigest = bcrypt.hashSync(body.password, 10);
  // museumUserId is mandatory by the identity-and-signup contract — every
  // project-level user is locked to one museum identity. guard.actor.id
  // is the auth.user.id from the visitor's GitHub-authenticated session.
  const [row] = await db
    .insert(users)
    .values({
      museumUserId: guard.actor.id,
      firstName: body.firstName.slice(0, 100),
      lastName: body.lastName.slice(0, 100),
      email: body.email.toLowerCase().trim().slice(0, 200),
      passwordDigest,
    })
    .returning();
  if (!row) {
    return NextResponse.json(
      { message: "Failed to create user" },
      { status: 500 },
    );
  }

  await writeAuditEntry(
    { auditLogTable: auditLog, tier: guard.tier, actor: guard.actor },
    {
      collection: "users",
      op: "insertOne",
      before: null,
      // Don't include passwordDigest in the audit row — even hashed, it's
      // sensitive and the audit log is publicly readable.
      after: { ...row, passwordDigest: undefined },
    },
  );

  return NextResponse.json(serializeUser(row));
}
