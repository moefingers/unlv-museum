/**
 * Post-OAuth relay landing. Better Auth has just created the session on the
 * canonical museum origin (production); now we generate an HMAC-signed
 * claim token, glue it onto the original callback URL, and redirect the
 * user back to their starting environment, where /auth/claim posts the
 * token to /api/auth/claim/session to mint a local session.
 *
 * See CONTEXT/internal_docs/auth.md §OAuth Relay.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { generateClaimToken } from "@/lib/claim-token";
import { isTrustedCallbackUrl } from "@/lib/callback-validation";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const callback = request.cookies.get("relay-callback")?.value;
  if (!callback || !isTrustedCallbackUrl(callback)) {
    // No valid callback (cookie expired, tampered, untrusted host) — drop the
    // user on production's home, signed in, callback discarded.
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.delete("relay-callback");
    return response;
  }

  const token = generateClaimToken(session.user.id, session.user.email);
  const target = new URL(callback);
  target.searchParams.set("claim", token);

  const response = NextResponse.redirect(target);
  response.cookies.delete("relay-callback");
  return response;
}
