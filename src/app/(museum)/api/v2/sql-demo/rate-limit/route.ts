/**
 * /api/v2/sql-demo/rate-limit — Enhanced-tier rate-limit observability.
 *
 *   GET /rate-limit
 *
 * Returns the visitor's current rate-limit state for the `museum-api`
 * key. Same pattern as music-tour, admin-portal, rest-rant — see those
 * for the full caveat about why this returns policy rather than live
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
        note: "Reads against /api/sql-demo/* and /api/v2/sql-demo/* are not currently rate-limited.",
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
        : "Unauth visitors can SEE the demo form (GET /api/sql-demo/) but cannot submit it — POST is museum-session-gated. Sign in to play with the injection surface; every attempt is audited under your GitHub login.",
      "Reads are not currently throttled.",
      "The locked-down `sql_demo_runner` Postgres role restricts blast radius regardless of the input — a UNION SELECT against auth.user or audit_log returns 'permission denied'. The museum session adds auditability on top.",
    ],
  });
}
