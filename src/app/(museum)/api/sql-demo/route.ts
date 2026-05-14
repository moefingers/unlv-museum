import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    username: string;
    password: string;
    mode: "vulnerable" | "safe";
  };

  if (!body.username || !body.password || !body.mode) {
    return NextResponse.json(
      { error: "username, password, and mode are required" },
      { status: 400 },
    );
  }

  if (body.mode === "vulnerable") {
    // Intentionally vulnerable to demonstrate SQL injection
    // DO NOT use string interpolation for real queries
    const query = `SELECT id, username, role FROM sql_demo.users WHERE username = '${body.username}' AND password = '${body.password}'`;

    try {
      const result = await db.execute(sql.raw(query));
      return NextResponse.json({
        query,
        rows: result.rows,
        rowCount: result.rowCount,
        injected: body.username.includes("'") || body.password.includes("'"),
      });
    } catch (e) {
      return NextResponse.json({
        query,
        error: e instanceof Error ? e.message : String(e),
        injected: true,
      });
    }
  }

  // Safe parameterized query
  const query =
    "SELECT id, username, role FROM sql_demo.users WHERE username = $1 AND password = $2";
  const result = await db.execute(
    sql`SELECT id, username, role FROM sql_demo.users WHERE username = ${body.username} AND password = ${body.password}`,
  );

  return NextResponse.json({
    query: `${query} -- params: [$1='${body.username}', $2='${body.password}']`,
    rows: result.rows,
    rowCount: result.rowCount,
    injected: false,
  });
}
