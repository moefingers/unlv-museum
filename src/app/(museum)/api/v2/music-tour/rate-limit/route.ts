/**
 * /api/v2/music-tour/rate-limit — Enhanced-tier rate-limit observability.
 *
 *   GET /rate-limit
 *
 * Returns the visitor's current rate-limit state for the `museum-api`
 * key — without consuming a write-budget unit (this is itself a read).
 * Mirrors GitHub's GET /rate_limit endpoint.
 *
 * No body shape from @vercel/firewall's `checkRateLimit` exposes
 * remaining/reset counters today — its return is `{ rateLimited: boolean }`
 * only. Until/unless the SDK gains that surface (or the museum adopts
 * Upstash sliding-window per rate-limiting.md §Upstash), this endpoint
 * returns the **policy** (the limits we're enforcing) so visitors can
 * read the rules even if we can't yet show their current consumption.
 *
 * Per the precedent (memory: project_enhanced_api_conventions.md), the
 * write budgets are tight (5/min unauth, 60/min auth) and there's no
 * read budget today.
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
        note: "Reads against /api/music-tour/* and /api/v2/music-tour/* are not currently rate-limited.",
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
      "Reads are not currently throttled. Heavy read traffic may add a read budget later — watch this endpoint for changes.",
      "The actual consumed counters aren't surfaced yet — see rate-limiting.md §Upstash for when that lands.",
    ],
  });
}
