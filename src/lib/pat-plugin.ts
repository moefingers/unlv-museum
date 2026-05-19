/**
 * Better Auth plugin exposing two non-OAuth session-creation endpoints:
 *
 *   POST /api/auth/pat/session    { token }     — exchange a PAT for a session
 *   POST /api/auth/claim/session  { token }     — exchange a relay claim for a session
 *
 * Both create a real Better Auth session and set the session cookie via the
 * canonical setSessionCookie helper, so downstream `auth.api.getSession`
 * calls see the user just like a regular OAuth sign-in.
 *
 * See CONTEXT/internal_docs/auth.md §PAT and §OAuth Relay.
 */

import { createAuthEndpoint } from "better-auth/api";
import type { BetterAuthPlugin } from "better-auth";
import { setSessionCookie } from "better-auth/cookies";
import { and, eq, isNull } from "drizzle-orm";
import crypto from "crypto";

import { db } from "./db";
import { personalAccessToken, user } from "./schema/auth";
import { verifyClaimToken } from "./claim-token";

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

      claimSession: createAuthEndpoint(
        "/claim/session",
        { method: "POST" },
        async (ctx) => {
          const token = ctx.body?.token as string | undefined;
          if (!token) throw new Error("Token required");

          const payload = verifyClaimToken(token);
          if (!payload) throw new Error("Invalid or expired claim token");

          const users = await db
            .select()
            .from(user)
            .where(eq(user.id, payload.userId))
            .limit(1);
          if (users.length === 0) throw new Error("User not found");

          const session = await ctx.context.internalAdapter.createSession(
            payload.userId,
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
