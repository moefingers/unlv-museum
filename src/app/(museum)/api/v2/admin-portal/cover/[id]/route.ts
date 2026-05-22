/**
 * /api/v2/admin-portal/cover/[id] — deterministic SVG cover for a book.
 *
 *   GET /cover/<book-id>
 *
 * Returns image/svg+xml. The id can be any stable string the caller has
 * for the book — the museum uses the book's row id (`/cover/42`), but
 * since the SVG is fully derived from the id + URL query (?title=, ?year=)
 * the endpoint also works for previews on books that haven't been
 * inserted yet (the Replaced UI uses this in the "Add a book" preview
 * panel).
 *
 * Why a separate endpoint instead of inlining the SVG into the books
 * response: caches. The book list response is fully fresh (audit log
 * driven), but the cover for a given id never changes — Cache-Control
 * lets the browser pin it for a year.
 *
 * Why query-string title/year (not a DB lookup): the Replaced UI wants
 * a live preview as the user types the title in the "Add a book" form.
 * Doing a DB lookup here would force the preview to write a draft row
 * first; passing the title in the URL keeps the endpoint stateless.
 * When the form submits, the server stores `imageUrl: /api/v2/admin-portal/cover/<newId>?title=<title>&year=<year>`,
 * which the UI then displays via <img src>.
 */

import { renderBookCover } from "@/lib/book-cover-svg";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const title = (url.searchParams.get("title") ?? "Untitled").slice(0, 200);
  const yearRaw = url.searchParams.get("year");
  const year = yearRaw ? yearRaw.slice(0, 10) : null;

  const svg = renderBookCover({ seed: id, title, year });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Immutable for a year — the cover for a given (id,title,year)
      // triple is purely deterministic. Title-only edits land at a
      // different URL so this caches without worrying about staleness.
      "Cache-Control": `public, max-age=${ONE_YEAR_IN_SECONDS}, immutable`,
    },
  });
}
