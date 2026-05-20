/**
 * Mirror of the original Express server's "serve the SPA HTML at /" behavior.
 *
 * `rest-rant-monorepo` packages a CRA frontend + an Express + Sequelize
 * backend together. In production the Express server served the SPA's
 * static build from `frontend/build` and proxied API calls under
 * `/places`, `/users`, `/authentication`. Museum-side those API surfaces
 * live under `/api/rest-rant/*` (Next.js handlers), and this route
 * surfaces the SPA's `index.html` at `/api/rest-rant/` so visitors hitting
 * the API root in /api-client see the same web page the original server
 * served at its root.
 *
 * Mirrors the admin-portal pattern in `../admin-portal/route.ts` —
 * read the file from `public/originals/rest-rant/`, inject a `<base>`
 * tag so the relative asset paths resolve regardless of where the page
 * was loaded from. Returns 404 only if the CRA build hasn't been
 * produced into public/originals/ yet.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const PUBLIC_DIR = path.join(process.cwd(), "public", "originals", "rest-rant");
const BASE_HREF = '<base href="/originals/rest-rant/">';

async function serveHtml(file: string): Promise<Response> {
  let html: string;
  try {
    html = await fs.readFile(path.join(PUBLIC_DIR, file), "utf8");
  } catch {
    return new Response(`Could not find ${file}`, { status: 404 });
  }
  const withBase = html.replace(/<head>/i, `<head>\n    ${BASE_HREF}`);
  return new Response(withBase, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET() {
  // The CRA frontend's entry point.
  return serveHtml("index.html");
}
