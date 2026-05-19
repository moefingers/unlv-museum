/**
 * Sibling to ../route.ts — mirrors the original Express server's
 * `/index.html` (read-only book list). See ../route.ts for the rationale
 * on injecting <base href>.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const PUBLIC_DIR = path.join(
  process.cwd(),
  "public",
  "originals",
  "admin-portal",
);
const BASE_HREF = '<base href="/originals/admin-portal/">';

export async function GET() {
  let html: string;
  try {
    html = await fs.readFile(path.join(PUBLIC_DIR, "index.html"), "utf8");
  } catch {
    return new Response("Could not find index.html", { status: 404 });
  }
  const withBase = html.replace(/<head>/i, `<head>\n    ${BASE_HREF}`);
  return new Response(withBase, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
