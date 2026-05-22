/**
 * Shared mutation guard for museum API routes — handles session lookup,
 * two-tier rate limiting, and the realistic-unauth-401 response with a
 * worked example so visitors hitting routes from Postman/curl get an
 * educational path forward instead of a wall.
 *
 * Usage pattern in a mutation route:
 *
 *   import { guardMutation } from "@/lib/api-guard";
 *
 *   export async function POST(request: Request) {
 *     const guard = await guardMutation(request);
 *     if (guard.response) return guard.response;
 *     // guard.actor is now { id, login } — the authenticated session
 *     // ... do the mutation
 *     await writeAuditEntry({ ..., actor: guard.actor, tier: "original" }, event);
 *   }
 *
 * Convention (project_enhanced_api_conventions.md):
 *   - Reads stay anonymous; do NOT call guardMutation from GET routes
 *   - Writes always go through this guard, even on Original tier
 *   - Unauth → helpful 401 with a worked example, not a bare reject
 *   - Auth'd visitors get a higher rate-limit budget keyed by user.id
 *   - Unauth visitors get a tight budget keyed by IP
 *   - Local dev: @vercel/firewall.checkRateLimit is a no-op
 */

import { checkRateLimit } from "@vercel/firewall";
import { auth } from "@/lib/auth";

export interface MutationActor {
  id: string;
  login: string | null;
}

export interface GuardSuccess {
  /** Authenticated visitor — pass to writeAuditEntry's actor field. */
  actor: MutationActor;
  /**
   * Which URL prefix the visitor hit: "original" for `/api/<slug>/*`,
   * "enhanced" for `/api/v2/<slug>/*`. Pass straight to writeAuditEntry.
   * Derived from request.url so a single handler shared between v1 and
   * v2 routes records the correct tier without any per-route work.
   */
  tier: "original" | "enhanced";
  /** When set, the route handler should return this Response immediately. */
  response: null;
}

export interface GuardReject {
  actor: null;
  tier: "original" | "enhanced";
  response: Response;
}

export type GuardResult = GuardSuccess | GuardReject;

/** Derive the museum tier from the request path. */
export function tierFromUrl(url: string | URL): "original" | "enhanced" {
  const path = typeof url === "string" ? new URL(url).pathname : url.pathname;
  return path.startsWith("/api/v2/") ? "enhanced" : "original";
}

/**
 * Top-of-handler guard for any mutation route in the museum.
 *
 *   - Reads the session via Better Auth
 *   - Checks rate limit (firewall) — separate budgets for auth vs unauth
 *   - Returns a 429 Response if rate-limited
 *   - Returns a 401 Response if the visitor isn't signed in (with a
 *     descriptive body that quotes their current request and tells
 *     them how to fix it)
 *   - Otherwise returns { actor, response: null } — the route proceeds
 */
export async function guardMutation(request: Request): Promise<GuardResult> {
  const tier = tierFromUrl(request.url);
  const session = await auth.api.getSession({ headers: request.headers });

  // Rate-limit FIRST so unauth abusers can't hammer the unauth-401 path
  // either. Two distinct keys — by-IP for unauth, by-user.id for auth —
  // so a logged-in visitor's budget isn't shared with arbitrary
  // bystanders behind the same NAT.
  const rateLimitKey = session ? `user:${session.user.id}` : null;
  // The @vercel/firewall checkRateLimit signature: pass the rate-limit
  // ID configured in the Vercel firewall console, plus `request` so it
  // can extract IP, and optionally `rateLimitKey` to scope the budget.
  // Local dev is a no-op; production reads from the WAF config (see
  // CONTEXT/internal_docs/rate-limiting.md).
  const { rateLimited } = await checkRateLimit("museum-api", {
    request,
    rateLimitKey: rateLimitKey ?? undefined,
  });
  if (rateLimited) {
    return {
      actor: null,
      tier,
      response: Response.json(
        {
          error: "rate_limited",
          message: session
            ? "You've hit the per-user rate limit. Wait a minute and try again."
            : "You've hit the unauth rate limit. Sign in for a much higher budget — see /api/auth/sign-in/social or generate a personal API key from your profile dropdown.",
        },
        { status: 429, headers: { "Retry-After": "60" } },
      ),
    };
  }

  if (!session) {
    return {
      actor: null,
      tier,
      response: buildUnauthResponse(request),
    };
  }

  return {
    actor: {
      id: session.user.id,
      // Better Auth's user.name comes from GitHub OAuth (the github login).
      // The museum's auth.user schema doesn't expose githubLogin directly,
      // so name is the practical attribution string.
      login: session.user.name ?? null,
    },
    tier,
    response: null,
  };
}

/**
 * The "helpful 401" — not a wall, a path forward.
 *
 * The visitor's current request is echoed back in a `worked_example`
 * block that shows EXACTLY what they were trying to do, with the
 * auth-attaching steps inserted. Two paths: interactive (sign in via
 * GitHub on the museum) or programmatic (generate a PAT, exchange it
 * for a session, attach the cookie).
 *
 * Real-API convention: 401 status, structured JSON body, no
 * exception-class leakage in the message field.
 */
function buildUnauthResponse(request: Request): Response {
  const url = new URL(request.url);
  const method = request.method;

  return Response.json(
    {
      error: "unauthorized",
      message:
        "This endpoint requires authentication. Two ways to fix it: " +
        "(1) Sign in interactively at the museum's homepage and retry from a browser tab that has the session cookie. " +
        "(2) If you're hitting this from Postman/curl/another app, generate a personal API key from your profile dropdown (top-right of the museum), then attach it as a Bearer token. " +
        "An unauthenticated visitor still gets a tight rate-limit budget for repeated attempts so you can experiment, but writes won't commit until you authenticate.",
      worked_example: {
        comment:
          "Below is a fetch() example that adds Bearer-token auth to the request you just tried. Replace <YOUR_API_KEY> with the token shown in the API-key modal.",
        fetch: `await fetch(${JSON.stringify(url.toString())}, {
  method: ${JSON.stringify(method)},
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer <YOUR_API_KEY>",
  },${method !== "GET" ? "\n  body: JSON.stringify({ /* your payload */ }),\n" : "\n"}});`,
        curl: `curl -X ${method} ${JSON.stringify(url.toString())} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <YOUR_API_KEY>"${method !== "GET" ? ` \\\n  -d '{ "...": "your payload" }'` : ""}`,
      },
      how_to_get_a_key: {
        interactive:
          "Sign in to the museum with GitHub, click your avatar (top-right), choose 'API key' from the dropdown. The modal shows your token once.",
        programmatic:
          "Run `pnpm pat:generate` locally if you've cloned the museum; otherwise use the interactive flow.",
      },
    },
    { status: 401 },
  );
}
