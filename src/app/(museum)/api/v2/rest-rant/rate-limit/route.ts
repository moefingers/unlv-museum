/**
 * /api/v2/rest-rant/rate-limit — Enhanced-tier rate-limit observability.
 *
 *   GET /rate-limit
 *
 * Returns the visitor's current rate-limit state for the `museum-api`
 * key. Same pattern as music-tour and admin-portal — see those for
 * the full caveat about why this returns policy rather than live
 * consumption counters today.
 */

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });

  return NextResponse.json({
    tier: session ? "auth" : "anon",
    actor: session ? { login: session.user.name } : null,
    policy: {
      reads: {
        limit: "unmetered",
        note: "Reads against /api/rest-rant/* and /api/v2/rest-rant/* are not currently rate-limited.",
      },
      writes: {
        limit: session ? "60 per minute" : "5 per minute",
        key: session ? "user.id" : "ip",
        window: "60s rolling",
        provider: "@vercel/firewall (no-op in local dev)",
      },
    },
    notes: [
      session
        ? "You're signed in — write requests are budgeted by your user.id, not the source IP."
        : "Unauth visitors get a tighter budget keyed by source IP. Sign in to unlock the higher per-user budget.",
      "Reads are not currently throttled.",
      "rest-rant additionally enforces the identity-and-signup contract: login attempts and successes are audited, and login lookups are three-factor (email + password + matching museum_user_id). See CONTEXT/internal_docs/identity-and-signup.md.",
    ],
  });
}
