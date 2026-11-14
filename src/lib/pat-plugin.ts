/**
 * Better Auth plugin exposing one non-OAuth session-creation endpoint:
 *
 *   POST /api/auth/pat/session    { token }     — exchange a PAT for a session
 *
 * It creates a real Better Auth session and sets the session cookie via the
 * canonical setSessionCookie helper, so downstream `auth.api.getSession`
 * calls see the user just like a regular OAuth sign-in.
 *
 * There used to be a second, `/claim/session`, which exchanged an OAuth
 * relay's HMAC claim for a session. It went with the relay (2026-11-14): a
 * claim was a bearer sign-in that anyone holding the signing secret could
 * mint. See CONTEXT/internal_docs/auth.md §PAT and §Sign-in off production.
 */

import { createAuthEndpoint } from "better-auth/api";
import type { BetterAuthPlugin } from "better-auth";
import { setSessionCookie } from "better-auth/cookies";
import { and, eq, isNull } from "drizzle-orm";
import crypto from "crypto";

import { db } from "./db";
import { personalAccessToken, user } from "./schema/auth";

function hashPAT(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export const patAuth = () => {
  return {
    id: "pat-auth",
    endpoints: {
      tokenSession: createAuthEndpoint(
        "/pat/session",
        { method: "POST" },
        async (ctx) => {
          const token = ctx.body?.token as string | undefined;
          if (!token) throw new Error("Token required");

          const tokenHash = hashPAT(token);
          const pats = await db
            .select({
              id: personalAccessToken.id,
              userId: personalAccessToken.userId,
              expiresAt: personalAccessToken.expiresAt,
            })
            .from(personalAccessToken)
            .where(
              and(
                eq(personalAccessToken.tokenHash, tokenHash),
                isNull(personalAccessToken.revokedAt),
              ),
            )
            .limit(1);

          if (pats.length === 0) throw new Error("Invalid token");
          const pat = pats[0]!;
          if (pat.expiresAt && pat.expiresAt < new Date()) {
            throw new Error("Token expired");
          }

          const users = await db
            .select()
            .from(user)
            .where(eq(user.id, pat.userId))
            .limit(1);
          if (users.length === 0) throw new Error("User not found");

          await db
            .update(personalAccessToken)
            .set({ lastUsedAt: new Date() })
            .where(eq(personalAccessToken.id, pat.id));

          const session = await ctx.context.internalAdapter.createSession(
            pat.userId,
            false,
          );
          if (!session) throw new Error("Failed to create session");

          await setSessionCookie(ctx, { session, user: users[0]! });
          return { success: true };
        },
      ),
    },
  } satisfies BetterAuthPlugin;
};
