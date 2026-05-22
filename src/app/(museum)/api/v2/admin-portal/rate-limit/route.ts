/**
 * /api/v2/admin-portal/rate-limit — Enhanced-tier rate-limit observability.
 *
 *   GET /rate-limit
 *
 * Returns the visitor's current rate-limit state for the `museum-api`
 * key — without consuming a write-budget unit (this is itself a read).
 * Mirrors GitHub's GET /rate_limit endpoint.
 *
 * See music-tour's identical endpoint for the same caveat: the
 * @vercel/firewall checkRateLimit return shape exposes `rateLimited` only
 * (no remaining/reset counters), so this endpoint returns the **policy**
 * rather than current consumption. When Upstash sliding-window lands
 * (rate-limiting.md §Upstash), this can return live counters.
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
        note: "Reads against /api/admin-portal/* and /api/v2/admin-portal/* are not currently rate-limited.",
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
