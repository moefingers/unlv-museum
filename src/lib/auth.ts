/**
 * Better Auth instance for the museum. GitHub OAuth only; database-backed
 * sessions + rate limit; audit-log hooks fire on user creation and session
 * creation.
 *
 * Spec: CONTEXT/internal_docs/auth.md
 * Rate limit windows: CONTEXT/internal_docs/rate-limiting.md §Layer-2
 */

import net from "node:net";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./schema/auth";
import { emitUserAudit } from "./user-audit";
import { patAuth } from "./pat-plugin";

// Derive baseURL from the inbound request's host when it matches an allowed
// pattern. Lets local dev work on any port; production resolves to the
// canonical museum domain because the request's host matches it directly.
// Better Auth 1.6+ feature — see DynamicBaseURLConfig in @better-auth/core.
const PRODUCTION_HOST = "unlv-museum.infinite-syndicate.com";
const allowedHosts: string[] = ["localhost:*", "127.0.0.1:*", PRODUCTION_HOST];
if (process.env.VERCEL_SCOPE) {
  // Vercel preview deployments under the museum's team slug, e.g.
  // unlv-museum-<hash>-<team>.vercel.app. Team slugs are unique so this
  // can't be replicated by an attacker.
  allowedHosts.push(`*-${process.env.VERCEL_SCOPE}.vercel.app`);
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: {
    allowedHosts,
    fallback:
      process.env.BETTER_AUTH_URL ||
      (process.env.NODE_ENV === "production"
        ? `https://${PRODUCTION_HOST}`
        : "http://localhost:3000"),
    protocol: process.env.NODE_ENV === "production" ? "https" : "auto",
  },

  // GitHub-only. No email/password — see auth.md §Why GitHub-only.
  emailAndPassword: { enabled: false },

  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily
    // Cookie-cached sessions: signed snapshot of the session in the cookie
    // itself, valid for 5 min, so /get-session doesn't DB-query every nav.
    // Critical for keeping the chip's useSession() under the rate limit
    // when a user navigates the museum — without this, every page mount
    // triggers a fresh /get-session DB hit and a moderate visit floods
    // the 30-req/min limit.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  // Trust the museum's canonical origin in prod, plus any localhost port or
  // RFC 1918 / loopback / link-local IP when the request comes from one.
  // `net.isIP` rejects hostnames that LOOK like IPs but aren't (10.evil.com).
  trustedOrigins: async (request) => {
    const origins: string[] = [`https://${PRODUCTION_HOST}`];
    if (process.env.VERCEL_SCOPE) {
      origins.push(`https://*-${process.env.VERCEL_SCOPE}.vercel.app`);
    }
    const origin = request?.headers?.get?.("origin");
    if (origin) {
      try {
        const url = new URL(origin);
        if (
          url.hostname === "localhost" ||
          (net.isIP(url.hostname) === 4 &&
            /^(10\.|127\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.)/.test(
              url.hostname,
            ))
        ) {
          origins.push(origin);
        }
      } catch {
        // Malformed origin — skip; can't trust what we can't parse.
      }
    }
    return origins;
  },

  // Single-domain cookie. No `.infinite-syndicate.com` parent-domain
  // cookie — sibling projects under that domain run their own auth.
  // See auth.md §Cookie Domain.

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["github"],
    },
  },

  // Database-backed rate limiting. CRITICAL: storage "memory" (the default)
  // resets on every cold start in serverless and is useless.
  //
  // Per-path windows below match the spec in
  // CONTEXT/internal_docs/rate-limiting.md §Layer-2. /get-session is the
  // chip's heartbeat — even with cookieCache enabled, useSession() refetches
  // on mount, so a museum visit with multiple navigations easily exceeds a
  // low limit. 200/min/IP is the canonical "read-but-don't-pin-the-DB" tier.
  rateLimit: {
    window: 60,
    max: 30,
    storage: "database",
    customRules: {
      // /get-session is the chip's heartbeat — read-only, no security
      // concern, hit on every component mount AND every Link prefetch
      // Next.js does behind the scenes. cookieCache (above) makes the
      // server-side reads cheap (no DB query) but Better Auth still
      // counts the requests for rate limiting, and the chip can easily
      // burst past any sane per-minute limit during normal browsing.
      // Returning false from the rule function disables rate limiting
      // for the path entirely.
      "/get-session": () => false,
      "/sign-out": { window: 60, max: 30 },
      "/sign-in/social": { window: 60, max: 20 },
      "/callback/github": { window: 60, max: 20 },
      "/pat/session": { window: 60, max: 10 },
      "/claim/session": { window: 60, max: 10 },
    },
  },

  // patAuth: exposes /api/auth/pat/session (token → cookie session) for
  // Chrome MCP / automated tests, and /api/auth/claim/session for the
  // OAuth relay. See auth.md §PAT and §OAuth Relay.
  plugins: [patAuth()],

  databaseHooks: {
    user: {
      create: {
        async after(user) {
          try {
            await emitUserAudit({
              eventType: "user.created",
              userId: user.id,
              email: user.email,
            });
          } catch (err) {
            console.error("[databaseHooks.user.create.after]", err);
          }
        },
      },
    },
    session: {
      create: {
        async after(session) {
          try {
            await emitUserAudit({
              eventType: "session.created",
              userId: session.userId,
              ipAddress: session.ipAddress ?? null,
              userAgent: session.userAgent ?? null,
            });
          } catch (err) {
            console.error("[databaseHooks.session.create.after]", err);
          }
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
