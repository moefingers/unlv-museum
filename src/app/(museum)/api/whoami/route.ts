/**
 * Auth smoke-test endpoint. Returns the current session if signed in, else
 * 401. Useful for verifying the GitHub OAuth flow + cookie round-trip:
 *
 *   GET /api/whoami  →  401 when signed out
 *   GET /api/whoami  →  { user: {...}, session: {...} } when signed in
 *
 * Doubles as the canonical example of "how to check auth in a route handler"
 * — see CONTEXT/internal_docs/auth.md §Reading Sessions in Route Handlers.
 */

import { auth } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }
  // Project routes should pick out only the fields they need — returning the
  // whole session object is for diagnostics. The `verified` field is on
  // session.user.
  return Response.json({
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
      verified: (session.user as { verified?: boolean }).verified ?? false,
    },
    session: {
      id: session.session.id,
      expiresAt: session.session.expiresAt,
    },
  });
}
