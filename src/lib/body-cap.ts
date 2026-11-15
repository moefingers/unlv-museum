/**
 * A cap on how many request-body bytes the auth route reads.
 *
 * Better Auth's open `POST /sign-in/social` validates an unbounded `scopes`
 * array before anything of the app's runs: zod builds one issue per failing
 * element, about 240 MB and a second of CPU for every 0.5 MB of body, and no
 * Better Auth version bounds it (2026-11-14). Better Auth's Next handler
 * offers no size limit, so the route refuses here, before Better Auth reads
 * anything. Modelled on OutlastSite's lib/auth-body-limit.ts (OUT-1513).
 *
 * The body is read only up to the limit, whatever Content-Length says (a
 * client can leave it out by sending chunked, or understate it), and Better
 * Auth is handed a request rebuilt from those bytes. A declared length over
 * the limit is refused before anything is read. A request with no body
 * passes as it came.
 */

/**
 * 256 KiB, from what really posts here. The largest body any caller sends is
 * `/sign-in/social`, whose `callbackURL` comes from the page's own URL (the
 * login page's redirect, or the current page). Vercel refuses a URL over
 * 14 KB, so that body stays under about 29 KB (OutlastSite measured 28,727
 * bytes at that limit). Every other auth request is under 1 KB. 256 KiB is
 * about 9 times the largest, and a body this size that fails every element
 * costs tens of MB, not the gigabyte Vercel's 4.5 MB request limit would allow.
 */
export const AUTH_BODY_LIMIT = 256 * 1024;

/** Over the limit, said in Better Auth's error shape. */
function tooLarge(): Response {
  return Response.json(
    { code: "BODY_TOO_LARGE", message: "This request is too large." },
    { status: 413 },
  );
}

/**
 * The request rebuilt with its body read into memory, or a 413 (over the
 * limit) or 400 (unreadable) Response.
 *
 * Rebuilt from its parts, never `new Request(request, ...)`: Next hands a
 * route a Proxy of the request, which has no Request brand, so the
 * constructor reads it as a URL and throws (OutlastSite found that on a
 * deployment).
 */
export async function withBodyCap(
  request: Request,
  limit: number,
): Promise<Request | Response> {
  if (request.body === null) return request;

  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const n = Number(declared);
    if (!Number.isFinite(n) || n < 0 || n > limit) {
      await request.body.cancel("over the auth route's limit").catch(() => {});
      return tooLarge();
    }
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel("over the auth route's limit").catch(() => {});
        return tooLarge();
      }
      chunks.push(value);
    }
  } catch {
    return Response.json(
      { code: "BODY_UNREADABLE", message: "This request could not be read." },
      { status: 400 },
    );
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const headers = new Headers(request.headers);
  // The body is now a fixed buffer: its length is known, and it is no
  // longer chunked.
  headers.delete("transfer-encoding");
  headers.set("content-length", String(total));
  return new Request(request.url, {
    method: request.method,
    headers,
    body,
    signal: request.signal,
  });
}
