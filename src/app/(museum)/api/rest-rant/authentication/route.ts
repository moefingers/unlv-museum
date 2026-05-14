import { db } from "@/lib/db";
import { users } from "@/lib/schema/rest-rant";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { serializeUser } from "@/lib/rest-rant";

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<{
    email: string;
    password: string;
  }>;
  if (!body.email || !body.password) {
    return NextResponse.json(
      {
        message: `Could not find a user with the provided username and password`,
      },
      { status: 404 },
    );
  }
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email.toLowerCase().trim()));
  if (!user || !bcrypt.compareSync(body.password, user.passwordDigest)) {
    return NextResponse.json(
      {
        message: `Could not find a user with the provided username and password`,
      },
      { status: 404 },
    );
  }
  return NextResponse.json({ user: serializeUser(user) });
}
