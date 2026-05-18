import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { books } from "../_schema";

export async function GET() {
  const all = await db.select().from(books).orderBy(desc(books.createdAt));
  return NextResponse.json(all);
}
