/**
 * OAuth relay entry. Called by non-canonical environments (preview, LAN,
 * Chrome MCP, etc.) that GitHub will reject as callback URLs.
 *
 *   GET /auth/relay?callback=<full-url-back-to-origin>
 *
 * Validates the callback against the trusted-origin list, then drops a
 * short-lived cookie holding the callback and forwards the user to
 * /auth/relay/start, which fires Better Auth's GitHub OAuth flow with
 * `callbackURL=/auth/relay/complete` — landing the user back on production
 * with the session created.
 *
 * See CONTEXT/internal_docs/auth.md §OAuth Relay.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isTrustedCallbackUrl } from "@/lib/callback-validation";

export async function GET(request: NextRequest) {
  const callback = request.nextUrl.searchParams.get("callback");

  if (!callback || !isTrustedCallbackUrl(callback)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.redirect(
    new URL("/auth/relay/start", request.url),
  );
  response.cookies.set("relay-callback", callback, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });
  return response;
}
