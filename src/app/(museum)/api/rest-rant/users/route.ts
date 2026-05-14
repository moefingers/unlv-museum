import { db } from "@/lib/db";
import { users } from "@/lib/schema/rest-rant";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { serializeUser } from "@/lib/rest-rant";

export async function GET() {
  const rows = await db.select().from(users);
  return NextResponse.json(rows.map(serializeUser));
}

export async function POST(request: Request) {
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
  const [row] = await db
    .insert(users)
    .values({
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
  return NextResponse.json(serializeUser(row));
}
