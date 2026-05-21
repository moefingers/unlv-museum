/**
 * Mirror of the original Express server's "serve HTML at /" behavior.
 *
 * The source repo's server.js paired liveServer (port 3000, root ./public)
 * with the JSON API (port 3001), so visiting `/` returned admin.html and
 * `/index.html` returned the read-only list. Museum-side that becomes
 * `GET /api/admin-portal` and `GET /api/admin-portal/index.html`.
 *
 * We read the HTML straight from public/originals/js-exercises/admin-portal/
 * (the same static mount the iframe uses) and inject
 * `<base href="/originals/js-exercises/admin-portal/">`
 * into <head> so relative asset URLs (admin.js, assets/*) resolve correctly
 * when the page is loaded directly from /api/admin-portal — keeping the
 * "hit the endpoint in your browser and get content" promise intact.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const PUBLIC_DIR = path.join(
  process.cwd(),
  "public",
  "originals",
  "js-exercises",
  "admin-portal",
);
const BASE_HREF = '<base href="/originals/js-exercises/admin-portal/">';

async function serveHtml(file: string): Promise<Response> {
  let html: string;
  try {
    html = await fs.readFile(path.join(PUBLIC_DIR, file), "utf8");
  } catch {
    return new Response(`Could not find ${file}`, { status: 404 });
  }
  // Inject <base> right after <head> so all relative URLs (admin.js,
  // assets/*) resolve against the museum's static mount regardless of
  // the request URL the page itself was loaded from.
  const withBase = html.replace(/<head>/i, `<head>\n    ${BASE_HREF}`);
  return new Response(withBase, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET() {
  // Original served admin.html at `/`.
  return serveHtml("admin.html");
}
