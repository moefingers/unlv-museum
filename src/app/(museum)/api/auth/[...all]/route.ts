/**
 * Better Auth's catch-all route handler. Mounts the OAuth start endpoint,
 * the GitHub callback, session, sign-out, and the per-path rate limiter
 * under `/api/auth/*`. Configuration lives in `src/lib/auth.ts`.
 *
 * Every POST body is capped before Better Auth parses it (see body-cap.ts):
 * its open sign-in endpoint would otherwise parse an unbounded array.
 */

import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { AUTH_BODY_LIMIT, withBodyCap } from "@/lib/body-cap";

const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

export async function POST(request: Request): Promise<Response> {
  const capped = await withBodyCap(request, AUTH_BODY_LIMIT);
  if (!(capped instanceof Request)) return capped;
  return handlers.POST(capped);
}
